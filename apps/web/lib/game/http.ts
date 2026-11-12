import "server-only";
import { sessionParamsSchema } from "@checkthevar/shared";
import { rateLimit } from "@/lib/rate-limit";
import { GameError } from "./service";

/** Respuesta JSON sin caché (cada jugada es única). */
export function json(body: unknown, status = 200, extra?: Record<string, string>): Response {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store", ...(extra ?? {}) } });
}

export function errorResponse(err: unknown): Response {
  if (err instanceof GameError) {
    return json({ error: err.code }, err.status, err.code === "rate_limited" ? { "Retry-After": "60" } : undefined);
  }
  console.error("[game] error inesperado:", err);
  return json({ error: "server_error" }, 500);
}

export async function parseSessionId(params: Promise<{ sessionId: string }>): Promise<string> {
  const parsed = sessionParamsSchema.safeParse(await params);
  if (!parsed.success) throw new GameError("invalid_input", 400);
  return parsed.data.sessionId;
}

export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new GameError("invalid_input", 400);
  }
}

/** Lanza rate_limited (429) si se supera el límite. */
export async function assertRateLimit(key: string, rule: { limit: number; windowSec: number }): Promise<void> {
  const r = await rateLimit(key, rule.limit, rule.windowSec);
  if (!r.ok) throw new GameError("rate_limited", 429);
}
