import { adminQuestionFiltersSchema, QUESTION_STATUSES, type AdminQuestionFilters } from "@checkthevar/shared";
import Link from "next/link";
import { Suspense } from "react";
import { AccuracyBar, Empty, KIND_LABELS, Pager, STATUS_LABELS, StatusBadge } from "@/components/admin/ui";
import { setQuestionStatus } from "@/lib/admin-actions";
import { PAGE_SIZE, listQuestions, requireAdmin } from "@/lib/admin";

export const metadata = { title: "Preguntas" };

const ORDERS = { recientes: "Más recientes", dificiles: "Menos acertadas", faciles: "Más acertadas", reportadas: "Más reportadas" };

export default function QuestionsPage({ searchParams }: PageProps<"/admin/preguntas">) {
  return (
    <>
      <p className="text-sm font-semibold uppercase tracking-wider text-var">Panel de administración</p>
      <h1 className="font-display text-5xl uppercase">Preguntas</h1>
      <Suspense fallback={<p className="mt-6 text-muted">Cargando preguntas…</p>}>
        <Questions searchParams={searchParams} />
      </Suspense>
    </>
  );
}

function hrefWith(f: AdminQuestionFilters, patch: Partial<AdminQuestionFilters>): string {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...f, ...patch })) if (v !== undefined && v !== "") params.set(k, String(v));
  const qs = params.toString();
  return `/admin/preguntas${qs ? `?${qs}` : ""}`;
}

async function Questions({ searchParams }: { searchParams: PageProps<"/admin/preguntas">["searchParams"] }) {
  await requireAdmin();
  const f = adminQuestionFiltersSchema.parse(await searchParams);
  const { total, rows } = await listQuestions(f);

  return (
    <>
      {/* Filtros (GET: la URL se puede compartir y volver atrás funciona) */}
      <form className="mt-6 grid gap-3 rounded-2xl border border-line bg-surface p-4 sm:grid-cols-2 lg:grid-cols-[1fr_auto_auto_auto_auto]">
        <input
          name="q"
          defaultValue={f.q}
          placeholder="Buscar en el enunciado o por número"
          className="rounded-lg border border-line bg-bg px-3 py-2.5 text-sm outline-none focus:border-var"
        />
        <select name="estado" defaultValue={f.estado ?? ""} className="rounded-lg border border-line bg-bg px-3 py-2.5 text-sm">
          <option value="">Todos los estados</option>
          {QUESTION_STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]}
            </option>
          ))}
        </select>
        <select name="tipo" defaultValue={f.tipo ?? ""} className="rounded-lg border border-line bg-bg px-3 py-2.5 text-sm">
          <option value="">Todos los tipos</option>
          {Object.entries(KIND_LABELS).map(([k, label]) => (
            <option key={k} value={k}>
              {label}
            </option>
          ))}
        </select>
        <select name="orden" defaultValue={f.orden ?? "recientes"} className="rounded-lg border border-line bg-bg px-3 py-2.5 text-sm">
          {Object.entries(ORDERS).map(([k, label]) => (
            <option key={k} value={k}>
              {label}
            </option>
          ))}
        </select>
        <button className="rounded-lg bg-var px-5 py-2.5 text-sm font-bold text-bg hover:brightness-110">Filtrar</button>
      </form>

      <div className="mt-6 mb-3 flex flex-wrap items-center justify-between gap-2 text-sm">
        <p className="text-muted">
          {total.toLocaleString("es-ES")} {total === 1 ? "pregunta" : "preguntas"}
        </p>
        <div className="flex flex-wrap gap-2">
          {QUESTION_STATUSES.map((s) => (
            <Link
              key={s}
              href={hrefWith(f, { estado: f.estado === s ? undefined : s, pagina: undefined })}
              className={`rounded-full border px-3 py-1 font-semibold ${f.estado === s ? "border-var text-var" : "border-line text-muted hover:text-text"}`}
            >
              {STATUS_LABELS[s]}
            </Link>
          ))}
        </div>
      </div>

      {rows.length ? (
        <ul className="divide-y divide-line/60 rounded-2xl border border-line bg-surface">
          {rows.map((q) => (
            <li key={q.id} className="grid gap-3 px-4 py-4 lg:grid-cols-[1fr_11rem_auto] lg:items-center">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                  <span className="font-mono">#{q.id}</span>
                  <StatusBadge status={q.status} />
                  <span>{KIND_LABELS[q.kind] ?? q.kind}</span>
                  <span>· dificultad {q.difficulty}</span>
                  {q.era_to && <span>· {q.era_from && q.era_from !== q.era_to ? `${q.era_from}–${q.era_to}` : q.era_to}</span>}
                  {q.reports > 0 && <span className="font-bold text-ko">· ⚑ {q.reports}</span>}
                </div>
                <Link href={`/admin/preguntas/${q.id}`} className="mt-1 block font-semibold hover:underline">
                  {q.prompt ?? "(sin enunciado en español)"}
                </Link>
                <p className="text-sm text-muted">
                  Respuesta: <span className="text-text">{q.answer ?? "—"}</span>
                </p>
                {q.review_note && <p className="mt-1 text-xs text-amber-300">Nota: {q.review_note}</p>}
              </div>
              <AccuracyBar correct={q.correct} shown={q.shown} />
              <div className="flex gap-2">
                {q.status !== "published" && <QuickStatus id={q.id} status="published" label="Publicar" />}
                {q.status !== "retired" && <QuickStatus id={q.id} status="retired" label="Retirar" danger />}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <Empty>No hay preguntas con esos filtros.</Empty>
      )}

      <Pager page={f.pagina ?? 1} total={total} pageSize={PAGE_SIZE} href={(p) => hrefWith(f, { pagina: p })} />
    </>
  );
}

function QuickStatus({ id, status, label, danger }: { id: number; status: string; label: string; danger?: boolean }) {
  return (
    <form action={setQuestionStatus}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="status" value={status} />
      <button
        className={`rounded-lg border px-3 py-1.5 text-sm font-bold ${danger ? "border-line text-muted hover:border-ko hover:text-ko" : "border-var/60 text-var hover:bg-var hover:text-bg"}`}
      >
        {label}
      </button>
    </form>
  );
}
