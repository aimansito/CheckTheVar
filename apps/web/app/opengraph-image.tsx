import { ImageResponse } from "next/og";

export const alt = "CHECK THE VAR — Quiz de fútbol";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Imagen al compartir la web en WhatsApp, X, Telegram, etc. */
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px",
          background: "#0A0D0B",
          color: "#FFFFFF",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 24, fontSize: 64, fontWeight: 900, letterSpacing: 2 }}>
          CHECK THE
          <span style={{ display: "flex", border: "6px solid #39E27A", borderRadius: 16, padding: "4px 20px", color: "#39E27A" }}>VAR</span>
        </div>
        <div style={{ marginTop: 48, fontSize: 84, fontWeight: 900, lineHeight: 1.05 }}>¿Sabes de fútbol?</div>
        <div style={{ fontSize: 84, fontWeight: 900, lineHeight: 1.05, color: "#39E27A" }}>Que lo diga el VAR.</div>
        <div style={{ marginTop: 40, fontSize: 32, color: "#A9B5AE" }}>Reto diario · Supervivencia · Contrarreloj · Ligas con amigos</div>
      </div>
    ),
    size,
  );
}
