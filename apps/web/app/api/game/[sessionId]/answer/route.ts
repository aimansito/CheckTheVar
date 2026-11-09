import { answerSchema } from "@checkthevar/shared";
import { resolvePlayer } from "@/lib/game/player";
import { GameError, submitAnswer } from "@/lib/game/service";
import { errorResponse, json, parseSessionId, readJson } from "@/lib/game/http";

/** POST /api/game/:sessionId/answer { position, optionId } → CHECK THE VAR. */
export async function POST(request: Request, ctx: RouteContext<"/api/game/[sessionId]/answer">) {
  try {
    const sessionId = await parseSessionId(ctx.params);
    const parsed = answerSchema.safeParse(await readJson(request));
    if (!parsed.success) throw new GameError("invalid_input", 400);

    const player = await resolvePlayer({ createGuest: false });
    if (!player) throw new GameError("session_not_found", 404);

    return json(await submitAnswer(sessionId, player, parsed.data));
  } catch (err) {
    return errorResponse(err);
  }
}
