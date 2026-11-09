/** Cookie del invitado. Sin "server-only": la usan el proxy y las rutas. */
export const GUEST_COOKIE = "ctv_guest";
export const GUEST_COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 año
export const GUEST_TOKEN_RE = /^[a-f0-9]{64}$/;

/** Token aleatorio de 32 bytes en hex (Web Crypto: funciona en cualquier runtime). */
export function newGuestToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export const guestCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: GUEST_COOKIE_MAX_AGE,
};

/** Rutas donde un invitado necesita su cookie (cookie técnica, necesaria para jugar). */
export const GUEST_PATHS = ["/jugar", "/api/game"];
