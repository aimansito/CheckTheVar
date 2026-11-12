import { startGameSchema } from "@checkthevar/shared";
import { resolvePlayer } from "@/lib/game/player";
import { GameError, startGame } from "@/lib/game/service";
import { assertRateLimit, errorResponse, json, readJson } from "@/lib/game/http";
import { LIMITS, clientIp } from "@/lib/rate-limit";

/** POST /api/game/start { mode } → crea (o retoma) la partida. */
export async function POST(request: Request) {
  try {
    const parsed = startGameSchema.safeParse(await readJson(request));
    if (!parsed.success) throw new GameError("invalid_input", 400);

    await assertRateLimit(`start:ip:${await clientIp()}`, LIMITS.gameStartPerIp);
    const player = await resolvePlayer({ createGuest: true });
    if (!player) throw new GameError("account_required", 401);
    await assertRateLimit(`start:${player.userId ?? player.guestId}`, LIMITS.gameStartPerPlayer);

    return json(await startGame(parsed.data, player));
  } catch (err) {
    return errorResponse(err);
  }
}
