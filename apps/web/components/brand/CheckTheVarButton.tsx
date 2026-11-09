/** Botón de marca para comprobar una respuesta. Siempre "CHECK THE VAR". */
export function CheckTheVarButton({
  disabled,
  onClick,
  size = "md",
}: {
  disabled?: boolean;
  onClick?: () => void;
  size?: "sm" | "md";
}) {
  const text = size === "sm" ? "text-lg" : "text-2xl sm:text-3xl";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`group inline-flex min-h-11 items-center justify-center gap-3 rounded-2xl bg-text px-6 py-3 font-display ${text} text-bg shadow-[0_6px_0_#8f9a94] transition active:translate-y-1 active:shadow-[0_2px_0_#8f9a94] disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none enabled:hover:shadow-[0_6px_0_#8f9a94,0_0_40px_rgba(57,226,122,0.35)]`}
    >
      CHECK THE
      <span className="rounded-lg bg-screen px-3 py-0.5 text-var text-glow">VAR</span>
    </button>
  );
}
