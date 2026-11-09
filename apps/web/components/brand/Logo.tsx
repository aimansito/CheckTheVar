import Link from "next/link";

type Size = "sm" | "header" | "md" | "lg";

const SIZES: Record<Size, { text: string; screen: string; var: string; gap: string }> = {
  sm: { text: "text-[15px] leading-[0.95]", screen: "w-12 h-8", var: "text-base", gap: "gap-2" },
  header: {
    text: "text-[20px] sm:text-[26px] leading-[0.92]",
    screen: "w-16 h-11 sm:w-[84px] sm:h-14",
    var: "text-xl sm:text-[28px]",
    gap: "gap-2.5 sm:gap-3",
  },
  md: { text: "text-2xl leading-[0.95]", screen: "w-20 h-13", var: "text-2xl", gap: "gap-3" },
  lg: { text: "text-6xl leading-[0.95]", screen: "w-44 h-28", var: "text-6xl", gap: "gap-5" },
};

/** Logo principal: "CHECK / THE" + monitor con "VAR". */
export function Logo({ size = "sm", href = "/" }: { size?: Size; href?: string | null }) {
  const s = SIZES[size];
  const content = (
    <span className={`inline-flex items-center ${s.gap}`} aria-label="CHECK THE VAR">
      <span className={`font-display text-text ${s.text}`} aria-hidden>
        CHECK
        <br />
        THE
      </span>
      <VarMonitor className={s.screen} stand={size === "md" || size === "lg"}>
        <span className={`font-display text-var text-glow ${s.var}`} aria-hidden>
          VAR
        </span>
      </VarMonitor>
    </span>
  );
  return href ? (
    <Link href={href} className="inline-flex shrink-0">
      {content}
    </Link>
  ) : (
    content
  );
}

/** Monitor del VAR: marco, pantalla con escaneo y cuatro esquinas verdes. */
export function VarMonitor({
  children,
  className = "",
  stand = true,
}: {
  children: React.ReactNode;
  className?: string;
  stand?: boolean;
}) {
  return (
    <span className="inline-flex flex-col items-center">
      <span
        className={`relative flex items-center justify-center rounded-[10%] border border-line bg-bezel p-[5%] ${className}`}
      >
        <span className="scanlines relative flex h-full w-full items-center justify-center overflow-hidden rounded-[8%] bg-screen">
          <Corners />
          {children}
        </span>
      </span>
      {stand && (
        <>
          <span className="h-[6px] w-[18%] min-w-3 bg-bezel" />
          <span className="h-[4px] w-[55%] min-w-8 rounded-full bg-line" />
        </>
      )}
    </span>
  );
}

export function Corners({ className = "" }: { className?: string }) {
  const c = "pointer-events-none absolute h-[22%] w-[14%] border-var";
  return (
    <span aria-hidden className={className}>
      <span className={`${c} left-[7%] top-[9%] border-l-2 border-t-2`} />
      <span className={`${c} right-[7%] top-[9%] border-r-2 border-t-2`} />
      <span className={`${c} bottom-[9%] left-[7%] border-b-2 border-l-2`} />
      <span className={`${c} bottom-[9%] right-[7%] border-b-2 border-r-2`} />
    </span>
  );
}
