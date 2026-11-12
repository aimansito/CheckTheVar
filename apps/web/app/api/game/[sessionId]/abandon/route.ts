import { resolvePlayer } from "@/lib/game/player";
import { GameError, abandonGame } from "@/lib/game/service";
import { errorResponse, json, parseSessionId } from "@/lib/game/http";

/** POST /api/game/:sessionId/abandon → cierra la partida con lo respondido (cuenta como jugada). */
export async function POST(_request: Request, ctx: RouteContext<"/api/game/[sessionId]/abandon">) {
  try {
    const sessionId = await parseSessionId(ctx.params);
    const player = await resolvePlayer({ createGuest: false });
    if (!player) throw new GameError("session_not_found", 404);

    return json(await abandonGame(sessionId, player));
  } catch (err) {
    return errorResponse(err);
  }
}
