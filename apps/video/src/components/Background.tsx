import { AbsoluteFill, useCurrentFrame } from "remotion";
import { Scanlines } from "./Logo";

/** Fondo de marca: brillo verde a la deriva, líneas de campo sutiles y scanlines. */
export const Background: React.FC = () => {
  const frame = useCurrentFrame();
  const drift = Math.sin(frame / 40) * 30;
  return (
    <AbsoluteFill>
      <div
        style={{
          position: "absolute",
          width: 1400,
          height: 1400,
          left: -520 + drift,
          top: -620,
          background: "radial-gradient(circle, rgba(57,226,122,0.16) 0%, rgba(57,226,122,0) 62%)",
        }}
      />
      <div
        style={{
          position: "absolute",
          width: 1200,
          height: 1200,
          right: -600 - drift,
          bottom: -500,
          background: "radial-gradient(circle, rgba(57,226,122,0.08) 0%, rgba(57,226,122,0) 60%)",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 540 - 330,
          top: 960 - 330,
          width: 660,
          height: 660,
          borderRadius: "50%",
          border: "3px solid rgba(244,247,245,0.035)",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 958,
          height: 3,
          background: "rgba(244,247,245,0.035)",
        }}
      />
      <Scanlines opacity={0.35} />
    </AbsoluteFill>
  );
};
