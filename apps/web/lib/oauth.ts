import { OAUTH_PROVIDERS } from "@checkthevar/shared";

/** Proveedores OAuth activados en este despliegue (NEXT_PUBLIC_OAUTH_PROVIDERS="google,apple"). */
export function enabledOAuthProviders(): string[] {
  const raw = process.env.NEXT_PUBLIC_OAUTH_PROVIDERS ?? "";
  return raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter((s): s is (typeof OAUTH_PROVIDERS)[number] => (OAUTH_PROVIDERS as readonly string[]).includes(s));
}
