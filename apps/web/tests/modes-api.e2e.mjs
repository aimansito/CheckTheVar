// Prueba de integración de los modos con cuenta (supervivencia, contrarreloj, más o menos,
// adivina el jugador, trayectoria) contra la API real, con un usuario de prueba recién creado.
// Requisitos: Supabase local con preguntas generadas (`pnpm datos:preguntas --publicar`)
// y la web arrancada. Uso: pnpm --filter web test:e2e:modos [http://localhost:3000]
import { createServerClient } from "@supabase/ssr";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const BASE = process.argv[2] ?? process.env.BASE_URL ?? "http://localhost:3000";
const envFile = resolve(import.meta.dirname, "../.env.local");
if (!process.env.NEXT_PUBLIC_SUPABASE_URL && existsSync(envFile)) process.loadEnvFile(envFile);

const check = (cond, msg) => {
  console.log(cond ? "✓" : "✗", msg);
  if (!cond) process.exitCode = 1;
};

// --- Usuario de prueba: la sesión se guarda en el mismo formato de cookie que usa la web.
const jar = new Map();
const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
  cookies: {
    getAll: () => [...jar].map(([name, value]) => ({ name, value })),
    setAll: (list) => list.forEach(({ name, value }) => jar.set(name, value)),
  },
});
const email = `e2e-${Date.now()}@checkthevar.test`;
const { data: signup, error: signupErr } = await supabase.auth.signUp({
  email,
  password: "Prueba-1234",
  options: { data: { username: `e2e${Date.now() % 100000}` } },
});
if (signupErr || !signup.session) {
  console.error("No se pudo crear el usuario de prueba:", signupErr?.message ?? "sin sesión (¿confirmación de email activada?)");
  process.exit(1);
}
const cookie = [...jar].map(([n, v]) => `${n}=${v}`).join("; ");

async function call(method, path, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: { "Content-Type": "application/json", cookie },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}

const leaks = (obj) => /is_?correct|answer_norm|accepted/i.test(JSON.stringify(obj));

// --- Reto diario con cuenta
{
  const start = await call("POST", "/api/game/start", { mode: "daily" });
  // El reto de hoy se creó con las preguntas publicadas en ese momento (hasta 10).
  check(start.status === 200 && start.body.total >= 1 && start.body.total <= 10 && !start.body.resumed, `daily con cuenta: ${start.status}, total ${start.body?.total}`);
}

// --- Supervivencia: sin límite de preguntas, termina al primer fallo
{
  const start = await call("POST", "/api/game/start", { mode: "survival" });
  check(start.status === 200 && start.body.total === null, `survival start → total null (${start.status})`);
  const sid = start.body.sessionId;
  check((await call("POST", "/api/game/start", { mode: "survival" })).body.sessionId === sid, "repetir start retoma la partida abierta");
  let last = null;
  let n = 0;
  while (n < 25) {
    const q = await call("GET", `/api/game/${sid}/next`);
    if (q.body.done) break;
    if (n === 0) check(q.body.mode === "survival" && q.body.options.length >= 3 && !leaks(q.body), `next: "${q.body.prompt}" (${q.body.options.length} opciones, ${q.body.timeLimitMs} ms)`);
    last = (await call("POST", `/api/game/${sid}/answer`, { position: q.body.position, optionId: "A" })).body;
    n++;
    if (last.isLast) break;
  }
  check(last && !last.isCorrect && last.isLast, `tras ${n} preguntas, el primer fallo termina la partida (isLast)`);
  const done = await call("GET", `/api/game/${sid}/next`);
  check(done.body.done === true, "next tras el fallo → done");
  const sum = await call("GET", `/api/game/${sid}/summary`);
  check(sum.body.status === "finished" && sum.body.answered === n && typeof sum.body.bestScore === "number", `resumen: ${sum.body.score} pts, ${sum.body.correctCount}/${sum.body.answered}, mejor ${sum.body.bestScore}`);
  const again = await call("POST", "/api/game/start", { mode: "survival" });
  check(again.body.sessionId !== sid && !again.body.resumed, "tras terminar, start crea una partida nueva");
  const ab = await call("POST", `/api/game/${again.body.sessionId}/abandon`);
  check(ab.status === 200 && ab.body.status === "abandoned", "abandonar cierra la partida (abandoned)");
}

// --- Más o menos: dos opciones, termina al fallar
{
  const start = await call("POST", "/api/game/start", { mode: "higher-lower" });
  const sid = start.body.sessionId;
  const q = await call("GET", `/api/game/${sid}/next`);
  check(q.body.options?.length === 2 && q.body.category === "fichajes", `higher-lower: "${q.body.prompt}" → ${q.body.options?.map((o) => o.label).join(" | ")}`);
  const a = await call("POST", `/api/game/${sid}/answer`, { position: 1, optionId: "B" });
  check(typeof a.body.isCorrect === "boolean" && a.body.isLast === !a.body.isCorrect, `answer → ${a.body.isCorrect ? "GOL CONFIRMADO" : "GOL ANULADO, fin"} (${a.body.explanation})`);
  await call("POST", `/api/game/${sid}/abandon`);
}

// --- Contrarreloj: tiempo total de partida
{
  const start = await call("POST", "/api/game/start", { mode: "time-attack" });
  check(start.body.endsInMs > 80_000 && start.body.endsInMs <= 90_000, `time-attack: endsInMs ${start.body.endsInMs}`);
  const sid = start.body.sessionId;
  const q = await call("GET", `/api/game/${sid}/next`);
  check(q.body.timeLimitMs === 10_000 && q.body.endsInMs < 90_000, `pregunta con 10 s y reloj global ${q.body.endsInMs} ms`);
  const a = await call("POST", `/api/game/${sid}/answer`, { position: 1, optionId: "A" });
  check(a.status === 200 && a.body.isLast === false, "un fallo no termina la contrarreloj");
  await call("POST", `/api/game/${sid}/abandon`);
}

// --- Adivina el jugador: texto libre con pistas
{
  const start = await call("POST", "/api/game/start", { mode: "guess-player" });
  check(start.body.total === 5, `guess-player: ${start.body.total} jugadores`);
  const sid = start.body.sessionId;
  const q = await call("GET", `/api/game/${sid}/next`);
  check(q.body.format === "free_text" && q.body.clues?.length === 1 && q.body.cluesTotal >= 3 && q.body.options.length === 0 && !leaks(q.body), `pista 1/${q.body.cluesTotal}: "${q.body.clues?.[0]}"`);
  const c = await call("POST", `/api/game/${sid}/clue`, { position: 1 });
  check(c.body.cluesUsed === 2 && c.body.clues.length === 2, `pedir pista → 2/${c.body.cluesTotal}: "${c.body.clues[1]}"`);
  check((await call("POST", `/api/game/${sid}/answer`, { position: 1, optionId: "A" })).status === 400, "opción de letra en texto libre → 400");
  const wrong = await call("POST", `/api/game/${sid}/answer`, { position: 1, text: "zzzz jugador inventado" });
  check(wrong.status === 200 && wrong.body.isCorrect === false && wrong.body.correctLabel, `respuesta errónea → GOL ANULADO, era ${wrong.body.correctLabel}`);
  check((await call("POST", `/api/game/${sid}/clue`, { position: 1 })).status === 409, "no se pueden pedir pistas tras responder");
  // Segunda pregunta: respondemos con el apellido correcto obtenido de la primera no vale; probamos idempotencia.
  const again = await call("POST", `/api/game/${sid}/answer`, { position: 1, text: wrong.body.correctLabel });
  check(again.body.isCorrect === false && again.body.points === 0, "doble respuesta: se mantiene el primer veredicto");
  await call("POST", `/api/game/${sid}/abandon`);
}

// --- Trayectoria
{
  const start = await call("POST", "/api/game/start", { mode: "career-path" });
  const sid = start.body.sessionId;
  const q = await call("GET", `/api/game/${sid}/next`);
  check(q.body.format === "free_text" && q.body.cluesTotal >= 4 && q.body.timeLimitMs === 90_000, `career-path: ${q.body.cluesTotal} clubes, primera pista "${q.body.clues?.[0]}"`);
  const t = await call("POST", `/api/game/${sid}/answer`, { position: 1, timeout: true });
  check(t.body.timedOut === false && t.body.isCorrect === false, "timeout explícito cuenta como fallo");
  await call("POST", `/api/game/${sid}/abandon`);
}

// --- Modo no disponible y límite de peticiones
check((await call("POST", "/api/game/start", { mode: "grid" })).status === 404, "grid todavía no disponible → 404");
let limited = 0;
for (let i = 0; i < 32; i++) if ((await call("POST", "/api/game/start", { mode: "survival" })).status === 429) limited++;
check(limited > 0, `rate limit en start: ${limited} respuestas 429 de 32 seguidas`);

console.log(process.exitCode ? "\nHAY FALLOS" : "\nTodo OK");
