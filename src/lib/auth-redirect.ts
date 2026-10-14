export function getAuthRedirectUrl(path: string): string {
  if (typeof window === "undefined") {
    throw new Error("No se puede iniciar el flujo de autenticación fuera del navegador.");
  }

  const configuredUrl = import.meta.env.VITE_APP_URL?.trim();
  const base = new URL(configuredUrl || window.location.origin);
  if (base.protocol !== "https:" && base.protocol !== "http:") {
    throw new Error("La URL pública de Contalogic debe usar HTTPS.");
  }
  if (base.hostname.toLowerCase().includes("lovable")) {
    throw new Error(
      "Configura VITE_APP_URL con el dominio oficial de Contalogic antes de enviar enlaces de autenticación.",
    );
  }

  return new URL(path, base).toString();
}
