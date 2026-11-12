import { clueSchema } from "@checkthevar/shared";
import { resolvePlayer } from "@/lib/game/player";
import { GameError, revealClue } from "@/lib/game/service";
import { assertRateLimit, errorResponse, json, parseSessionId, readJson } from "@/lib/game/http";
import { LIMITS } from "@/lib/rate-limit";

/** POST /api/game/:sessionId/clue { position } → revela la siguiente pista (resta puntos). */
export async function POST(request: Request, ctx: RouteContext<"/api/game/[sessionId]/clue">) {
  try {
    const sessionId = await parseSessionId(ctx.params);
    const parsed = clueSchema.safeParse(await readJson(request));
    if (!parsed.success) throw new GameError("invalid_input", 400);
    await assertRateLimit(`answer:${sessionId}`, LIMITS.gameAnswerPerSession);

    const player = await resolvePlayer({ createGuest: false });
    if (!player) throw new GameError("session_not_found", 404);

    return json(await revealClue(sessionId, player, parsed.data.position));
  } catch (err) {
    return errorResponse(err);
  }
}
