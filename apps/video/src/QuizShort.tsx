import {
  AbsoluteFill,
  Audio,
  Easing,
  Sequence,
  interpolate,
  interpolateColors,
  random,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { CONTENT_WIDTH, SAFE, T, colors, fonts } from "./brand";
import { CheckTheVarButton } from "./components/CheckTheVarButton";
import { Corners, Logo, Scanlines, VarMonitor } from "./components/Logo";
import type { QuizItem } from "./types";

export type QuizShortProps = { item: QuizItem };

const LETTERS = ["A", "B", "C"];
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/** Vídeo vertical de 15 s: gancho → pregunta → cuenta atrás → CHECK THE VAR → respuesta → cierre. */
export const QuizShort: React.FC<QuizShortProps> = ({ item }) => {
  const frame = useCurrentFrame();

  // Todo el "partido" (cabecera, pregunta, respuesta) se retira al empezar el cierre.
  const matchOut = interpolate(frame, [T.outroStart, T.outroStart + 10], [1, 0], clamp);

  return (
    <AbsoluteFill style={{ backgroundColor: colors.bg, fontFamily: fonts.body, color: colors.text }}>
      <Background />
      <Celebration />

      <AbsoluteFill style={{ opacity: matchOut }}>
        <Header item={item} />
        <Hook item={item} />
        <QuestionBlock item={item} />
        <Countdown />
        <ReviewButton />
      </AbsoluteFill>

      <ReviewOverlay />
      <Outro item={item} />

      <Sfx />
    </AbsoluteFill>
  );
};

/* ───────────────────────── Fondo ───────────────────────── */

const Background: React.FC = () => {
  const frame = useCurrentFrame();
  const drift = Math.sin(frame / 40) * 30;
  return (
    <AbsoluteFill>
      {/* Brillo verde como en la landing */}
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
      {/* Líneas de campo muy sutiles */}
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

/* ───────────────────────── Cabecera ───────────────────────── */

const Header: React.FC<{ item: QuizItem }> = ({ item }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame: frame - 4, fps, config: { damping: 14 } });
  return (
    <div
      style={{
        position: "absolute",
        top: SAFE.top + 30,
        left: SAFE.left,
        width: CONTENT_WIDTH,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        opacity: enter,
        transform: `translateY(${(1 - enter) * -30}px)`,
      }}
    >
      <Logo scale={0.4} />
      <div
        style={{
          fontFamily: fonts.display,
          fontSize: 50,
          lineHeight: 1,
          textTransform: "uppercase",
          color: colors.bg,
          background: colors.varGreen,
          padding: "16px 26px 14px",
          borderRadius: 14,
          letterSpacing: 1,
        }}
      >
        {item.category_label}
      </div>
    </div>
  );
};

/* ───────────────────────── Gancho (0–1,5 s) ───────────────────────── */

const Hook: React.FC<{ item: QuizItem }> = ({ item }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (frame > T.questionStart + 12) return null;

  const pop = spring({ frame, fps, config: { damping: 9, stiffness: 160 } });
  const pop2 = spring({ frame: frame - 7, fps, config: { damping: 10, stiffness: 160 } });
  const out = interpolate(frame, [T.questionStart - 4, T.questionStart + 8], [0, 1], {
    ...clamp,
    easing: Easing.in(Easing.cubic),
  });
  // Golpe seco: pequeño temblor al entrar.
  const shake = frame < 10 ? Math.sin(frame * 2.4) * (10 - frame) * 1.4 : 0;

  return (
    <div
      style={{
        position: "absolute",
        left: SAFE.left,
        width: CONTENT_WIDTH,
        top: 640,
        opacity: 1 - out,
        transform: `translate(${shake}px, ${out * -140}px)`,
      }}
    >
      <div
        style={{
          display: "inline-block",
          fontFamily: fonts.body,
          fontWeight: 800,
          fontSize: 48,
          color: colors.varGreen,
          border: `3px solid ${colors.varGreen}`,
          borderRadius: 999,
          padding: "8px 28px",
          marginBottom: 34,
          opacity: pop,
          letterSpacing: 2,
          textTransform: "uppercase",
        }}
      >
        Quiz de fútbol
      </div>
      <div
        style={{
          fontFamily: fonts.display,
          fontSize: 150,
          lineHeight: 1.02,
          textTransform: "uppercase",
          transform: `scale(${0.6 + 0.4 * pop})`,
          transformOrigin: "left center",
          opacity: pop,
        }}
      >
        {item.hook}
      </div>
      {item.hook_accent && (
        <div
          style={{
            fontFamily: fonts.display,
            fontSize: 150,
            lineHeight: 1.02,
            textTransform: "uppercase",
            color: colors.varGreen,
            textShadow: "0 0 40px rgba(57,226,122,0.35)",
            transform: `scale(${0.6 + 0.4 * pop2})`,
            transformOrigin: "left center",
            opacity: pop2,
          }}
        >
          {item.hook_accent}
        </div>
      )}
    </div>
  );
};

/* ───────────────────────── Pregunta y opciones (1,5–13 s) ───────────────────────── */

const QuestionBlock: React.FC<{ item: QuizItem }> = ({ item }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (frame < T.questionStart) return null;

  const cardIn = spring({ frame: frame - T.questionStart, fps, config: { damping: 15 } });
  const revealed = frame >= T.answerStart;

  return (
    <div
      style={{
        position: "absolute",
        top: 360,
        left: SAFE.left,
        width: CONTENT_WIDTH,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          background: colors.surface,
          border: `3px solid ${colors.line}`,
          borderRadius: 30,
          padding: "36px 44px 40px",
          marginBottom: 18,
          opacity: cardIn,
          transform: `translateY(${(1 - cardIn) * 80}px) scale(${0.94 + 0.06 * cardIn})`,
          boxShadow: "0 30px 80px rgba(0,0,0,0.45)",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            bottom: 0,
            width: 10,
            background: colors.varGreen,
          }}
        />
        <div
          style={{
            fontFamily: fonts.display,
            fontSize: 48,
            color: colors.varGreen,
            letterSpacing: 2,
            marginBottom: 16,
            textTransform: "uppercase",
          }}
        >
          Pregunta
        </div>
        <div style={{ fontWeight: 800, fontSize: 62, lineHeight: 1.13, letterSpacing: -0.5 }}>
          {item.prompt_es}
        </div>
      </div>

      {item.options_es.map((option, i) => (
        <OptionRow
          key={option}
          index={i}
          label={option}
          isCorrect={i === item.correct_index}
          revealed={revealed}
          enterFrame={T.questionStart + 16 + i * 9}
        />
      ))}

      {revealed && <AnswerBlock item={item} />}
    </div>
  );
};

const OptionRow: React.FC<{
  index: number;
  label: string;
  isCorrect: boolean;
  revealed: boolean;
  enterFrame: number;
}> = ({ index, label, isCorrect, revealed, enterFrame }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame: frame - enterFrame, fps, config: { damping: 14 } });
  const reveal = spring({ frame: frame - T.answerStart, fps, config: { damping: 11, stiffness: 140 } });
  const r = revealed ? reveal : 0;

  const bg = isCorrect ? interpolateColors(r, [0, 1], [colors.surface, colors.goalOkBg]) : colors.surface;
  const border = isCorrect ? interpolateColors(r, [0, 1], [colors.line, colors.varGreen]) : colors.line;
  const dim = !isCorrect && revealed ? interpolate(r, [0, 1], [1, 0.35]) : 1;
  const pulse = isCorrect && revealed ? 1 + 0.05 * Math.sin(Math.min(r, 1) * Math.PI) : 1;
  // Tras marcar la correcta, las incorrectas se recogen para dejar sitio al resultado.
  const collapse =
    !isCorrect && revealed
      ? interpolate(frame, [T.answerStart + 10, T.answerStart + 20], [0, 1], {
          ...clamp,
          easing: Easing.inOut(Easing.cubic),
        })
      : 0;
  const rowHeight = 120 * (1 - collapse);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 28,
        height: rowHeight,
        marginTop: 22 * (1 - collapse),
        overflow: "hidden",
        boxSizing: "border-box",
        padding: "0 30px 0 22px",
        background: bg,
        border: collapse >= 1 ? "none" : `4px solid ${border}`,
        borderRadius: 24,
        opacity: enter * dim * (1 - collapse),
        transform: `translateX(${(1 - enter) * 160}px) scale(${pulse})`,
        boxShadow: isCorrect && revealed ? `0 0 ${50 * r}px rgba(57,226,122,${0.35 * r})` : "none",
      }}
    >
      <div
        style={{
          width: 80,
          height: 80,
          flexShrink: 0,
          borderRadius: 18,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: fonts.display,
          fontSize: 52,
          background: isCorrect && revealed ? colors.varGreen : colors.bezel,
          color: isCorrect && revealed ? colors.bg : colors.varGreen,
        }}
      >
        {LETTERS[index]}
      </div>
      <div style={{ flex: 1, fontWeight: 700, fontSize: 54, lineHeight: 1.1 }}>{label}</div>
      {isCorrect && revealed && (
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: 999,
            background: colors.varGreen,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transform: `scale(${r})`,
          }}
        >
          <svg width="38" height="38" viewBox="0 0 24 24">
            <path d="M4 12.5l5 5L20 6.5" fill="none" stroke={colors.bg} strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      )}
    </div>
  );
};

/* ───────────────────────── Cuenta atrás (3,5–8,5 s) ───────────────────────── */

const Countdown: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (frame < T.countdownStart || frame >= T.reviewStart + 8) return null;

  const local = frame - T.countdownStart;
  const total = T.reviewStart - T.countdownStart; // 150 frames = 5 s
  const n = Math.max(1, 5 - Math.floor(local / fps));
  const inSecond = (local % fps) / fps;
  const enter = spring({ frame: local, fps, config: { damping: 14 } });
  const out = interpolate(frame, [T.reviewStart - 2, T.reviewStart + 6], [1, 0], clamp);
  const progress = interpolate(local, [0, total], [1, 0], clamp);
  const barColor = interpolateColors(progress, [0, 0.25, 0.4], [colors.goalKo, "#F5C542", colors.varGreen]);
  const numScale = 1.25 - 0.25 * Math.min(1, inSecond * 4);

  return (
    <div
      style={{
        position: "absolute",
        top: 1250,
        left: SAFE.left,
        width: CONTENT_WIDTH,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 30,
        opacity: enter * out,
        transform: `translateY(${(1 - enter) * 60}px)`,
      }}
    >
      <VarMonitor width={300} height={210} showStand={false}>
        <span
          style={{
            position: "relative",
            fontFamily: fonts.display,
            fontSize: 170,
            lineHeight: 1,
            color: n <= 2 ? interpolateColors(progress, [0, 0.4], [colors.goalKo, colors.varGreen]) : colors.varGreen,
            textShadow: "0 0 30px rgba(57,226,122,0.5)",
            transform: `scale(${numScale})`,
          }}
        >
          {n}
        </span>
      </VarMonitor>
      <div
        style={{
          width: "100%",
          height: 26,
          borderRadius: 999,
          background: colors.bezel,
          border: `2px solid ${colors.line}`,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${progress * 100}%`,
            height: "100%",
            borderRadius: 999,
            background: barColor,
            boxShadow: `0 0 20px ${barColor}`,
          }}
        />
      </div>
      <div style={{ fontWeight: 700, fontSize: 48, color: colors.textMuted, textAlign: "center" }}>
        ¿A, B o C? Dilo en comentarios
      </div>
    </div>
  );
};

/* ───────────────────────── Botón CHECK THE VAR (8,5–9 s) ───────────────────────── */

const ReviewButton: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (frame < T.reviewStart || frame >= T.overlayStart + 8) return null;

  const enter = spring({ frame: frame - T.reviewStart, fps, config: { damping: 10, stiffness: 180 } });
  const pressed = interpolate(frame, [T.buttonPress, T.buttonPress + 3, T.buttonPress + 7], [0, 1, 0.6], clamp);
  const out = interpolate(frame, [T.overlayStart, T.overlayStart + 6], [1, 0], clamp);

  return (
    <div
      style={{
        position: "absolute",
        top: 1300,
        left: SAFE.left,
        width: CONTENT_WIDTH,
        display: "flex",
        justifyContent: "center",
        opacity: enter * out,
        transform: `scale(${0.7 + 0.3 * enter})`,
      }}
    >
      <CheckTheVarButton scale={1.1} pressed={pressed} />
      {/* Dedo/cursor que pulsa */}
      <div
        style={{
          position: "absolute",
          top: 110,
          left: 700,
          width: 56,
          height: 56,
          borderRadius: 999,
          border: `5px solid ${colors.text}`,
          opacity: interpolate(frame, [T.buttonPress - 6, T.buttonPress, T.buttonPress + 8], [0, 1, 0], clamp),
          transform: `translate(${interpolate(frame, [T.buttonPress - 6, T.buttonPress], [40, 0], clamp)}px, ${interpolate(frame, [T.buttonPress - 6, T.buttonPress], [40, -60], clamp)}px) scale(${interpolate(frame, [T.buttonPress, T.buttonPress + 8], [1, 1.8], clamp)})`,
        }}
      />
    </div>
  );
};

/* ───────────────────────── Revisando la jugada (9–10 s) ───────────────────────── */

const ReviewOverlay: React.FC = () => {
  const frame = useCurrentFrame();
  if (frame < T.overlayStart || frame > T.answerStart + 6) return null;

  const fadeIn = interpolate(frame, [T.overlayStart, T.overlayStart + 5], [0, 1], clamp);
  const fadeOut = interpolate(frame, [T.answerStart - 3, T.answerStart + 4], [1, 0], clamp);
  const local = frame - T.overlayStart;
  const dots = ".".repeat(1 + (Math.floor(local / 5) % 3));
  const scanY = interpolate(local, [0, 26], [SAFE.top, 1920 - SAFE.bottom], clamp);
  const flicker = 0.85 + 0.15 * random(`flicker-${frame}`);

  return (
    <AbsoluteFill style={{ opacity: fadeIn * fadeOut, backgroundColor: colors.screen }}>
      <Scanlines opacity={0.9} />
      <Corners size={130} thickness={10} inset={70} />
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: scanY,
          height: 6,
          background: colors.varGreen,
          boxShadow: "0 0 40px 10px rgba(57,226,122,0.45)",
          opacity: 0.7,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: SAFE.left,
          width: CONTENT_WIDTH,
          top: 640,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 50,
          opacity: flicker,
        }}
      >
        <VarMonitor width={420} />
        <div
          style={{
            fontFamily: fonts.display,
            fontSize: 112,
            lineHeight: 1.05,
            textAlign: "center",
            color: colors.varGreen,
            textShadow: "0 0 34px rgba(57,226,122,0.6)",
            textTransform: "uppercase",
          }}
        >
          Revisando
          <br />
          la jugada
          <span style={{ display: "inline-block", width: 90, textAlign: "left" }}>{dots}</span>
        </div>
      </div>
    </AbsoluteFill>
  );
};

/* ───────────────────────── Respuesta (10–13 s) ───────────────────────── */

const AnswerBlock: React.FC<{ item: QuizItem }> = ({ item }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const banner = spring({ frame: frame - T.answerStart - 16, fps, config: { damping: 8, stiffness: 170 } });
  const fact = spring({ frame: frame - T.answerStart - 28, fps, config: { damping: 15 } });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28, marginTop: 36 }}>
      <div
        style={{
          background: colors.varGreen,
          color: colors.bg,
          fontFamily: fonts.display,
          fontSize: 124,
          lineHeight: 1,
          padding: "26px 0 20px",
          borderRadius: 28,
          textAlign: "center",
          transform: `scale(${0.4 + 0.6 * banner}) rotate(${(1 - banner) * -6}deg)`,
          opacity: Math.min(1, banner * 1.5),
          boxShadow: "0 0 70px rgba(57,226,122,0.45)",
        }}
      >
        GOL CONFIRMADO
      </div>
      <div
        style={{
          background: colors.surface,
          border: `3px solid ${colors.line}`,
          borderLeft: `10px solid ${colors.varGreen}`,
          borderRadius: 24,
          padding: "26px 34px",
          fontWeight: 600,
          fontSize: 48,
          lineHeight: 1.24,
          color: colors.text,
          opacity: fact,
          transform: `translateY(${(1 - fact) * 50}px)`,
        }}
      >
        {item.explanation_es}
      </div>
    </div>
  );
};

/** Lluvia de "confeti" verde y blanco al confirmar el gol. */
const Celebration: React.FC = () => {
  const frame = useCurrentFrame();
  const local = frame - T.answerStart - 16;
  if (local < 0 || local > 70) return null;
  const flash = interpolate(local, [0, 3, 14], [0, 0.35, 0], clamp);

  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <AbsoluteFill style={{ backgroundColor: colors.varGreen, opacity: flash }} />
      {Array.from({ length: 46 }).map((_, i) => {
        const angle = random(`a${i}`) * Math.PI * 2;
        const speed = 18 + random(`s${i}`) * 26;
        const x = 520 + Math.cos(angle) * speed * local;
        const y = 1000 + Math.sin(angle) * speed * local + 0.9 * local * local;
        const size = 14 + random(`z${i}`) * 18;
        const op = interpolate(local, [0, 45, 70], [1, 1, 0], clamp);
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: x,
              top: y,
              width: size,
              height: size * 0.55,
              borderRadius: 3,
              background: i % 3 === 0 ? colors.text : colors.varGreen,
              opacity: op,
              transform: `rotate(${local * 14 + i * 40}deg)`,
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

/* ───────────────────────── Cierre (13–15 s) ───────────────────────── */

const Outro: React.FC<{ item: QuizItem }> = ({ item }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (frame < T.outroStart) return null;

  const local = frame - T.outroStart;
  const logo = spring({ frame: local - 4, fps, config: { damping: 12 } });
  const cta = spring({ frame: local - 14, fps, config: { damping: 13 } });
  const pill = spring({ frame: local - 22, fps, config: { damping: 10, stiffness: 160 } });

  // "¿Acertaste? Juega el reto de hoy" → pregunta en blanco + resto en verde.
  const qEnd = item.cta.indexOf("?");
  const first = qEnd >= 0 ? item.cta.slice(0, qEnd + 1) : item.cta;
  const rest = qEnd >= 0 ? item.cta.slice(qEnd + 1).trim() : "";

  return (
    <div
      style={{
        position: "absolute",
        left: SAFE.left,
        width: CONTENT_WIDTH,
        top: 470,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        textAlign: "center",
      }}
    >
      <div style={{ opacity: logo, transform: `scale(${0.7 + 0.3 * logo})` }}>
        <Logo scale={1.45} glow={1 + 0.4 * Math.sin(local / 4)} />
      </div>
      <div
        style={{
          marginTop: 110,
          opacity: cta,
          transform: `translateY(${(1 - cta) * 60}px)`,
          fontFamily: fonts.display,
          textTransform: "uppercase",
          lineHeight: 1.05,
        }}
      >
        <div style={{ fontSize: 120 }}>{first}</div>
        {rest && <div style={{ fontSize: 96, color: colors.varGreen }}>{rest}</div>}
      </div>
      <div
        style={{
          marginTop: 60,
          background: colors.varGreen,
          color: colors.bg,
          fontWeight: 800,
          fontSize: 60,
          padding: "22px 54px",
          borderRadius: 22,
          transform: `scale(${pill})`,
          boxShadow: "0 0 60px rgba(57,226,122,0.35)",
        }}
      >
        checkthevar.es
      </div>
    </div>
  );
};

/* ───────────────────────── Sonido (efectos propios, sin música) ───────────────────────── */

const Sfx: React.FC = () => (
  <>
    <Sequence from={0} durationInFrames={20}>
      <Audio src={staticFile("sfx/hit.wav")} volume={0.9} />
    </Sequence>
    <Sequence from={T.questionStart} durationInFrames={20}>
      <Audio src={staticFile("sfx/whoosh.wav")} volume={0.6} />
    </Sequence>
    {[0, 1, 2, 3, 4].map((s) => (
      <Sequence key={s} from={T.countdownStart + s * 30} durationInFrames={6}>
        <Audio src={staticFile("sfx/tick.wav")} volume={0.7} />
      </Sequence>
    ))}
    <Sequence from={T.buttonPress} durationInFrames={20}>
      <Audio src={staticFile("sfx/whistle.wav")} volume={0.55} />
    </Sequence>
    <Sequence from={T.overlayStart} durationInFrames={28}>
      <Audio src={staticFile("sfx/buzz.wav")} volume={0.7} />
    </Sequence>
    <Sequence from={T.answerStart + 16} durationInFrames={30}>
      <Audio src={staticFile("sfx/confirm.wav")} volume={0.8} />
    </Sequence>
    <Sequence from={T.outroStart} durationInFrames={15}>
      <Audio src={staticFile("sfx/whoosh.wav")} volume={0.5} />
    </Sequence>
  </>
);
