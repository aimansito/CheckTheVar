import Link from "next/link";
import { Suspense } from "react";
import { ReportButtons } from "@/components/admin/ReportButtons";
import { Empty, StatusBadge } from "@/components/admin/ui";
import { listReports, requireAdmin } from "@/lib/admin";
import { formatWhen } from "@/lib/format";

export const metadata = { title: "Reportes" };

export default function ReportsPage({ searchParams }: PageProps<"/admin/reportes">) {
  return (
    <>
      <p className="text-sm font-semibold uppercase tracking-wider text-var">Panel de administración</p>
      <h1 className="font-display text-5xl uppercase">Reportes</h1>
      <p className="mt-1 text-sm text-muted">Avisos de los jugadores sobre preguntas con datos erróneos o desactualizados.</p>
      <Suspense fallback={<p className="mt-6 text-muted">Cargando reportes…</p>}>
        <Reports searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Reports({ searchParams }: { searchParams: PageProps<"/admin/reportes">["searchParams"] }) {
  await requireAdmin();
  const closed = (await searchParams).ver === "cerrados";
  const reports = await listReports(closed ? "closed" : "open");

  return (
    <>
      <div className="mt-6 mb-4 flex gap-2 text-sm font-semibold">
        <Link href="/admin/reportes" className={`rounded-full border px-4 py-1.5 ${!closed ? "border-var text-var" : "border-line text-muted"}`}>
          Abiertos
        </Link>
        <Link href="/admin/reportes?ver=cerrados" className={`rounded-full border px-4 py-1.5 ${closed ? "border-var text-var" : "border-line text-muted"}`}>
          Cerrados
        </Link>
      </div>
      {reports.length ? (
        <ul className="divide-y divide-line/60 rounded-2xl border border-line bg-surface">
          {reports.map((r) => (
            <li key={r.id} className="grid gap-3 px-4 py-4 md:grid-cols-[1fr_auto] md:items-center">
              <div className="min-w-0">
                <p className="font-semibold text-ko">⚑ {r.reason}</p>
                <Link href={`/admin/preguntas/${r.questionId}`} className="mt-1 block hover:underline">
                  <span className="font-mono text-xs text-muted">#{r.questionId}</span> {r.prompt ?? "(pregunta sin enunciado)"}
                </Link>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted">
                  {r.questionStatus && <StatusBadge status={r.questionStatus} />}
                  <span>
                    {r.username ? `@${r.username}` : "Anónimo"} · {formatWhen(r.createdAt)}
                  </span>
                  {closed && <span>· {r.status === "resolved" ? "resuelto" : "descartado"}</span>}
                </div>
              </div>
              {!closed && (
                <div className="flex flex-wrap items-center gap-2">
                  <Link href={`/admin/preguntas/${r.questionId}`} className="rounded-lg border border-line px-3 py-1.5 text-xs font-bold hover:border-var">
                    Revisar pregunta
                  </Link>
                  <ReportButtons id={r.id} />
                </div>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <Empty>{closed ? "Aún no se ha cerrado ningún reporte." : "No hay reportes abiertos. Todo en orden."}</Empty>
      )}
    </>
  );
}
