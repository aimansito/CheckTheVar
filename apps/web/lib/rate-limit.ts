import "server-only";
import { headers } from "next/headers";

/**
 * Límite de peticiones por ventana fija (contador + caducidad).
 * - Con UPSTASH_REDIS_REST_URL y UPSTASH_REDIS_REST_TOKEN: Redis compartido entre instancias.
 * - Sin ellas (desarrollo): contador en memoria del proceso.
 * Si Redis falla, se deja pasar la petición: un límite caído nunca debe tumbar el juego.
 */

export type RateLimitResult = { ok: boolean; remaining: number; retryAfterSec: number };

const memory = new Map<string, { count: number; expiresAt: number }>();

function hitMemory(key: string, limit: number, windowSec: number): RateLimitResult {
  const now = Date.now();
  if (memory.size > 10_000) {
    for (const [k, v] of memory) if (v.expiresAt <= now) memory.delete(k);
  }
  const cur = memory.get(key);
  if (!cur || cur.expiresAt <= now) {
    memory.set(key, { count: 1, expiresAt: now + windowSec * 1000 });
    return { ok: true, remaining: limit - 1, retryAfterSec: windowSec };
  }
  cur.count += 1;
  return {
    ok: cur.count <= limit,
    remaining: Math.max(0, limit - cur.count),
    retryAfterSec: Math.ceil((cur.expiresAt - now) / 1000),
  };
}

async function hitRedis(key: string, limit: number, windowSec: number): Promise<RateLimitResult | null> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  try {
    const res = await fetch(`${url}/pipeline`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify([
        ["INCR", key],
        ["EXPIRE", key, windowSec, "NX"],
        ["TTL", key],
      ]),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const out = (await res.json()) as { result?: number }[];
    const count = Number(out[0]?.result ?? 0);
    const ttl = Number(out[2]?.result ?? windowSec);
    return { ok: count <= limit, remaining: Math.max(0, limit - count), retryAfterSec: Math.max(1, ttl) };
  } catch (err) {
    console.error("[rate-limit] Redis no disponible:", err instanceof Error ? err.message : err);
    return null;
  }
}

export async function rateLimit(key: string, limit: number, windowSec: number): Promise<RateLimitResult> {
  const scoped = `ctv:rl:${key}`;
  return (await hitRedis(scoped, limit, windowSec)) ?? hitMemory(scoped, limit, windowSec);
}

/** IP del cliente (Vercel/proxies ponen x-forwarded-for). En local, "local". */
export async function clientIp(): Promise<string> {
  const h = await headers();
  const fwd = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  return fwd || h.get("x-real-ip") || "local";
}

/** Límites del juego y del acceso (peticiones por ventana). */
export const LIMITS = {
  gameStartPerPlayer: { limit: 30, windowSec: 60 },
  gameStartPerIp: { limit: 120, windowSec: 60 },
  gameAnswerPerSession: { limit: 90, windowSec: 60 },
  signInPerIp: { limit: 10, windowSec: 15 * 60 },
  signUpPerIp: { limit: 5, windowSec: 60 * 60 },
  resetPerIp: { limit: 5, windowSec: 60 * 60 },
} as const;
