import { Suspense } from "react";
import { Empty } from "@/components/admin/ui";
import { listLeagues, requireAdmin } from "@/lib/admin";
import { formatWhen } from "@/lib/format";

export const metadata = { title: "Ligas" };

export default function LeaguesPage() {
  return (
    <>
      <p className="text-sm font-semibold uppercase tracking-wider text-var">Panel de administración</p>
      <h1 className="font-display text-5xl uppercase">Ligas</h1>
      <Suspense fallback={<p className="mt-6 text-muted">Cargando ligas…</p>}>
        <Leagues />
      </Suspense>
    </>
  );
}

async function Leagues() {
  await requireAdmin();
  const leagues = await listLeagues();
  const members = leagues.reduce((n, l) => n + l.members, 0);

  return (
    <>
      <p className="mt-6 mb-3 text-sm text-muted">
        {leagues.length} {leagues.length === 1 ? "liga" : "ligas"} · {members} miembros · media de{" "}
        {leagues.length ? (members / leagues.length).toFixed(1) : 0} por liga
      </p>
      {leagues.length ? (
        <div className="overflow-x-auto rounded-2xl border border-line bg-surface">
          <table className="w-full min-w-[40rem] text-sm">
            <thead className="text-left text-xs uppercase tracking-wider text-muted">
              <tr>
                <th className="px-4 py-3 font-semibold">Liga</th>
                <th className="px-4 py-3 font-semibold">Formato</th>
                <th className="px-4 py-3 text-right font-semibold">Miembros</th>
                <th className="px-4 py-3 font-semibold">Creada</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line/60">
              {leagues.map((l) => (
                <tr key={l.id}>
                  <td className="px-4 py-3">
                    <p className="font-semibold">{l.name}</p>
                    <p className="text-xs text-muted">
                      {l.owner ? `de @${l.owner}` : "—"} · {l.visibility === "public" ? "pública" : "privada"}
                    </p>
                  </td>
                  <td className="px-4 py-3">{l.format === "head_to_head" ? "Cara a cara" : "Por puntos"}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{l.members}</td>
                  <td className="px-4 py-3 text-muted">{formatWhen(l.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty>Todavía no se ha creado ninguna liga.</Empty>
      )}
    </>
  );
}
