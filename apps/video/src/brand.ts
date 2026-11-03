import { loadFont as loadAnton } from "@remotion/google-fonts/Anton";
import { loadFont as loadInter } from "@remotion/google-fonts/Inter";

const anton = loadAnton("normal", { weights: ["400"], subsets: ["latin", "latin-ext"] });
const inter = loadInter("normal", {
  weights: ["500", "600", "700", "800"],
  subsets: ["latin", "latin-ext"],
});

export const fonts = {
  display: anton.fontFamily,
  body: inter.fontFamily,
};

/** Tokens de la skill marca-ui. */
export const colors = {
  bg: "#0A0D0B",
  surface: "#111613",
  bezel: "#1C2420",
  line: "#2C3832",
  screen: "#04110A",
  text: "#F4F7F5",
  textMuted: "#B7C2BC",
  varGreen: "#39E27A",
  goalOkBg: "#12391F",
  goalKo: "#F87171",
  goalKoBg: "#3A1414",
};

export const VIDEO = { width: 1080, height: 1920, fps: 30, durationInFrames: 450 };

/** Línea de tiempo en frames (30 fps), según la skill video-tiktok. */
export const T = {
  questionStart: 45, // 1,5 s
  countdownStart: 105, // 3,5 s
  reviewStart: 255, // 8,5 s
  buttonPress: 264,
  overlayStart: 272,
  answerStart: 300, // 10 s
  outroStart: 390, // 13 s
};

/** Zona segura de TikTok: 150 px arriba, 250 px abajo, 120 px a la derecha. */
export const SAFE = { top: 150, bottom: 250, right: 120, left: 80 };
export const CONTENT_WIDTH = VIDEO.width - SAFE.left - SAFE.right; // 880
