import { colors, fonts } from "../brand";

/** Logo principal: "CHECK / THE" + monitor del VAR. A scale = 1 mide ≈ 560 px de ancho. */
export const Logo: React.FC<{ scale?: number; glow?: number }> = ({ scale = 1, glow = 1 }) => {
  const s = (n: number) => n * scale;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: s(26) }}>
      <div
        style={{
          fontFamily: fonts.display,
          color: colors.text,
          fontSize: s(118),
          lineHeight: 0.98,
          letterSpacing: s(1),
        }}
      >
        <div>CHECK</div>
        <div>THE</div>
      </div>
      <VarMonitor width={s(290)} glow={glow} />
    </div>
  );
};

type MonitorProps = {
  width: number;
  height?: number;
  glow?: number;
  children?: React.ReactNode;
  showStand?: boolean;
};

/** Monitor del VAR: marco, pantalla con líneas de escaneo, esquinas verdes y pie. */
export const VarMonitor: React.FC<MonitorProps> = ({
  width,
  height,
  glow = 1,
  children,
  showStand = true,
}) => {
  const h = height ?? width * 0.66;
  const u = width / 300;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      <div
        style={{
          width,
          height: h,
          background: colors.bezel,
          borderRadius: 18 * u,
          padding: 12 * u,
          border: `${2 * u}px solid ${colors.line}`,
          boxSizing: "border-box",
        }}
      >
        <div
          style={{
            position: "relative",
            width: "100%",
            height: "100%",
            background: colors.screen,
            borderRadius: 10 * u,
            overflow: "hidden",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Scanlines />
          <Corners size={26 * u} thickness={3 * u} inset={14 * u} />
          {children ?? (
            <span
              style={{
                fontFamily: fonts.display,
                fontSize: 120 * u,
                color: colors.varGreen,
                letterSpacing: 4 * u,
                textShadow: `0 0 ${18 * u * glow}px rgba(57,226,122,${0.55 * glow})`,
                position: "relative",
              }}
            >
              VAR
            </span>
          )}
        </div>
      </div>
      {showStand && (
        <>
          <div style={{ width: 52 * u, height: 24 * u, background: colors.bezel }} />
          <div
            style={{ width: 180 * u, height: 12 * u, background: colors.line, borderRadius: 8 * u }}
          />
        </>
      )}
    </div>
  );
};

export const Scanlines: React.FC<{ opacity?: number }> = ({ opacity = 0.5 }) => (
  <div
    style={{
      position: "absolute",
      inset: 0,
      opacity,
      background:
        "repeating-linear-gradient(to bottom, rgba(255,255,255,0.045) 0px, rgba(255,255,255,0.045) 2px, transparent 2px, transparent 6px)",
      pointerEvents: "none",
    }}
  />
);

export const Corners: React.FC<{
  size: number;
  thickness: number;
  inset: number;
  color?: string;
}> = ({ size, thickness, inset, color = colors.varGreen }) => {
  const base: React.CSSProperties = { position: "absolute", width: size, height: size };
  const b = `${thickness}px solid ${color}`;
  return (
    <>
      <div style={{ ...base, top: inset, left: inset, borderTop: b, borderLeft: b }} />
      <div style={{ ...base, top: inset, right: inset, borderTop: b, borderRight: b }} />
      <div style={{ ...base, bottom: inset, left: inset, borderBottom: b, borderLeft: b }} />
      <div style={{ ...base, bottom: inset, right: inset, borderBottom: b, borderRight: b }} />
    </>
  );
};
