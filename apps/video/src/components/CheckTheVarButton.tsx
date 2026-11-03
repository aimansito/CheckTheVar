import { colors, fonts } from "../brand";

/** Botón de marca: fondo claro, "CHECK THE" oscuro + pastilla "VAR" verde. pressed: 0–1. */
export const CheckTheVarButton: React.FC<{ scale?: number; pressed?: number }> = ({
  scale = 1,
  pressed = 0,
}) => {
  const s = (n: number) => n * scale;
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: s(22),
        background: colors.text,
        borderRadius: s(26),
        padding: `${s(22)}px ${s(24)}px ${s(22)}px ${s(44)}px`,
        transform: `translateY(${pressed * s(10)}px) scale(${1 - pressed * 0.05})`,
        boxShadow: `0 ${s(12) * (1 - pressed)}px 0 #8F9A94, 0 0 ${s(80) * pressed}px rgba(57,226,122,${0.7 * pressed})`,
      }}
    >
      <span style={{ fontFamily: fonts.display, fontSize: s(80), color: colors.bg, lineHeight: 1.05 }}>
        CHECK THE
      </span>
      <span
        style={{
          fontFamily: fonts.display,
          fontSize: s(80),
          lineHeight: 1.05,
          color: colors.varGreen,
          background: colors.screen,
          borderRadius: s(14),
          padding: `${s(6)}px ${s(24)}px`,
          textShadow: `0 0 ${s(14)}px rgba(57,226,122,0.6)`,
        }}
      >
        VAR
      </span>
    </div>
  );
};
