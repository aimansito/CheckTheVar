import { resolveReport } from "@/lib/admin-actions";

/** Cerrar un reporte abierto. */
export function ReportButtons({ id }: { id: number }) {
  return (
    <div className="flex gap-2">
      {(["resolved", "dismissed"] as const).map((resolution) => (
        <form key={resolution} action={resolveReport}>
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="resolution" value={resolution} />
          <button
            className={`rounded-lg border px-3 py-1.5 text-xs font-bold ${
              resolution === "resolved" ? "border-var/60 text-var hover:bg-var hover:text-bg" : "border-line text-muted hover:text-text"
            }`}
          >
            {resolution === "resolved" ? "Resuelto" : "Descartar"}
          </button>
        </form>
      ))}
    </div>
  );
}
