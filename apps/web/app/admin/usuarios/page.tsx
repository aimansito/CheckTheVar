import { Suspense } from "react";
import { Empty, Pager } from "@/components/admin/ui";
import { PAGE_SIZE, listUsers, requireAdmin } from "@/lib/admin";
import { formatWhen } from "@/lib/format";

export const metadata = { title: "Usuarios" };

export default function UsersPage({ searchParams }: PageProps<"/admin/usuarios">) {
  return (
    <>
      <p className="text-sm font-semibold uppercase tracking-wider text-var">Panel de administración</p>
      <h1 className="font-display text-5xl uppercase">Usuarios</h1>
      <Suspense fallback={<p className="mt-6 text-muted">Cargando usuarios…</p>}>
        <Users searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Users({ searchParams }: { searchParams: PageProps<"/admin/usuarios">["searchParams"] }) {
  await requireAdmin();
  const sp = await searchParams;
  const search = typeof sp.q === "string" ? sp.q.slice(0, 60) : "";
  const flagged = sp.marcados === "1";
  const page = Math.min(500, Math.max(1, Number(sp.pagina) || 1));
  const { total, rows } = await listUsers({ search, flagged, page });

  const href = (p: number) => {
    const params = new URLSearchParams();
    if (search) params.set("q", search);
    if (flagged) params.set("marcados", "1");
    if (p > 1) params.set("pagina", String(p));
    return `/admin/usuarios${params.size ? `?${params}` : ""}`;
  };

  return (
    <>
      <form className="mt-6 flex flex-wrap gap-3 rounded-2xl border border-line bg-surface p-4">
        <input
          name="q"
          defaultValue={search}
          placeholder="Buscar por usuario o email"
          className="min-w-56 flex-1 rounded-lg border border-line bg-bg px-3 py-2.5 text-sm outline-none focus:border-var"
        />
        <label className="flex items-center gap-2 text-sm font-semibold">
          <input type="checkbox" name="marcados" value="1" defaultChecked={flagged} className="accent-var" />
          Solo marcados
        </label>
        <button className="rounded-lg bg-var px-5 py-2.5 text-sm font-bold text-bg hover:brightness-110">Buscar</button>
      </form>

      <p className="mt-6 mb-3 text-sm text-muted">
        {total.toLocaleString("es-ES")} {total === 1 ? "usuario" : "usuarios"}
      </p>

      {rows.length ? (
        <div className="overflow-x-auto rounded-2xl border border-line bg-surface">
          <table className="w-full min-w-[46rem] text-sm">
            <thead className="text-left text-xs uppercase tracking-wider text-muted">
              <tr>
                <th className="px-4 py-3 font-semibold">Usuario</th>
                <th className="px-4 py-3 text-right font-semibold">Puntos</th>
                <th className="px-4 py-3 text-right font-semibold">Partidas</th>
                <th className="px-4 py-3 text-right font-semibold">Acierto</th>
                <th className="px-4 py-3 font-semibold">Alta</th>
                <th className="px-4 py-3 font-semibold">Última vez</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line/60">
              {rows.map((u) => (
                <tr key={u.id} className={u.flaggedAt ? "bg-ko-bg/30" : undefined}>
                  <td className="px-4 py-3">
                    <p className="font-semibold">
                      @{u.username}
                      {u.isAdmin && <span className="ml-2 rounded bg-var px-1.5 py-0.5 text-[10px] font-bold uppercase text-bg">Admin</span>}
                      {u.plan === "premium" && <span className="ml-2 rounded border border-var px-1.5 py-0.5 text-[10px] font-bold uppercase text-var">Premium</span>}
                    </p>
                    <p className="text-xs text-muted">{u.email}</p>
                    {u.flaggedAt && <p className="mt-1 text-xs font-semibold text-ko">⚑ {u.flaggedReason ?? "Marcado para revisión"}</p>}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{u.points.toLocaleString("es-ES")}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{u.games.toLocaleString("es-ES")}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{u.accuracy === null ? "—" : `${u.accuracy} %`}</td>
                  <td className="px-4 py-3 text-muted">{formatWhen(u.createdAt)}</td>
                  <td className="px-4 py-3 text-muted">{u.lastSeenAt ? formatWhen(u.lastSeenAt) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty>No hay usuarios con esa búsqueda.</Empty>
      )}

      <Pager page={page} total={total} pageSize={PAGE_SIZE} href={href} />
    </>
  );
}
