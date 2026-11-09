import { resolvePlayer } from "@/lib/game/player";
import { GameError, nextQuestion } from "@/lib/game/service";
import { errorResponse, json, parseSessionId } from "@/lib/game/http";

/** GET /api/game/:sessionId/next → una pregunta, sin la respuesta correcta. */
export async function GET(_request: Request, ctx: RouteContext<"/api/game/[sessionId]/next">) {
  try {
    const sessionId = await parseSessionId(ctx.params);
    const player = await resolvePlayer({ createGuest: false });
    if (!player) throw new GameError("session_not_found", 404);

    return json(await nextQuestion(sessionId, player));
  } catch (err) {
    return errorResponse(err);
  }
}
