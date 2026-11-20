import { Easing, interpolate, interpolateColors, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { CONTENT_WIDTH, SAFE, colors, fonts } from "./brand";
import {
  SURVIVAL_FINAL,
  SURVIVAL_QUICK,
  type Choice,
  type ClipItem,
  type Question,
  type ValueCard,
} from "./clipTypes";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const LETTERS = ["A", "B", "C"];
const TOP = 360;

/** revealAt: frame en que la respuesta queda marcada (solo en la repetición). */
type PhaseProps<Q> = { q: Q; start: number; category: string; revealAt?: number };

/** Fase de pregunta de cada modo de juego. Todo cabe entre los 360 px y los 1340 px de alto. */
export const ModePhase: React.FC<{ item: ClipItem; start: number; revealAt?: number }> = ({ item, start, revealAt }) => {
  const frame = useCurrentFrame();
  if (frame < start) return null;
  const q = item.question;
  const common = { start, category: item.category_label, revealAt };
  switch (q.mode) {
    case "daily":
      return <DailyPhase q={q} {...common} />;
    case "career-path":
      return <CareerPhase q={q} {...common} />;
    case "guess-player":
      return <GuessPhase q={q} {...common} />;
    case "survival":
      return <SurvivalPhase q={q} {...common} />;
    case "higher-lower":
      return <HigherLowerPhase q={q} {...common} />;
  }
};

/* ───────────────────────── Piezas comunes ───────────────────────── */

const Column: React.FC<{ children: React.ReactNode; top?: number }> = ({ children, top = TOP }) => (
  <div
    style={{
      position: "absolute",
      top,
      left: SAFE.left,
      width: CONTENT_WIDTH,
      display: "flex",
      flexDirection: "column",
    }}
  >
    {children}
  </div>
);

const Panel: React.FC<{ enterFrame: number; label: string; children: React.ReactNode }> = ({
  enterFrame,
  label,
  children,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame: frame - enterFrame, fps, config: { damping: 15 } });
  return (
    <div
      style={{
        background: colors.surface,
        border: `3px solid ${colors.line}`,
        borderRadius: 30,
        padding: "32px 44px 36px",
        marginBottom: 18,
        opacity: enter,
        transform: `translateY(${(1 - enter) * 80}px) scale(${0.94 + 0.06 * enter})`,
        boxShadow: "0 30px 80px rgba(0,0,0,0.45)",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 10, background: colors.varGreen }} />
      <div
        style={{
          fontFamily: fonts.display,
          fontSize: 44,
          color: colors.varGreen,
          letterSpacing: 2,
          marginBottom: 14,
          textTransform: "uppercase",
        }}
      >
        {label}
      </div>
      {children}
    </div>
  );
};

const Prompt: React.FC<{ children: React.ReactNode; size?: number }> = ({ children, size = 62 }) => (
  <div style={{ fontWeight: 800, fontSize: size, lineHeight: 1.13, letterSpacing: -0.5 }}>{children}</div>
);

const Check: React.FC<{ size: number; scale?: number }> = ({ size, scale = 1 }) => (
  <div
    style={{
      width: size,
      height: size,
      flexShrink: 0,
      borderRadius: 999,
      background: colors.varGreen,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      transform: `scale(${scale})`,
      boxShadow: "0 0 20px rgba(57,226,122,0.6)",
    }}
  >
    <svg width={size * 0.6} height={size * 0.6} viewBox="0 0 24 24">
      <path d="M4 12.5l5 5L20 6.5" fill="none" stroke={colors.bg} strokeWidth="3.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  </div>
);

/** Línea láser del VAR: barre las opciones y se detiene en la correcta. */
const Laser: React.FC<{ ys: number[]; target: number; revealAt: number }> = ({ ys, target, revealAt }) => {
  const frame = useCurrentFrame();
  const y = interpolate(frame, [revealAt - 28, revealAt - 12, revealAt], [ys[0], ys[ys.length - 1], ys[target]], {
    ...clamp,
    easing: Easing.inOut(Easing.cubic),
  });
  const opacity = interpolate(frame, [revealAt - 30, revealAt - 26, revealAt + 4, revealAt + 14], [0, 1, 1, 0], clamp);
  return (
    <div
      style={{
        position: "absolute",
        left: -30,
        width: CONTENT_WIDTH + 60,
        top: y - 4,
        height: 8,
        borderRadius: 4,
        background: colors.varGreen,
        boxShadow: "0 0 40px 10px rgba(57,226,122,0.55)",
        opacity,
      }}
    />
  );
};

type OptionState = "idle" | "correct" | "dim";

const Option: React.FC<{
  index: number;
  label: string;
  enterFrame: number;
  state?: OptionState;
  revealFrame?: number;
  height?: number;
}> = ({ index, label, enterFrame, state = "idle", revealFrame, height = 120 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame: frame - enterFrame, fps, config: { damping: 14 } });
  const r =
    revealFrame !== undefined && state !== "idle"
      ? spring({ frame: frame - revealFrame, fps, config: { damping: 11, stiffness: 140 } })
      : 0;
  const correct = state === "correct";
  const bg = correct ? interpolateColors(r, [0, 1], [colors.surface, colors.goalOkBg]) : colors.surface;
  const border = correct ? interpolateColors(r, [0, 1], [colors.line, colors.varGreen]) : colors.line;
  const dim = state === "dim" ? interpolate(r, [0, 1], [1, 0.35]) : 1;
  const pulse = correct ? 1 + 0.05 * Math.sin(Math.min(r, 1) * Math.PI) : 1;
  const fontSize = Math.round(height * 0.45);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 28,
        height,
        marginTop: 20,
        boxSizing: "border-box",
        padding: "0 30px 0 22px",
        background: bg,
        border: `4px solid ${border}`,
        borderRadius: 24,
        opacity: enter * dim,
        transform: `translateX(${(1 - enter) * 160}px) scale(${pulse})`,
        boxShadow: correct ? `0 0 ${50 * r}px rgba(57,226,122,${0.35 * r})` : "none",
      }}
    >
      <div
        style={{
          width: height * 0.66,
          height: height * 0.66,
          flexShrink: 0,
          borderRadius: 18,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: fonts.display,
          fontSize: fontSize,
          background: correct && r > 0.5 ? colors.varGreen : colors.bezel,
          color: correct && r > 0.5 ? colors.bg : colors.varGreen,
        }}
      >
        {LETTERS[index]}
      </div>
      <div style={{ flex: 1, fontWeight: 700, fontSize, lineHeight: 1.1 }}>{label}</div>
      {correct && r > 0 && <Check size={60} scale={r} />}
    </div>
  );
};

/** Opciones A/B/C; con revealAt, el láser las barre y marca la correcta. */
const ChoiceOptions: React.FC<{ choice: Choice; start: number; step: number; height: number; revealAt?: number }> = ({
  choice,
  start,
  step,
  height,
  revealAt,
}) => {
  const ys = choice.options.map((_, i) => 20 + i * (height + 20) + height / 2);
  return (
    <div style={{ position: "relative" }}>
      {choice.options.map((option, i) => (
        <Option
          key={option}
          index={i}
          label={option}
          enterFrame={start + i * step}
          height={height}
          state={revealAt === undefined ? "idle" : i === choice.correct_index ? "correct" : "dim"}
          revealFrame={revealAt}
        />
      ))}
      {revealAt !== undefined && <Laser ys={ys} target={choice.correct_index} revealAt={revealAt} />}
    </div>
  );
};

/* ───────────────────────── Reto diario ───────────────────────── */

const DailyPhase: React.FC<PhaseProps<Extract<Question, { mode: "daily" }>>> = ({ q, start, category, revealAt }) => (
  <Column>
    <Panel enterFrame={start} label={`${revealAt === undefined ? "Pregunta" : "Repetición"} · ${category}`}>
      <Prompt>{q.prompt}</Prompt>
    </Panel>
    <ChoiceOptions choice={q} start={start + 16} step={9} height={120} revealAt={revealAt} />
  </Column>
);

/* ───────────────────────── Trayectoria ───────────────────────── */

const CareerPhase: React.FC<PhaseProps<Extract<Question, { mode: "career-path" }>>> = ({ q, start, revealAt }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const ROW = 110;
  // En la repetición, una línea verde recorre la trayectoria de arriba abajo.
  const run =
    revealAt === undefined
      ? 0
      : interpolate(frame, [revealAt - 26, revealAt], [0, 1], { ...clamp, easing: Easing.inOut(Easing.cubic) });
  const lineTop = ROW / 2;
  const lineLength = (q.clubs.length - 1) * ROW;

  return (
    <Column>
      <Panel enterFrame={start} label={revealAt === undefined ? "Trayectoria" : "Repetición · Trayectoria"}>
        <Prompt size={56}>{q.prompt}</Prompt>
      </Panel>
      <div style={{ position: "relative", marginTop: 10 }}>
        <div style={{ position: "absolute", left: 23, top: lineTop, height: lineLength, width: 4, background: colors.line }} />
        <div
          style={{
            position: "absolute",
            left: 21,
            top: lineTop,
            height: lineLength * run,
            width: 8,
            borderRadius: 4,
            background: colors.varGreen,
            boxShadow: "0 0 24px rgba(57,226,122,0.8)",
          }}
        />
        {q.clubs.map((row, i) => {
          const enter = spring({ frame: frame - (start + 30 + i * 22), fps, config: { damping: 14 } });
          const lit =
            revealAt === undefined
              ? 0
              : spring({ frame: frame - (revealAt - 26 + (26 * i) / Math.max(1, q.clubs.length - 1)), fps, config: { damping: 10, stiffness: 180 } });
          return (
            <div
              key={`${row.club}-${row.years}`}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 26,
                height: ROW,
                opacity: enter,
                transform: `translateX(${(1 - enter) * 120}px)`,
              }}
            >
              <div style={{ width: 50, flexShrink: 0, display: "flex", justifyContent: "center" }}>
                <div
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: 999,
                    background: colors.varGreen,
                    boxShadow: `0 0 ${18 + 30 * lit}px rgba(57,226,122,${0.7 + 0.3 * lit})`,
                    transform: `scale(${enter * (1 + 0.5 * Math.sin(Math.min(lit, 1) * Math.PI))})`,
                  }}
                />
              </div>
              <div style={{ width: 250, flexShrink: 0, fontWeight: 600, fontSize: 38, color: colors.textMuted, whiteSpace: "nowrap" }}>
                {row.years}
              </div>
              <div
                style={{
                  flex: 1,
                  fontWeight: 800,
                  fontSize: 54,
                  lineHeight: 1.05,
                  color: interpolateColors(Math.min(lit, 1), [0, 1], [colors.text, colors.varGreen]),
                }}
              >
                {row.club}
              </div>
            </div>
          );
        })}
      </div>
    </Column>
  );
};

/* ───────────────────────── Adivina el jugador ───────────────────────── */

const GuessPhase: React.FC<PhaseProps<Extract<Question, { mode: "guess-player" }>>> = ({ q, start, revealAt }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <Column>
      <Panel enterFrame={start} label={revealAt === undefined ? "Adivina el jugador" : "Repetición · Pistas"}>
        <Prompt size={54}>{q.prompt}</Prompt>
      </Panel>
      {q.clues.map((clue, i) => {
        const enterFrame = start + 30 + i * 26;
        const enter = spring({ frame: frame - enterFrame, fps, config: { damping: 14 } });
        const last = i === q.clues.length - 1;
        const tick =
          revealAt === undefined
            ? 0
            : spring({ frame: frame - (revealAt - 24 + i * 7), fps, config: { damping: 10, stiffness: 180 } });
        const green = revealAt === undefined ? last : tick > 0.5;
        return (
          <div
            key={clue}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 22,
              marginTop: 16,
              padding: "20px 26px",
              background: tick > 0.5 ? colors.goalOkBg : colors.surface,
              border: `3px solid ${green ? colors.varGreen : colors.line}`,
              borderRadius: 22,
              opacity: enter,
              transform: `translateY(${(1 - enter) * 50}px) scale(${0.96 + 0.04 * enter})`,
              boxShadow: green ? "0 0 40px rgba(57,226,122,0.25)" : "none",
            }}
          >
            <div
              style={{
                flexShrink: 0,
                fontFamily: fonts.display,
                fontSize: 34,
                color: colors.varGreen,
                background: colors.bezel,
                borderRadius: 12,
                padding: "8px 16px 6px",
                letterSpacing: 1,
              }}
            >
              PISTA {i + 1}
            </div>
            <div style={{ flex: 1, fontWeight: 700, fontSize: 44, lineHeight: 1.15 }}>{clue}</div>
            {tick > 0 && <Check size={52} scale={tick} />}
          </div>
        );
      })}
    </Column>
  );
};

/* ───────────────────────── Supervivencia ───────────────────────── */

const SurvivalPhase: React.FC<PhaseProps<Extract<Question, { mode: "survival" }>>> = ({ q, start, revealAt }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const n = q.questions.length;
  const qStart = (i: number) => start + i * SURVIVAL_QUICK;
  const answered =
    q.questions.filter((_, i) => i < n - 1 && frame >= qStart(i) + 33).length +
    (revealAt !== undefined && frame >= revealAt ? 1 : 0);
  const bar = spring({ frame: frame - start, fps, config: { damping: 14 } });
  const doneAt = (i: number) => (i < n - 1 ? qStart(i) + 33 : (revealAt ?? 0));

  return (
    <Column>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "18px 30px",
          background: colors.bezel,
          border: `3px solid ${colors.line}`,
          borderRadius: 22,
          marginBottom: 20,
          opacity: bar,
          transform: `translateY(${(1 - bar) * -30}px)`,
        }}
      >
        <div style={{ fontFamily: fonts.display, fontSize: 40, letterSpacing: 2, textTransform: "uppercase" }}>
          {answered === n ? "¡Racha completa!" : "Hasta el primer fallo"}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <span style={{ fontWeight: 700, fontSize: 34, color: colors.textMuted, marginRight: 6 }}>RACHA</span>
          {q.questions.map((_, i) => {
            const done = i < answered;
            const pop = done ? spring({ frame: frame - doneAt(i), fps, config: { damping: 9, stiffness: 180 } }) : 0;
            return (
              <div
                key={i}
                style={{
                  width: 54,
                  height: 54,
                  borderRadius: 999,
                  background: done ? colors.varGreen : colors.surface,
                  border: `3px solid ${done ? colors.varGreen : colors.line}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  transform: `scale(${done ? 1 + 0.25 * Math.sin(Math.min(pop, 1) * Math.PI) : 1})`,
                  boxShadow: done ? "0 0 20px rgba(57,226,122,0.6)" : "none",
                }}
              >
                {done && (
                  <svg width="30" height="30" viewBox="0 0 24 24">
                    <path d="M4 12.5l5 5L20 6.5" fill="none" stroke={colors.bg} strokeWidth="3.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {q.questions.map((choice, i) => {
        const final = i === n - 1;
        const s = qStart(i);
        if (frame < s) return null;
        if (!final && frame >= s + SURVIVAL_QUICK) return null;
        const out = final
          ? 0
          : interpolate(frame, [s + SURVIVAL_QUICK - 8, s + SURVIVAL_QUICK], [0, 1], { ...clamp, easing: Easing.in(Easing.cubic) });
        return (
          <div
            key={choice.prompt}
            style={{
              position: "absolute",
              top: 130,
              left: 0,
              width: CONTENT_WIDTH,
              opacity: 1 - out,
              transform: `translateX(${out * -140}px)`,
            }}
          >
            <SurvivalQuestion choice={choice} index={i} start={s} final={final} revealAt={revealAt} />
          </div>
        );
      })}
    </Column>
  );
};

const SurvivalQuestion: React.FC<{ choice: Choice; index: number; start: number; final: boolean; revealAt?: number }> = ({
  choice,
  index,
  start,
  final,
  revealAt,
}) => (
  <>
    <Panel enterFrame={start} label={final ? `Pregunta ${index + 1} · La decisiva` : `Pregunta ${index + 1}`}>
      <Prompt size={final ? 58 : 50}>{choice.prompt}</Prompt>
    </Panel>
    {final ? (
      <ChoiceOptions choice={choice} start={start + 14} step={8} height={120} revealAt={revealAt} />
    ) : (
      choice.options.map((option, i) => (
        <Option
          key={option}
          index={i}
          label={option}
          enterFrame={start + 8 + i * 5}
          height={96}
          state={i === choice.correct_index ? "correct" : "dim"}
          revealFrame={start + 33}
        />
      ))
    )}
    {final && <div style={{ height: SURVIVAL_FINAL }} />}
  </>
);

/* ───────────────────────── Más o menos ───────────────────────── */

const HigherLowerPhase: React.FC<PhaseProps<Extract<Question, { mode: "higher-lower" }>>> = ({ q, start, category, revealAt }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const left = spring({ frame: frame - start - 10, fps, config: { damping: 14 } });
  const right = spring({ frame: frame - start - 22, fps, config: { damping: 14 } });
  const blink = 0.55 + 0.45 * Math.abs(Math.sin(frame / 9));

  // En la repetición, el valor oculto cuenta desde 0 hasta el real.
  let targetValue = q.target.value;
  let revealed = 0;
  if (revealAt !== undefined) {
    const count = interpolate(frame, [revealAt - 24, revealAt], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
    revealed = spring({ frame: frame - revealAt, fps, config: { damping: 11, stiffness: 140 } });
    const m = q.target_value.match(/^(\d+)(.*)$/);
    targetValue = frame < revealAt - 24 ? "?" : m ? `${Math.round(Number(m[1]) * count)}${m[2]}` : q.target_value;
  }

  return (
    <Column>
      <Panel enterFrame={start} label={`${revealAt === undefined ? "Más o menos" : "Repetición"} · ${category}`}>
        <Prompt size={54}>{q.prompt}</Prompt>
      </Panel>
      <div style={{ display: "flex", gap: 24 }}>
        <ValueCardView card={q.reference} enter={left} from={-160} />
        <ValueCardView
          card={{ ...q.target, value: targetValue }}
          enter={right}
          from={160}
          unknown={revealAt === undefined}
          blink={blink}
          revealed={revealed}
        />
      </div>
      <div style={{ display: "flex", gap: 24, marginTop: 24 }}>
        {(["MÁS", "MENOS"] as const).map((label, i) => {
          const e = spring({ frame: frame - start - 45 - i * 8, fps, config: { damping: 12 } });
          const isAnswer = label === q.answer;
          const r = revealAt === undefined ? 0 : revealed;
          return (
            <div
              key={label}
              style={{
                flex: 1,
                height: 110,
                borderRadius: 24,
                background: isAnswer ? interpolateColors(r, [0, 1], [colors.bezel, colors.varGreen]) : colors.bezel,
                color: isAnswer && r > 0.5 ? colors.bg : colors.text,
                border: `4px solid ${isAnswer && r > 0 ? colors.varGreen : colors.line}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 18,
                fontFamily: fonts.display,
                fontSize: 60,
                letterSpacing: 2,
                opacity: e * (!isAnswer && r > 0 ? 1 - 0.65 * r : 1),
                transform: `translateY(${(1 - e) * 50}px) scale(${isAnswer ? 1 + 0.06 * Math.sin(Math.min(r, 1) * Math.PI) : 1})`,
                boxShadow: isAnswer && r > 0 ? `0 0 ${50 * r}px rgba(57,226,122,${0.45 * r})` : "none",
              }}
            >
              <span style={{ color: isAnswer && r > 0.5 ? colors.bg : colors.varGreen, fontSize: 48 }}>{label === "MÁS" ? "▲" : "▼"}</span>
              {label}
            </div>
          );
        })}
      </div>
    </Column>
  );
};

const ValueCardView: React.FC<{
  card: ValueCard;
  enter: number;
  from: number;
  unknown?: boolean;
  blink?: number;
  revealed?: number;
}> = ({ card, enter, from, unknown, blink = 1, revealed = 0 }) => (
  <div
    style={{
      flex: 1,
      height: 380,
      boxSizing: "border-box",
      padding: "30px 30px",
      background: revealed > 0 ? interpolateColors(revealed, [0, 1], [colors.surface, colors.goalOkBg]) : colors.surface,
      border: `3px solid ${unknown || revealed > 0 ? colors.varGreen : colors.line}`,
      borderRadius: 26,
      display: "flex",
      flexDirection: "column",
      justifyContent: "space-between",
      opacity: enter,
      transform: `translateX(${(1 - enter) * from}px) scale(${1 + 0.04 * Math.sin(Math.min(revealed, 1) * Math.PI)})`,
      boxShadow: unknown || revealed > 0 ? `0 0 ${40 + 30 * revealed}px rgba(57,226,122,${0.2 + 0.25 * revealed})` : "0 30px 80px rgba(0,0,0,0.45)",
    }}
  >
    <div>
      <div style={{ fontWeight: 800, fontSize: 44, lineHeight: 1.1 }}>{card.name}</div>
      <div style={{ fontWeight: 600, fontSize: 30, lineHeight: 1.2, color: colors.textMuted, marginTop: 10 }}>
        {card.detail}
      </div>
    </div>
    <div
      style={{
        fontFamily: fonts.display,
        fontSize: unknown ? 120 : 92,
        lineHeight: 1,
        whiteSpace: "nowrap",
        color: unknown ? colors.text : colors.varGreen,
        opacity: unknown ? blink : 1,
        textShadow: unknown ? "none" : "0 0 30px rgba(57,226,122,0.4)",
      }}
    >
      {card.value}
    </div>
  </div>
);
