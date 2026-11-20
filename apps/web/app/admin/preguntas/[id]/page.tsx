import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { QuestionEditForm } from "@/components/admin/QuestionEditForm";
import { ReportButtons } from "@/components/admin/ReportButtons";
import { AccuracyBar, Empty, KIND_LABELS, SectionTitle, StatusBadge } from "@/components/admin/ui";
import { getQuestion, requireAdmin } from "@/lib/admin";
import { formatWhen } from "@/lib/format";

export const metadata = { title: "Pregunta" };

export default function QuestionPage({ params }: PageProps<"/admin/preguntas/[id]">) {
  return (
    <Suspense fallback={<p className="text-muted">Cargando la pregunta…</p>}>
      <Question params={params} />
    </Suspense>
  );
}

const LETTERS = ["A", "B", "C", "D", "E"];

async function Question({ params }: { params: PageProps<"/admin/preguntas/[id]">["params"] }) {
  await requireAdmin();
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) notFound();
  const q = await getQuestion(id);
  if (!q) notFound();

  return (
    <>
      <Link href="/admin/preguntas" className="text-sm font-semibold text-muted hover:text-text">
        ← Todas las preguntas
      </Link>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-muted">
        <span className="font-mono">#{q.id}</span>
        <StatusBadge status={q.status} />
        <span>{KIND_LABELS[q.kind] ?? q.kind}</span>
        {q.eraTo && <span>· {q.eraFrom && q.eraFrom !== q.eraTo ? `${q.eraFrom}–${q.eraTo}` : q.eraTo}</span>}
        {q.generatorKey && <span>· plantilla {q.generatorKey}</span>}
      </div>
      <h1 className="mt-2 text-3xl font-extrabold leading-tight">{q.prompt ?? "(sin enunciado en español)"}</h1>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_22rem]">
        <div>
          {q.options.length > 0 && (
            <ul className="space-y-2">
              {q.options.map((o, i) => (
                <li
                  key={o.position}
                  className={`flex items-center gap-3 rounded-xl border px-4 py-3 font-semibold ${o.isCorrect ? "border-var bg-ok-bg" : "border-line bg-surface"}`}
                >
                  <span className={`flex h-8 w-8 items-center justify-center rounded-lg font-display ${o.isCorrect ? "bg-var text-bg" : "bg-bezel text-var"}`}>
                    {LETTERS[i]}
                  </span>
                  {o.label}
                  {o.isCorrect && <span className="ml-auto text-xs font-bold uppercase text-var">Correcta</span>}
                </li>
              ))}
            </ul>
          )}

          {q.accepted.length > 0 && (
            <div className="mt-4 rounded-xl border border-line bg-surface p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted">Respuestas aceptadas (texto libre)</p>
              <p className="mt-1 font-semibold">{q.accepted.join(" · ")}</p>
            </div>
          )}

          {q.clues.length > 0 && (
            <>
              <SectionTitle>Pistas, en orden</SectionTitle>
              <ol className="space-y-2">
                {q.clues.map((c, i) => (
                  <li key={i} className="flex gap-3 rounded-xl border border-line bg-surface px-4 py-3 text-sm">
                    <span className="font-display text-var">{i + 1}</span>
                    {c}
                  </li>
                ))}
              </ol>
            </>
          )}

          {q.explanation && (
            <div className="mt-6 rounded-xl border-l-4 border-var bg-surface p-4 text-sm">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted">Dato tras el VAR</p>
              <p className="mt-1">{q.explanation}</p>
            </div>
          )}

          <SectionTitle>Cómo la responden</SectionTitle>
          <div className="rounded-2xl border border-line bg-surface p-5">
            <AccuracyBar correct={q.correct} shown={q.shown} />
            <p className="mt-2 text-xs text-muted">
              {q.shown.toLocaleString("es-ES")} veces mostrada
              {q.avgTimeMs ? ` · ${(q.avgTimeMs / 1000).toFixed(1)} s de media` : ""}. Con menos de 5 respuestas el porcentaje no es fiable.
            </p>
          </div>

          <SectionTitle>Reportes</SectionTitle>
          {q.reports.length ? (
            <ul className="divide-y divide-line/60 rounded-2xl border border-line bg-surface">
              {q.reports.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
                  <div>
                    <p className="font-semibold">{r.reason}</p>
                    <p className="text-xs text-muted">
                      {r.username ? `@${r.username}` : "Anónimo"} · {formatWhen(r.createdAt)} · {r.status === "open" ? "abierto" : r.status === "resolved" ? "resuelto" : "descartado"}
                    </p>
                  </div>
                  {r.status === "open" && <ReportButtons id={r.id} />}
                </li>
              ))}
            </ul>
          ) : (
            <Empty>Nadie ha reportado esta pregunta.</Empty>
          )}
        </div>

        <aside className="space-y-4">
          <QuestionEditForm id={q.id} status={q.status} difficulty={q.difficulty} note={q.reviewNote} />
          <div className="rounded-2xl border border-line bg-surface p-5 text-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted">Fuente</p>
            {q.sourceUrl ? (
              <a href={q.sourceUrl} target="_blank" rel="noopener noreferrer" className="mt-1 block break-all font-semibold text-var hover:underline">
                {q.sourceUrl}
              </a>
            ) : (
              <p className="mt-1 text-ko">Sin fuente registrada: compruébala antes de publicar.</p>
            )}
            <p className="mt-4 text-xs text-muted">
              Creada {formatWhen(q.createdAt)}
              {q.reviewedAt && (
                <>
                  <br />
                  Revisada {formatWhen(q.reviewedAt)}
                  {q.reviewedBy && ` por @${q.reviewedBy}`}
                </>
              )}
            </p>
          </div>
        </aside>
      </div>
    </>
  );
}
