import Link from "next/link";

export const STATUS_LABELS: Record<string, string> = {
  draft: "Borrador",
  review: "En revisión",
  published: "Publicada",
  retired: "Retirada",
};

export const KIND_LABELS: Record<string, string> = {
  quiz: "Test",
  higher_lower: "Más o menos",
  guess_player: "Adivina el jugador",
  career_path: "Trayectoria",
};

const STATUS_STYLES: Record<string, string> = {
  draft: "border-line text-muted",
  review: "border-amber-400/60 text-amber-300",
  published: "border-var/60 text-var",
  retired: "border-ko/50 text-ko",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex shrink-0 rounded-md border px-2 py-0.5 text-xs font-bold uppercase tracking-wide ${STATUS_STYLES[status] ?? "border-line text-muted"}`}>
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}

export function StatCard({ label, value, hint, href }: { label: string; value: string | number; hint?: string; href?: string }) {
  const body = (
    <>
      <p className="text-xs font-semibold uppercase tracking-wider text-muted">{label}</p>
      <p className="mt-1 font-display text-4xl text-var">{typeof value === "number" ? value.toLocaleString("es-ES") : value}</p>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </>
  );
  const cls = "block rounded-2xl border border-line bg-surface p-5";
  return href ? (
    <Link href={href} className={`${cls} transition hover:border-var`}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

/** Porcentaje de acierto con barra. Por debajo de 5 respuestas no es fiable y se indica. */
export function AccuracyBar({ correct, shown }: { correct: number; shown: number }) {
  if (shown === 0) return <span className="text-xs text-muted">Sin datos</span>;
  const pct = Math.round((correct / shown) * 100);
  const color = pct < 25 ? "bg-ko" : pct < 50 ? "bg-amber-400" : "bg-var";
  return (
    <div className="flex min-w-28 items-center gap-2">
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-bezel" aria-hidden>
        <div className={`h-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className={`w-16 text-right text-xs font-semibold tabular-nums ${shown < 5 ? "text-muted" : ""}`} title={`${correct} de ${shown}`}>
        {pct} % <span className="text-muted">({shown})</span>
      </span>
    </div>
  );
}

export function SectionTitle({ children, aside }: { children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <div className="mt-10 mb-4 flex flex-wrap items-end justify-between gap-2">
      <h2 className="font-display text-3xl uppercase">{children}</h2>
      {aside}
    </div>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="rounded-xl border border-dashed border-line p-5 text-sm text-muted">{children}</p>;
}

export function Pager({ page, total, pageSize, href }: { page: number; total: number; pageSize: number; href: (p: number) => string }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages === 1) return null;
  return (
    <nav className="mt-6 flex items-center justify-between text-sm font-semibold" aria-label="Paginación">
      {page > 1 ? (
        <Link href={href(page - 1)} className="rounded-lg border border-line px-4 py-2 hover:border-var">
          ← Anterior
        </Link>
      ) : (
        <span />
      )}
      <span className="text-muted">
        Página {page} de {pages}
      </span>
      {page < pages ? (
        <Link href={href(page + 1)} className="rounded-lg border border-line px-4 py-2 hover:border-var">
          Siguiente →
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}
