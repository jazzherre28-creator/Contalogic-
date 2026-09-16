-- Idempotent profile schema and RLS repair

-- 1. Profiles table and metadata
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  entity_type text CHECK (entity_type IN ('natural','juridica')),
  sector text CHECK (sector IN ('transporte','comercio','servicios','manufactura')),
  display_name text,
  onboarded boolean NOT NULL DEFAULT false,
  nit text,
  nit_last_digit integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;

CREATE POLICY "profiles_select_own" ON public.profiles
  FOR SELECT TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "profiles_insert_own" ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = id);

-- 2. Create profile rows for existing users that are missing them
INSERT INTO public.profiles (id, email)
SELECT id, email
FROM auth.users
WHERE id NOT IN (SELECT id FROM public.profiles)
ON CONFLICT (id) DO NOTHING;

-- 3. Create/repair new-user trigger to guarantee profile rows
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (NEW.id, NEW.email)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 4. Ensure updated_at is refreshed for profile changes
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_touch ON public.profiles;
CREATE TRIGGER profiles_touch
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 5. Ensure nit last digit is computed when nit changes
CREATE OR REPLACE FUNCTION public.compute_nit_last_digit()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.nit IS NOT NULL AND length(regexp_replace(NEW.nit, '[^0-9]', '', 'g')) > 0 THEN
    NEW.nit_last_digit := substring(regexp_replace(NEW.nit, '[^0-9]', '', 'g') from '([0-9])$')::INTEGER;
  ELSE
    NEW.nit_last_digit := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_nit_digit ON public.profiles;
CREATE TRIGGER profiles_nit_digit
  BEFORE INSERT OR UPDATE OF nit ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.compute_nit_last_digit();
