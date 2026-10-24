import { Outlet, createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import { useEffect } from "react";
import { AuthProvider } from "@/lib/auth-context";
import { FinanceProvider } from "@/lib/finance-context";
import { Toaster } from "@/components/ui/sonner";

import appCss from "../styles.css?url";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="glass-neon max-w-md p-8 text-center">
        <h1 className="text-7xl font-bold text-neon">404</h1>
        <h2 className="mt-3 text-xl font-semibold">Ruta no encontrada</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          La terminal no reconoce este endpoint.
        </p>
        <a href="/" className="btn-emerald mt-6 inline-block">
          Volver a la terminal
        </a>
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "CONTALOGIC AI+ — Terminal Financiera Universal" },
      { name: "theme-color", content: "#0b1020" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-title", content: "Contalogic AI +" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      {
        name: "description",
        content:
          "Terminal financiera con IA para gerentes: calculadora dinámica por sector, escáner OCR de Balance y P&L, y asesor legal-contable LEX AI.",
      },
      { name: "author", content: "CONTALOGIC AI+" },
      { property: "og:title", content: "CONTALOGIC AI+ — Terminal Financiera" },
      {
        property: "og:description",
        content: "Inteligencia financiera y legal para tu negocio.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "icon", type: "image/svg+xml", href: "/icons/icon.svg" },
      { rel: "apple-touch-icon", href: "/icons/apple-touch-icon.png" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className="dark">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  useEffect(() => {
    if (!import.meta.env.PROD || !("serviceWorker" in navigator)) return;

    void navigator.serviceWorker.register("/service-worker.js").catch((error: unknown) => {
      console.error("No se pudo registrar el service worker de Contalogic:", error);
    });
  }, []);

  return (
    <AuthProvider>
      <FinanceProvider>
        <Outlet />
        <Toaster />
      </FinanceProvider>
    </AuthProvider>
  );
}
