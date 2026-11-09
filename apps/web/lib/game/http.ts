import "server-only";
import { sessionParamsSchema } from "@checkthevar/shared";
import { GameError } from "./service";

/** Respuesta JSON sin caché (cada jugada es única). */
export function json(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export function errorResponse(err: unknown): Response {
  if (err instanceof GameError) {
    return json({ error: err.code }, err.status);
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
