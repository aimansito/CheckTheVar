import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { Corners } from "@/components/brand/Logo";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { InviteShare } from "@/components/leagues/LeagueForms";
import { formatWhen, levelLabel } from "@/lib/format";
import { leaveLeague } from "@/lib/league-actions";
import { currentUserId, viewLeague, type FixtureRow, type LeagueView } from "@/lib/leagues";

export const metadata: Metadata = { title: "Liga", robots: { index: false, follow: false } };

export default function LeaguePage({ params, searchParams }: PageProps<"/ligas/[id]">) {
  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <Suspense fallback={<p className="py-16 text-center text-muted">Cargando la clasificación…</p>}>
          <LeagueContent params={params} searchParams={searchParams} />
        </Suspense>
      </main>
      <SiteFooter />
    </>
  );
}

async function LeagueContent({
  params,
  searchParams,
}: {
  params: PageProps<"/ligas/[id]">["params"];
  searchParams: PageProps<"/ligas/[id]">["searchParams"];
}) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const leagueId = Number(id);
  if (!Number.isInteger(leagueId) || leagueId <= 0) notFound();
  const userId = await currentUserId();
  if (!userId) redirect(`/entrar?next=/ligas/${leagueId}`);
  const l = await viewLeague(userId, leagueId);
  if (!l) notFound();

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10">
      <Link href="/ligas" className="text-sm font-semibold text-muted hover:text-text">
        ← Mis ligas
      </Link>
      <p className="mt-4 text-sm font-bold uppercase tracking-wider text-var">
        Temporada {l.season.number} · {l.format === "head_to_head" ? "1 contra 1" : "Por puntos"} · {levelLabel(l.difficulty)}
      </p>
      <h1 className="font-display text-5xl uppercase leading-none sm:text-6xl">{l.name}</h1>
      <p className="mt-2 text-sm text-muted">
        {l.members.length}/{l.maxMembers} jugadores
      </p>

      {(sp.nueva || l.members.length < 2) && (
        <div className="mt-6 rounded-2xl border border-var bg-ok-bg p-5">
          <p className="font-bold">{sp.nueva ? "Liga creada. Ahora, a por la plantilla." : "Te faltan rivales."}</p>
          <p className="mt-1 text-sm text-muted">Pasa el código o el enlace a tu grupo. Pueden unirse en cualquier momento de la temporada.</p>
          <div className="mt-4">
            <InviteShare code={l.inviteCode} leagueName={l.name} />
          </div>
        </div>
      )}

      {l.champion && (
        <p className="mt-6 inline-block rounded-md bg-var px-3 py-1 text-sm font-extrabold text-bg">🏆 Campeón de la temporada pasada: @{l.champion}</p>
      )}

      <div className="mt-8 grid grid-cols-[minmax(0,1fr)] gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-8">
          <CurrentMatchday l={l} />
          <Standings l={l} />
          {l.last && <LastMatchday l={l} />}
        </div>
        <aside className="min-w-0 space-y-8">
          <Calendar l={l} />
          <Members l={l} />
        </aside>
      </div>
    </div>
  );
}

function CurrentMatchday({ l }: { l: LeagueView }) {
  const c = l.current;
  if (!c) {
    const next = l.matchdays.find((m) => m.status === "scheduled");
    return (
      <section className="rounded-2xl border border-line bg-surface p-6">
        <h2 className="font-display text-3xl uppercase">Sin jornada abierta</h2>
        <p className="mt-2 text-muted">{next ? `La jornada ${next.number} abre ${formatWhen(next.opensAt)}.` : "La temporada ha terminado."}</p>
      </section>
    );
  }
  const myFixture = c.fixtures.find((f) => f.homeIsMe || f.awayIsMe);
  const me = c.results.find((r) => r.isMe);
  return (
    <section className="scanlines relative overflow-hidden rounded-2xl border border-line bg-screen px-8 py-10 sm:px-10">
      <Corners />
      <p className="relative text-xs font-bold uppercase tracking-wider text-var">
        Jornada {c.number} · cierra {formatWhen(c.closesAt)}
      </p>
      <h2 className="relative mt-1 font-display text-5xl uppercase">{c.theme ?? "Mixta"}</h2>
      <p className="relative mt-1 text-sm text-muted">{c.questions} preguntas, las mismas para toda la liga. Una sola partida.</p>

      {myFixture && <FixtureLine f={myFixture} />}

      <div className="relative mt-5">
        {c.myStatus === "played" ? (
          <p className="text-lg">
            Jornada jugada: <span className="font-display text-2xl text-var">{me?.score.toLocaleString("es-ES")} pts</span> · {me?.correct} aciertos
          </p>
        ) : (
          <Link href={`/ligas/${l.id}/jornada`} className="inline-block rounded-xl bg-var px-6 py-3.5 font-bold text-bg hover:brightness-110">
            {c.myStatus === "playing" ? "Continuar la jornada" : "Jugar la jornada"}
          </Link>
        )}
      </div>

      {c.results.length > 0 && (
        <ol className="relative mt-5 divide-y divide-line/60 border-t border-line/60">
          {c.results.map((r, i) => (
            <li key={r.userId} className={`flex items-center gap-3 py-2.5 text-sm ${r.isMe ? "text-var" : ""}`}>
              <span className="w-5 font-bold text-muted">{i + 1}</span>
              <span className="flex-1 font-semibold">@{r.username}</span>
              {!r.finished && <span className="text-xs text-muted">jugando</span>}
              <span className="font-bold tabular-nums">{r.score.toLocaleString("es-ES")}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function FixtureLine({ f }: { f: FixtureRow }) {
  if (!f.away) {
    return <p className="relative mt-4 text-sm text-muted">{f.homeIsMe ? "Esta jornada descansas: no sumas puntos de partido." : `@${f.home} descansa.`}</p>;
  }
  const score = (n: number | null) => (n == null ? "–" : n.toLocaleString("es-ES"));
  return (
    <div className="relative mt-4 grid grid-cols-[1fr_auto_1fr] items-center gap-3 rounded-xl border border-line bg-surface px-4 py-3">
      <span className={`truncate font-semibold ${f.homeIsMe ? "text-var" : ""}`}>@{f.home}</span>
      <span className="font-display text-xl tabular-nums">
        {score(f.homeScore)} - {score(f.awayScore)}
      </span>
      <span className={`truncate text-right font-semibold ${f.awayIsMe ? "text-var" : ""}`}>@{f.away}</span>
    </div>
  );
}

function Standings({ l }: { l: LeagueView }) {
  const h2h = l.format === "head_to_head";
  const closed = l.matchdays.filter((m) => m.status === "closed").length;
  return (
    <section className="rounded-2xl border border-line bg-surface p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 className="font-display text-2xl uppercase">
          Clasificación{closed ? <span className="text-var"> · Jornada {closed}</span> : null}
        </h2>
        <span className="text-xs text-muted">{closed ? "" : "Se actualiza al cerrar cada jornada"}</span>
      </div>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[360px] text-sm">
          <thead className="text-left text-xs uppercase text-muted">
            <tr>
              <th className="pb-2 font-semibold">#</th>
              <th className="pb-2 font-semibold">Jugador</th>
              <th className="pb-2 text-right font-semibold">PJ</th>
              {h2h && (
                <>
                  <th className="pb-2 text-right font-semibold">G</th>
                  <th className="pb-2 text-right font-semibold">E</th>
                  <th className="pb-2 text-right font-semibold">P</th>
                </>
              )}
              <th className="pb-2 text-right font-semibold">{h2h ? "Goles" : "Pts"}</th>
              {h2h && <th className="pb-2 text-right font-semibold">Pts</th>}
            </tr>
          </thead>
          <tbody className="tabular-nums">
            {l.standings.map((r) => (
              <tr key={r.userId} className={`border-t border-line/60 ${r.isMe ? "text-var" : ""}`}>
                <td className="py-2.5 font-bold">{r.position}</td>
                <td className="py-2.5 font-semibold">@{r.username}</td>
                <td className="py-2.5 text-right">{r.played}</td>
                {h2h && (
                  <>
                    <td className="py-2.5 text-right">{r.won}</td>
                    <td className="py-2.5 text-right">{r.drawn}</td>
                    <td className="py-2.5 text-right">{r.lost}</td>
                  </>
                )}
                <td className="py-2.5 text-right">{r.totalScore.toLocaleString("es-ES")}</td>
                {h2h && <td className="py-2.5 text-right font-bold">{r.points}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {h2h && <p className="mt-3 text-xs text-muted">Goles = puntos de juego (sirven de desempate).</p>}
    </section>
  );
}

function LastMatchday({ l }: { l: LeagueView }) {
  const last = l.last!;
  return (
    <section className="rounded-2xl border border-line bg-surface p-5">
      <h2 className="font-display text-2xl uppercase">
        Jornada {last.number} · <span className="text-var">{last.theme ?? "Mixta"}</span>
      </h2>
      {last.fixtures.length > 0 ? (
        <div className="mt-2 space-y-2">
          {last.fixtures.map((f, i) => (
            <FixtureLine key={i} f={f} />
          ))}
        </div>
      ) : (
        <ol className="mt-3 divide-y divide-line/60">
          {last.results.map((r, i) => (
            <li key={r.username} className={`flex items-center gap-3 py-2.5 text-sm ${r.isMe ? "text-var" : ""}`}>
              <span className="w-5 font-bold text-muted">{i + 1}</span>
              <span className="flex-1 font-semibold">@{r.username}</span>
              {!r.played && <span className="text-xs text-muted">no jugó</span>}
              <span className="font-bold tabular-nums">{r.score.toLocaleString("es-ES")}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function Calendar({ l }: { l: LeagueView }) {
  return (
    <section className="rounded-2xl border border-line bg-surface p-5">
      <h2 className="font-display text-2xl uppercase">Calendario</h2>
      <ol className="mt-3 space-y-1 text-sm">
        {l.matchdays.map((m) => (
          <li
            key={m.id}
            className={`flex items-center gap-3 rounded-lg px-2 py-1.5 ${m.status === "open" ? "bg-ok-bg text-text" : m.status === "closed" ? "text-muted" : "text-muted"}`}
          >
            <span className="w-8 font-bold">J{m.number}</span>
            <span className="flex-1 font-semibold">{m.theme ?? (m.status === "scheduled" ? "Por desvelar" : "Mixta")}</span>
            <span className="text-xs">{m.status === "closed" ? "cerrada" : formatWhen(m.status === "open" ? m.closesAt : m.opensAt)}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

function Members({ l }: { l: LeagueView }) {
  return (
    <section className="rounded-2xl border border-line bg-surface p-5">
      <h2 className="font-display text-2xl uppercase">Plantilla</h2>
      <ul className="mt-3 flex flex-wrap gap-2">
        {l.members.map((m) => (
          <li key={m.userId} className={`rounded-md border border-line px-2.5 py-1 text-sm font-semibold ${m.isMe ? "text-var" : ""}`}>
            @{m.username}
            {m.role === "owner" && <span className="ml-1 text-xs text-muted">(creador)</span>}
          </li>
        ))}
      </ul>
      <p className="mt-5 text-sm font-semibold">Invitar</p>
      <div className="mt-2">
        <InviteShare code={l.inviteCode} leagueName={l.name} />
      </div>
      <form action={leaveLeague} className="mt-6">
        <input type="hidden" name="leagueId" value={l.id} />
        <button className="rounded-xl border border-line bg-surface px-5 py-3 text-sm font-bold hover:border-ko">
          {l.isOwner ? "Eliminar la liga" : "Salir de la liga"}
        </button>
        {l.isOwner && <p className="mt-2 text-xs text-muted">Los trofeos ya ganados se quedan en la vitrina de cada jugador.</p>}
      </form>
    </section>
  );
}
