/** Vídeos con clip real: pregunta de un modo de juego → CHECK THE VAR → repetición → GOL CONFIRMADO. */
export const FPS = 30;
export const WIPE_FRAMES = 14;
export const COUNTDOWN_FRAMES = 90;
export const SURVIVAL_QUICK = 55;
export const SURVIVAL_FINAL = 45;

export type Segment = { src: string; from: number; to: number; label?: string };
export type Reel = { segments: Segment[] };
export type ValueCard = { name: string; detail: string; value: string };
export type Choice = { prompt: string; options: string[]; correct_index: number };

export type Question =
  | ({ mode: "daily" } & Choice)
  | { mode: "career-path"; prompt: string; clubs: { years: string; club: string }[] }
  | { mode: "guess-player"; prompt: string; clues: string[] }
  | { mode: "survival"; questions: Choice[] }
  | {
      mode: "higher-lower";
      prompt: string;
      reference: ValueCard;
      target: ValueCard;
      /** Valor real del objetivo, que se destapa en la repetición (p. ej. "222 M€"). */
      target_value: string;
      answer: "MÁS" | "MENOS";
    };

/** Sin clips, la respuesta se destapa en la propia interfaz del juego durante estos frames. */
export const REVEAL_FRAMES = 56;
/** Momento (desde el inicio de la repetición) en que la respuesta queda marcada. */
export const REVEAL_LOCK = 34;

export type ClipItem = {
  slug: string;
  mode_label: string;
  hook: string;
  hook_accent?: string;
  category_label: string;
  question: Question;
  answer_title: string;
  explanation_es: string;
  reels: Reel[];
  cta: string;
  source: string;
};

/** Frames desde el inicio de la pregunta hasta que arranca la cuenta atrás. */
export function countdownOffset(q: Question): number {
  switch (q.mode) {
    case "daily":
      return 60;
    case "career-path":
      return 30 + q.clubs.length * 22 + 20;
    case "guess-player":
      return 30 + q.clues.length * 26 + 10;
    case "survival":
      return (q.questions.length - 1) * SURVIVAL_QUICK + SURVIVAL_FINAL;
    case "higher-lower":
      return 70;
  }
}

export const segFrames = (s: Segment) => Math.round((s.to - s.from) * FPS);
export const reelFrames = (r: Reel) => r.segments.reduce((n, s) => n + segFrames(s), 0);

export type Timeline = {
  questionStart: number;
  countdownStart: number;
  reviewStart: number;
  buttonPress: number;
  overlayStart: number;
  clipStart: number;
  reelStarts: number[];
  reelLengths: number[];
  clipEnd: number;
  freezeStart: number;
  verdictStart: number;
  outroStart: number;
  total: number;
};

export function timeline(item: ClipItem): Timeline {
  const questionStart = 45;
  const countdownStart = questionStart + countdownOffset(item.question);
  const reviewStart = countdownStart + COUNTDOWN_FRAMES;
  const buttonPress = reviewStart + 9;
  const overlayStart = reviewStart + 17;
  const clipStart = overlayStart + 26;
  const reelStarts: number[] = [];
  const reelLengths: number[] = [];
  let f = clipStart;
  for (const reel of item.reels) {
    reelStarts.push(f);
    const n = reelFrames(reel);
    reelLengths.push(n);
    f += n;
  }
  if (item.reels.length === 0) {
    reelStarts.push(clipStart);
    reelLengths.push(REVEAL_FRAMES);
    f += REVEAL_FRAMES;
  }
  const clipEnd = f;
  const freezeStart = clipEnd - 1;
  const verdictStart = freezeStart + 8;
  const outroStart = freezeStart + 100;
  return {
    questionStart,
    countdownStart,
    reviewStart,
    buttonPress,
    overlayStart,
    clipStart,
    reelStarts,
    reelLengths,
    clipEnd,
    freezeStart,
    verdictStart,
    outroStart,
    total: outroStart + 75,
  };
}

const MODES = ["daily", "career-path", "guess-player", "survival", "higher-lower"];

/** Valida un vídeo del lote. Lanza un error legible si algo no cuadra. */
export function assertClipItem(value: unknown): ClipItem {
  const v = value as Partial<ClipItem>;
  const errors: string[] = [];
  if (typeof v.slug !== "string" || !/^[a-z0-9-]+$/.test(v.slug)) errors.push("slug");
  if (typeof v.hook !== "string" || v.hook.length === 0) errors.push("hook");
  if (typeof v.mode_label !== "string") errors.push("mode_label");
  if (typeof v.category_label !== "string") errors.push("category_label");
  if (!v.question || !MODES.includes(v.question.mode)) errors.push("question.mode");
  if (typeof v.answer_title !== "string") errors.push("answer_title");
  if (typeof v.explanation_es !== "string" || v.explanation_es.length > 140) errors.push("explanation_es (≤140)");
  if (!Array.isArray(v.reels)) errors.push("reels");
  for (const reel of v.reels ?? []) {
    if (!Array.isArray(reel.segments) || reel.segments.length === 0) errors.push("reels[].segments");
    for (const s of reel.segments ?? []) {
      if (typeof s.src !== "string" || !(s.from >= 0) || !(s.to > s.from)) errors.push(`segment ${s.src}`);
    }
  }
  if (typeof v.cta !== "string") errors.push("cta");
  if (errors.length) throw new Error(`Vídeo inválido (${v.slug ?? "?"}): ${errors.join(", ")}`);
  return v as ClipItem;
}
