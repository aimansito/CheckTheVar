import Link from "next/link";
import { Suspense } from "react";
import { AccuracyBar, Empty, SectionTitle, StatCard } from "@/components/admin/ui";
import { getDailyChallenge, getOverview, listActions, requireAdmin, todayInSpain } from "@/lib/admin";
import { formatWhen } from "@/lib/format";
import { MODES } from "@/lib/game/modes";

export const metadata = { title: "Resumen" };

export default function AdminHome() {
  return (
    <Suspense fallback={<p className="text-muted">Revisando la jugada…</p>}>
      <Overview />
    </Suspense>
  );
}

const modeName = (slug: string) => (slug === "league" ? "Jornadas de liga" : (MODES.find((m) => m.slug === slug)?.name ?? slug));
const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)} %` : "—");

async function Overview() {
  await requireAdmin();
  const today = todayInSpain();
  const [o, daily, actions] = await Promise.all([getOverview(), getDailyChallenge(today), listActions(10)]);
  const q = o.questions ?? {};
  const maxGames = Math.max(1, ...o.daily14.map((d) => d.games));
  const maxSignups = Math.max(1, ...o.daily14.map((d) => d.signups));

  return (
    <>
      <p className="text-sm font-semibold uppercase tracking-wider text-var">Panel de administración</p>
      <h1 className="font-display text-5xl uppercase">Resumen</h1>

      {(o.reportsOpen > 0 || (q.draft ?? 0) + (q.review ?? 0) > 0 || o.users.flagged > 0) && (
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          {o.reportsOpen > 0 && (
            <Link href="/admin/reportes" className="rounded-2xl border border-ko/60 bg-ko-bg/60 p-4 font-semibold hover:border-ko">
              ⚑ {o.reportsOpen} {o.reportsOpen === 1 ? "reporte abierto" : "reportes abiertos"} →
            </Link>
          )}
          {(q.draft ?? 0) + (q.review ?? 0) > 0 && (
            <Link href="/admin/preguntas?estado=review" className="rounded-2xl border border-amber-400/50 bg-surface p-4 font-semibold hover:border-amber-400">
              {(q.review ?? 0).toLocaleString("es-ES")} en revisión · {(q.draft ?? 0).toLocaleString("es-ES")} borradores →
            </Link>
          )}
          {o.users.flagged > 0 && (
            <Link href="/admin/usuarios?marcados=1" className="rounded-2xl border border-amber-400/50 bg-surface p-4 font-semibold hover:border-amber-400">
              {o.users.flagged} {o.users.flagged === 1 ? "cuenta marcada" : "cuentas marcadas"} por respuestas sospechosas →
            </Link>
          )}
        </div>
      )}

      <SectionTitle>Hoy</SectionTitle>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Partidas" value={o.games.today} hint={`${o.games.week.toLocaleString("es-ES")} en 7 días`} />
        <StatCard label="Jugadores" value={o.games.playersToday} hint={`${o.games.guestsToday} invitados`} />
        <StatCard label="Registros" value={o.users.today} hint={`${o.users.week} en 7 días`} href="/admin/usuarios" />
        <StatCard
          label="Reto diario"
          value={daily?.plays ?? 0}
          hint={daily ? "partidas del reto de hoy" : "Aún no se ha generado (se crea con la primera partida)"}
        />
      </div>

      <SectionTitle>Últimos 14 días</SectionTitle>
      <div className="grid gap-4 lg:grid-cols-2">
        <MiniBars title="Partidas por día" data={o.daily14.map((d) => ({ date: d.date, value: d.games }))} max={maxGames} />
        <MiniBars title="Registros por día" data={o.daily14.map((d) => ({ date: d.date, value: d.signups }))} max={maxSignups} />
      </div>

      <SectionTitle>Totales</SectionTitle>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Usuarios" value={o.users.total} hint={`${o.users.admins} admin`} href="/admin/usuarios" />
        <StatCard
          label="Invitados que se registran"
          value={pct(o.guests.converted, o.guests.total)}
          hint={`${o.guests.converted.toLocaleString("es-ES")} de ${o.guests.total.toLocaleString("es-ES")}`}
        />
        <StatCard label="Preguntas publicadas" value={q.published ?? 0} hint={`${q.retired ?? 0} retiradas`} href="/admin/preguntas?estado=published" />
        <StatCard label="Ligas" value={o.leagues.total} hint={`${o.leagues.members} miembros`} href="/admin/ligas" />
      </div>

      <div className="mt-10 grid gap-8 lg:grid-cols-2">
        <section>
          <SectionTitle>Partidas por juego</SectionTitle>
          {o.byMode.length ? (
            <table className="w-full overflow-hidden rounded-2xl border border-line bg-surface text-sm">
              <thead className="text-left text-xs uppercase tracking-wider text-muted">
                <tr>
                  <th className="px-4 py-3 font-semibold">Juego</th>
                  <th className="px-4 py-3 text-right font-semibold">Hoy</th>
                  <th className="px-4 py-3 text-right font-semibold">7 días</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line/60">
                {o.byMode.map((m) => (
                  <tr key={m.slug}>
                    <td className="px-4 py-2.5 font-semibold">{modeName(m.slug)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{m.today.toLocaleString("es-ES")}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{m.week.toLocaleString("es-ES")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <Empty>Nadie ha jugado en los últimos 14 días.</Empty>
          )}
          <p className="mt-2 text-xs text-muted">
            Abandonadas en 7 días: {o.games.abandonedWeek.toLocaleString("es-ES")} ({pct(o.games.abandonedWeek, o.games.week)}).
          </p>
        </section>

        <section>
          <SectionTitle>Última actividad del panel</SectionTitle>
          {actions.length ? (
            <ul className="divide-y divide-line/60 rounded-2xl border border-line bg-surface text-sm">
              {actions.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                  <span>
                    <span className="font-semibold">@{a.admin ?? "?"}</span> <span className="text-muted">{describeAction(a.action)}</span>{" "}
                    <TargetLink target={a.target} />
                  </span>
                  <span className="shrink-0 text-xs text-muted">{formatWhen(a.createdAt)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <Empty>Todavía no se ha hecho ningún cambio desde el panel.</Empty>
          )}
        </section>
      </div>

      <SectionTitle aside={<span className="text-sm text-muted">{today}</span>}>Reto diario de hoy</SectionTitle>
      {daily?.questions.length ? (
        <ol className="divide-y divide-line/60 rounded-2xl border border-line bg-surface">
          {daily.questions.map((dq) => (
            <li key={dq.position} className="grid items-center gap-x-4 gap-y-1 px-4 py-3 sm:grid-cols-[2rem_1fr_auto]">
              <span className="font-display text-xl text-var">{dq.position}</span>
              <div className="min-w-0">
                <Link href={`/admin/preguntas/${dq.id}`} className="font-semibold hover:underline">
                  {dq.prompt ?? `Pregunta ${dq.id}`}
                </Link>
                <p className="text-xs text-muted">
                  Respuesta: <span className="text-text">{dq.answer ?? "—"}</span> · dificultad {dq.difficulty}
                </p>
              </div>
              <AccuracyBar correct={dq.correct} shown={dq.answered} />
            </li>
          ))}
        </ol>
      ) : (
        <Empty>El reto de hoy se genera automáticamente con la primera partida del día.</Empty>
      )}
    </>
  );
}

function MiniBars({ title, data, max }: { title: string; data: { date: string; value: number }[]; max: number }) {
  const total = data.reduce((n, d) => n + d.value, 0);
  return (
    <figure className="rounded-2xl border border-line bg-surface p-5">
      <figcaption className="mb-4 flex items-baseline justify-between text-sm">
        <span className="font-semibold">{title}</span>
        <span className="text-muted">Total: {total.toLocaleString("es-ES")}</span>
      </figcaption>
      <div className="flex h-32 items-end gap-1.5">
        {data.map((d) => (
          <div key={d.date} className="group relative flex h-full flex-1 flex-col justify-end" title={`${d.date}: ${d.value}`}>
            <div className="rounded-t bg-var/80 transition group-hover:bg-var" style={{ height: `${Math.max(d.value ? 4 : 1, (d.value / max) * 100)}%` }} />
          </div>
        ))}
      </div>
      <div className="mt-2 flex justify-between text-xs text-muted">
        <span>{data[0]?.date.slice(5)}</span>
        <span>hoy</span>
      </div>
    </figure>
  );
}

function describeAction(action: string): string {
  switch (action) {
    case "question.update":
      return "editó";
    case "question.status":
      return "cambió el estado de";
    case "report.resolved":
      return "resolvió";
    case "report.dismissed":
      return "descartó";
    default:
      return action;
  }
}

function TargetLink({ target }: { target: string }) {
  const [type, id] = target.split(":");
  if (type === "question") return <Link href={`/admin/preguntas/${id}`} className="font-semibold text-var hover:underline">la pregunta {id}</Link>;
  if (type === "report") return <span className="font-semibold">el reporte {id}</span>;
  return <span className="font-semibold">{target}</span>;
}
