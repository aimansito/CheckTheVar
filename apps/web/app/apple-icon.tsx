import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/** Icono para la pantalla de inicio de iOS: el tick verde del VAR. */
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#0A0D0B" }}>
        <svg width="120" height="120" viewBox="0 0 64 64">
          <path d="M14 33.5 27 46 50 20" fill="none" stroke="#39E27A" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    ),
    size,
  );
}
