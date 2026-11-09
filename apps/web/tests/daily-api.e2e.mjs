// Prueba de integración del reto diario como invitado, contra la API real.
// Requisitos: `pnpm db:reset` (Supabase local con seed) y la web arrancada (`pnpm --filter web dev`).
// Uso: pnpm --filter web test:e2e [http://localhost:3000]
// Cubre: no reiniciar el reto, no filtrar la respuesta, recarga sin reiniciar el reloj,
// pregunta no mostrada, opción inválida, doble respuesta, acceso ajeno e invitado jugando dos veces.
// (Tardía, bonus por rapidez y hat-trick: packages/shared/src/scoring.test.ts)
const BASE = process.argv[2] ?? process.env.BASE_URL ?? "http://localhost:3000";
let cookie = "";

async function call(method, path, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: { "Content-Type": "application/json", ...(cookie ? { cookie } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const set = res.headers.getSetCookie?.() ?? [];
  for (const c of set) if (c.startsWith("ctv_guest=")) cookie = c.split(";")[0];
  return { status: res.status, body: await res.json().catch(() => null) };
}

const check = (cond, msg) => {
  console.log(cond ? "✓" : "✗", msg);
  if (!cond) process.exitCode = 1;
};

const start = await call("POST", "/api/game/start", { mode: "daily" });
check(start.status === 200 && start.body.sessionId, `start → ${start.status} total=${start.body?.total}`);
const sid = start.body.sessionId;

check((await call("POST", "/api/game/start", { mode: "grid" })).status === 401, "invitado no puede jugar grid (401)");
check((await call("POST", "/api/game/start", { mode: "trampa" })).status === 400, "modo inventado → 400");

const again = await call("POST", "/api/game/start", { mode: "daily" });
check(again.body.sessionId === sid && again.body.resumed, "repetir start devuelve la MISMA partida (no se reinicia)");

const q1 = await call("GET", `/api/game/${sid}/next`);
const leaks = JSON.stringify(q1.body).match(/is_?correct|correct/i);
check(q1.status === 200 && q1.body.options?.length === 3 && !leaks, `next sin respuesta correcta: "${q1.body.prompt}"`);

const q1b = await call("GET", `/api/game/${sid}/next`);
check(q1b.body.position === 1 && q1b.body.elapsedMs >= q1.body.elapsedMs, "recargar devuelve la misma pregunta sin reiniciar el reloj");

check((await call("POST", `/api/game/${sid}/answer`, { position: 2, optionId: "A" })).status === 409, "responder una pregunta no mostrada → 409");
check((await call("POST", `/api/game/${sid}/answer`, { position: 1, optionId: "Z" })).status === 400, "opción inexistente → 400");

const a1 = await call("POST", `/api/game/${sid}/answer`, { position: 1, optionId: "A" });
check(a1.status === 200 && typeof a1.body.isCorrect === "boolean", `answer 1 → ${a1.body.isCorrect ? "GOL CONFIRMADO" : "GOL ANULADO"} (+${a1.body.points}), correcta ${a1.body.correctOptionId}`);
const a1b = await call("POST", `/api/game/${sid}/answer`, { position: 1, optionId: a1.body.correctOptionId });
check(a1b.body.points === a1.body.points && a1b.body.isCorrect === a1.body.isCorrect, "doble respuesta: devuelve el primer veredicto (idempotente)");

// Otra cookie no puede ver esta partida.
const saved = cookie;
cookie = "ctv_guest=" + "f".repeat(64);
check((await call("GET", `/api/game/${sid}/next`)).status === 404, "otro jugador no accede a la partida (404)");
cookie = saved;

// Resto de preguntas (se responde siempre B).
let last = a1.body;
while (!last.isLast) {
  const q = await call("GET", `/api/game/${sid}/next`);
  last = (await call("POST", `/api/game/${sid}/answer`, { position: q.body.position, optionId: "B" })).body;
}
const done = await call("GET", `/api/game/${sid}/next`);
check(done.body.done === true, "tras la última pregunta, next → done");

const sum = await call("GET", `/api/game/${sid}/summary`);
check(sum.body.status === "finished" && sum.body.pendingPoints === sum.body.score,
  `resumen: ${sum.body.score} pts, ${sum.body.correctCount}/${sum.body.total}, pendientes ${sum.body.pendingPoints}`);

const after = await call("POST", "/api/game/start", { mode: "daily" });
check(after.body.sessionId === sid && after.body.status === "finished", "el invitado no puede jugar dos veces el reto de hoy");
console.log(process.exitCode ? "\nHAY FALLOS" : "\nTodo OK");
