import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session, User } from "@supabase/supabase-js";

export type Profile = {
  id: string;
  email: string | null;
  entity_type: "natural" | "juridica" | null;
  sector: "transporte" | "comercio" | "servicios" | "manufactura" | null;
  display_name: string | null;
  onboarded: boolean;
  nit: string | null;
  nit_last_digit: number | null;
};

type AuthContextValue = {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);

  const loadProfile = async (uid: string, email?: string | null) => {
    const { data, error } = await supabase.from("profiles").select("*").eq("id", uid).maybeSingle();
    if (error) throw error;

    if (!data) {
      const { error: createError } = await supabase.from("profiles").upsert(
        {
          id: uid,
          email: email ?? null,
          onboarded: false,
        },
        { onConflict: "id", ignoreDuplicates: true },
      );
      if (createError) throw createError;

      const { data: createdProfile, error: reloadError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", uid)
        .maybeSingle();
      if (reloadError) throw reloadError;
      if (!createdProfile) {
        throw new Error("No se pudo crear o consultar el perfil de usuario.");
      }
      setProfile(createdProfile as Profile);
      return;
    }
    setProfile(data as Profile);
  };

  useEffect(() => {
    let active = true;
    let profileRequest = 0;

    const loadUserProfile = async (nextUser: User | null) => {
      const request = ++profileRequest;
      if (!nextUser) {
        setProfile(null);
        setProfileLoading(false);
        return;
      }

      setProfile(null);
      setProfileLoading(true);
      try {
        await loadProfile(nextUser.id, nextUser.email);
      } catch (error) {
        if (active && request === profileRequest) {
          console.error("No se pudo cargar el perfil de usuario.", error);
          setProfile(null);
        }
      } finally {
        if (active && request === profileRequest) setProfileLoading(false);
      }
    };

    const { data: sub } = supabase.auth.onAuthStateChange((event, sess) => {
      setSession(sess);
      setUser(sess?.user ?? null);
      setProfile(null);
      setProfileLoading(Boolean(sess?.user));

      if (event === "PASSWORD_RECOVERY" && typeof window !== "undefined") {
        if (window.location.pathname !== "/reset-password") {
          window.location.replace("/reset-password");
        }
      }
      if (sess?.user) {
        setTimeout(() => {
          if (active) void loadUserProfile(sess.user);
        }, 0);
      } else {
        void loadUserProfile(null);
      }
    });

    void supabase.auth
      .getSession()
      .then(({ data: { session: sess }, error }) => {
        if (!active) return;
        if (error) throw error;
        setSession(sess);
        setUser(sess?.user ?? null);
        void loadUserProfile(sess?.user ?? null);
      })
      .catch((error: unknown) => {
        if (!active) return;
        console.error("No se pudo restaurar la sesión.", error);
        setSession(null);
        setUser(null);
        setProfile(null);
        setProfileLoading(false);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
      profileRequest += 1;
      sub.subscription.unsubscribe();
    };
  }, []);

  const refreshProfile = async () => {
    if (!user) throw new Error("Debes iniciar sesión para guardar el perfil.");
    setProfileLoading(true);
    try {
      await loadProfile(user.id, user.email);
    } finally {
      setProfileLoading(false);
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    window.location.href = "/auth";
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        loading: loading || profileLoading,
        refreshProfile,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de AuthProvider");
  return ctx;
}
