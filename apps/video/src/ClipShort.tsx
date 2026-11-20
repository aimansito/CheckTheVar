import { useMemo } from "react";
import {
  AbsoluteFill,
  Audio,
  Easing,
  Img,
  OffthreadVideo,
  Sequence,
  interpolate,
  interpolateColors,
  random,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { CONTENT_WIDTH, SAFE, colors, fonts } from "./brand";
import { ModePhase } from "./ClipModes";
import { Background } from "./components/Background";
import { CheckTheVarButton } from "./components/CheckTheVarButton";
import { Corners, Scanlines, VarMonitor } from "./components/Logo";
import {
  COUNTDOWN_FRAMES,
  REVEAL_FRAMES,
  REVEAL_LOCK,
  SURVIVAL_QUICK,
  WIPE_FRAMES,
  segFrames,
  timeline,
  type ClipItem,
  type Reel,
  type Timeline,
} from "./clipTypes";

export type ClipShortProps = { item: ClipItem };

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
/** Inclinación de la línea de fuera de juego que destapa el clip (px entre arriba y abajo). */
const SLANT = 130;

/** Dónde acaba el clip en el cierre: dentro de la pantalla del monitor VAR del logo. */
const OUTRO = { textLeft: 60, textWidth: 440, monitorLeft: 529, monitorTop: 473, monitorWidth: 420 };
const MONITOR = (() => {
  const { monitorLeft: left, monitorTop: top, monitorWidth: width } = OUTRO;
  const u = width / 300;
  const pad = 14 * u; // relleno 12u + borde 2u del VarMonitor
  const screenW = width - 2 * pad;
  const screenH = width * 0.66 - 2 * pad;
  const scale = screenW / 1080;
  return {
    scale,
    dx: left + width / 2 - 540,
    dy: top + (width * 0.66) / 2 - 960,
    inset: (1920 - screenH / scale) / 2,
    radius: (10 * u) / scale,
  };
})();

/** Vídeo vertical: gancho → pregunta del modo → cuenta atrás → CHECK THE VAR → clip → GOL CONFIRMADO → cierre. */
export const ClipShort: React.FC<ClipShortProps> = ({ item }) => {
  const frame = useCurrentFrame();
  const t = useMemo(() => timeline(item), [item]);

  return (
    <AbsoluteFill style={{ backgroundColor: colors.bg, fontFamily: fonts.body, color: colors.text }}>
      <Background />
      {frame < t.overlayStart + 8 && (
        <AbsoluteFill>
          <Header item={item} />
          <Hook item={item} t={t} />
          <ModePhase item={item} start={t.questionStart} />
          <Countdown t={t} />
          <ReviewButton t={t} />
        </AbsoluteFill>
      )}
      <ReviewOverlay t={t} />
      <Outro item={item} t={t} />
      <ClipStage item={item} t={t} />
      <Celebration t={t} />
      <Verdict item={item} t={t} />
      <Sfx item={item} t={t} />
    </AbsoluteFill>
  );
};

/* ───────────────────────── Cabecera y gancho ───────────────────────── */

const Header: React.FC<{ item: ClipItem }> = ({ item }) => {
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
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontFamily: fonts.display, fontSize: 47, lineHeight: 1, letterSpacing: 0.5 }}>CHECK THE</span>
        <VarMonitor width={116} showStand={false} />
      </div>
      <div
        style={{
          fontFamily: fonts.display,
          fontSize: 46,
          lineHeight: 1,
          textTransform: "uppercase",
          color: colors.bg,
          background: colors.varGreen,
          padding: "16px 26px 14px",
          borderRadius: 14,
          letterSpacing: 1,
        }}
      >
        {item.mode_label}
      </div>
    </div>
  );
};

const Hook: React.FC<{ item: ClipItem; t: Timeline }> = ({ item, t }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (frame > t.questionStart + 12) return null;

  const pop = spring({ frame, fps, config: { damping: 9, stiffness: 160 } });
  const pop2 = spring({ frame: frame - 7, fps, config: { damping: 10, stiffness: 160 } });
  const out = interpolate(frame, [t.questionStart - 4, t.questionStart + 8], [0, 1], {
    ...clamp,
    easing: Easing.in(Easing.cubic),
  });
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
          fontWeight: 800,
          fontSize: 46,
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
        {item.category_label}
      </div>
      <div
        style={{
          fontFamily: fonts.display,
          fontSize: 132,
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
            fontSize: 132,
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

/* ───────────────────────── Cuenta atrás y botón ───────────────────────── */

const Countdown: React.FC<{ t: Timeline }> = ({ t }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (frame < t.countdownStart || frame >= t.reviewStart + 8) return null;

  const local = frame - t.countdownStart;
  const seconds = COUNTDOWN_FRAMES / fps;
  const n = Math.max(1, seconds - Math.floor(local / fps));
  const inSecond = (local % fps) / fps;
  const enter = spring({ frame: local, fps, config: { damping: 14 } });
  const out = interpolate(frame, [t.reviewStart - 2, t.reviewStart + 6], [1, 0], clamp);
  const progress = interpolate(local, [0, COUNTDOWN_FRAMES], [1, 0], clamp);
  const barColor = interpolateColors(progress, [0, 0.3, 0.5], [colors.goalKo, "#F5C542", colors.varGreen]);
  const numScale = 1.25 - 0.25 * Math.min(1, inSecond * 4);

  return (
    <div
      style={{
        position: "absolute",
        top: 1360,
        left: SAFE.left,
        width: CONTENT_WIDTH,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 24,
        opacity: enter * out,
        transform: `translateY(${(1 - enter) * 60}px)`,
      }}
    >
      <VarMonitor width={250} height={170} showStand={false}>
        <span
          style={{
            position: "relative",
            fontFamily: fonts.display,
            fontSize: 132,
            lineHeight: 1,
            color: n <= 1 ? colors.goalKo : colors.varGreen,
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
          height: 24,
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
      <div style={{ fontWeight: 700, fontSize: 42, color: colors.textMuted, textAlign: "center" }}>
        ¿Lo sabes? Dilo en comentarios
      </div>
    </div>
  );
};

const ReviewButton: React.FC<{ t: Timeline }> = ({ t }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (frame < t.reviewStart || frame >= t.overlayStart + 8) return null;

  const enter = spring({ frame: frame - t.reviewStart, fps, config: { damping: 10, stiffness: 180 } });
  const pressed = interpolate(frame, [t.buttonPress, t.buttonPress + 3, t.buttonPress + 7], [0, 1, 0.6], clamp);
  const out = interpolate(frame, [t.overlayStart, t.overlayStart + 6], [1, 0], clamp);

  return (
    <div
      style={{
        position: "absolute",
        top: 1330,
        left: SAFE.left,
        width: CONTENT_WIDTH,
        display: "flex",
        justifyContent: "center",
        opacity: enter * out,
        transform: `scale(${0.7 + 0.3 * enter})`,
      }}
    >
      <CheckTheVarButton scale={1.1} pressed={pressed} />
      <div
        style={{
          position: "absolute",
          top: 110,
          left: 700,
          width: 56,
          height: 56,
          borderRadius: 999,
          border: `5px solid ${colors.text}`,
          opacity: interpolate(frame, [t.buttonPress - 6, t.buttonPress, t.buttonPress + 8], [0, 1, 0], clamp),
          transform: `translate(${interpolate(frame, [t.buttonPress - 6, t.buttonPress], [40, 0], clamp)}px, ${interpolate(frame, [t.buttonPress - 6, t.buttonPress], [40, -60], clamp)}px) scale(${interpolate(frame, [t.buttonPress, t.buttonPress + 8], [1, 1.8], clamp)})`,
        }}
      />
    </div>
  );
};

/* ───────────────────────── Revisando la jugada ───────────────────────── */

const ReviewOverlay: React.FC<{ t: Timeline }> = ({ t }) => {
  const frame = useCurrentFrame();
  if (frame < t.overlayStart || frame > t.clipStart + WIPE_FRAMES + 2) return null;

  const fadeIn = interpolate(frame, [t.overlayStart, t.overlayStart + 5], [0, 1], clamp);
  const local = frame - t.overlayStart;
  const dots = ".".repeat(1 + (Math.floor(local / 5) % 3));
  const scanY = interpolate(local, [0, 24], [SAFE.top, 1920 - SAFE.bottom], clamp);
  const flicker = 0.85 + 0.15 * random(`flicker-${frame}`);

  return (
    <AbsoluteFill style={{ opacity: fadeIn, backgroundColor: colors.screen }}>
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

/* ───────────────────────── Clip: carretes, barrido, HUD y congelado ───────────────────────── */

const wipeProgress = (local: number) =>
  interpolate(local, [0, WIPE_FRAMES], [0, 1], { ...clamp, easing: Easing.inOut(Easing.cubic) });
const wipeX = (wipe: number) => interpolate(wipe, [0, 1], [-SLANT - 20, 1080 + SLANT + 20]);

/** Tramo del carrete que se ve en un frame dado (índice, inicio y duración en frames del carrete). */
function segmentAt(reel: Reel, local: number) {
  let start = 0;
  for (let i = 0; i < reel.segments.length; i++) {
    const n = segFrames(reel.segments[i]);
    if (local < start + n || i === reel.segments.length - 1) return { index: i, start, length: n };
    start += n;
  }
  return { index: 0, start: 0, length: 1 };
}

const ClipStage: React.FC<{ item: ClipItem; t: Timeline }> = ({ item, t }) => {
  const frame = useCurrentFrame();
  if (frame < t.clipStart) return null;

  // Cierre: el clip se encoge hasta ser la pantalla del monitor VAR del logo.
  const shrink = interpolate(frame, [t.outroStart, t.outroStart + 32], [0, 1], {
    ...clamp,
    easing: Easing.inOut(Easing.cubic),
  });
  const scale = 1 - shrink * (1 - MONITOR.scale);
  const inset = shrink * MONITOR.inset;

  return (
    <AbsoluteFill
      style={{
        transform: `translate(${shrink * MONITOR.dx}px, ${shrink * MONITOR.dy}px) scale(${scale})`,
        clipPath: `inset(${inset}px 0px ${inset}px 0px round ${shrink * MONITOR.radius}px)`,
      }}
    >
      {item.reels.length > 0 ? (
        item.reels.map((reel, i) => <ReelLayer key={i} slug={item.slug} reel={reel} index={i} t={t} />)
      ) : (
        <RevealLayer item={item} t={t} />
      )}
      <Hud item={item} t={t} />
      <FreezeFx t={t} />
      <WipeLine t={t} />
      <Scanlines opacity={0.22} />
      <Corners size={90} thickness={8} inset={44} />
    </AbsoluteFill>
  );
};

const ReelLayer: React.FC<{ slug: string; reel: Reel; index: number; t: Timeline }> = ({ slug, reel, index, t }) => {
  const frame = useCurrentFrame();
  const start = t.reelStarts[index];
  const length = t.reelLengths[index];
  const end = start + length;
  const isLast = index === t.reelStarts.length - 1;
  if (frame < start || (!isLast && frame >= end + WIPE_FRAMES)) return null;

  const local = frame - start;
  const seg = segmentAt(reel, Math.min(local, length - 1));
  const segLocal = Math.min(local, length - 1) - seg.start;
  // Zoom lento dentro de cada tramo y golpe breve en cada corte.
  const push = 1 + 0.05 * Math.min(1, segLocal / seg.length);
  const cut = seg.index > 0 ? interpolate(segLocal, [0, 6], [1, 0], clamp) : 0;
  const frozen = frame >= end - 1;
  const punch =
    frozen && isLast
      ? interpolate(frame - (end - 1), [0, 12], [0.08, 0], { ...clamp, easing: Easing.out(Easing.cubic) })
      : 0;
  // El carrete anterior se apaga en blanco y negro mientras entra el siguiente.
  const fade = !isLast && frozen ? interpolate(frame - end, [0, WIPE_FRAMES], [0, 1], clamp) : 0;
  const wipe = wipeProgress(local);
  const x = wipeX(wipe);

  return (
    <AbsoluteFill
      style={{
        clipPath: wipe < 1 ? `polygon(0 0, ${x + SLANT}px 0, ${x - SLANT}px 1920px, 0 1920px)` : undefined,
      }}
    >
      <AbsoluteFill
        style={{
          transform: `scale(${push + cut * 0.05 + punch})`,
          filter: fade > 0 ? `grayscale(${fade}) brightness(${1 - 0.4 * fade})` : undefined,
        }}
      >
        {!frozen && (
          <Sequence from={start} durationInFrames={Math.max(1, length - 1)}>
            <OffthreadVideo src={staticFile(`clips/${slug}-${index}.mp4`)} muted style={{ width: 1080, height: 1920 }} />
          </Sequence>
        )}
        {frozen && <Img src={staticFile(`clips/${slug}-${index}.png`)} style={{ width: 1080, height: 1920 }} />}
      </AbsoluteFill>
      <AbsoluteFill style={{ backgroundColor: "#ffffff", opacity: cut * 0.35 }} />
    </AbsoluteFill>
  );
};

/** Sin clip: repetición de la propia jugada del juego, donde se destapa la respuesta. */
const RevealLayer: React.FC<{ item: ClipItem; t: Timeline }> = ({ item, t }) => {
  const frame = useCurrentFrame();
  const local = frame - t.clipStart;
  const wipe = wipeProgress(local);
  const x = wipeX(wipe);
  const punch = interpolate(frame, [t.freezeStart, t.freezeStart + 12], [0.04, 0], {
    ...clamp,
    easing: Easing.out(Easing.cubic),
  });
  const zoom = frame < t.freezeStart ? interpolate(local, [0, REVEAL_FRAMES], [1.04, 1], clamp) : 1 + punch;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: colors.bg,
        clipPath: wipe < 1 ? `polygon(0 0, ${x + SLANT}px 0, ${x - SLANT}px 1920px, 0 1920px)` : undefined,
      }}
    >
      <Background />
      <AbsoluteFill style={{ transform: `translateY(-40px) scale(${0.86 * zoom})`, transformOrigin: "50% 0%" }}>
        <ModePhase item={item} start={t.clipStart - 400} revealAt={t.clipStart + REVEAL_LOCK} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/** Línea de fuera de juego que barre la pantalla al entrar cada carrete. */
const WipeLine: React.FC<{ t: Timeline }> = ({ t }) => {
  const frame = useCurrentFrame();
  const idx = t.reelStarts.findIndex((s) => frame >= s && frame < s + WIPE_FRAMES + 4);
  if (idx < 0) return null;
  const local = frame - t.reelStarts[idx];
  const x = wipeX(wipeProgress(local));
  const opacity = interpolate(local, [WIPE_FRAMES, WIPE_FRAMES + 4], [1, 0], clamp);
  const angle = (Math.atan2(SLANT * 2, 1920) * 180) / Math.PI;

  return (
    <AbsoluteFill style={{ opacity }}>
      <div
        style={{
          position: "absolute",
          left: x - 240,
          top: -120,
          width: 240,
          height: 2160,
          background: "linear-gradient(to left, rgba(57,226,122,0.4), rgba(57,226,122,0))",
          transform: `rotate(${angle}deg)`,
          transformOrigin: "100% 50%",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: x - 7,
          top: -120,
          width: 14,
          height: 2160,
          background: colors.varGreen,
          boxShadow: "0 0 44px 14px rgba(57,226,122,0.6)",
          transform: `rotate(${angle}deg)`,
        }}
      />
    </AbsoluteFill>
  );
};

const Hud: React.FC<{ item: ClipItem; t: Timeline }> = ({ item, t }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (frame > t.freezeStart + 10) return null;

  const out = interpolate(frame, [t.freezeStart, t.freezeStart + 8], [1, 0], clamp);
  const enter = spring({ frame: frame - t.clipStart - 10, fps, config: { damping: 14 } });
  const blink = Math.floor(frame / 15) % 2 === 0 ? 1 : 0.25;

  const reelIdx = t.reelStarts.reduce((acc, s, i) => (frame >= s ? i : acc), 0);
  const reel = item.reels[reelIdx] as Reel | undefined;
  const seg = reel
    ? segmentAt(reel, Math.min(frame - t.reelStarts[reelIdx], t.reelLengths[reelIdx] - 1))
    : { index: 0, start: 0, length: 1 };
  const label = reel?.segments[seg.index]?.label;
  const labelIn = spring({ frame: frame - t.reelStarts[reelIdx] - seg.start - 4, fps, config: { damping: 13 } });

  return (
    <AbsoluteFill style={{ opacity: out }}>
      <div
        style={{
          position: "absolute",
          top: SAFE.top + 24,
          left: SAFE.left,
          display: "flex",
          alignItems: "center",
          gap: 16,
          padding: "12px 26px",
          borderRadius: 999,
          background: "rgba(4,17,10,0.72)",
          border: `2px solid ${colors.line}`,
          fontWeight: 800,
          fontSize: 32,
          letterSpacing: 3,
          textTransform: "uppercase",
          opacity: enter,
          transform: `translateY(${(1 - enter) * -30}px)`,
        }}
      >
        <span
          style={{
            width: 18,
            height: 18,
            borderRadius: 999,
            background: colors.goalKo,
            opacity: blink,
            boxShadow: `0 0 14px rgba(248,113,113,${blink})`,
          }}
        />
        Revisión VAR
      </div>
      {label && (
        <div
          style={{
            position: "absolute",
            top: 1560,
            left: SAFE.left,
            maxWidth: CONTENT_WIDTH,
            fontFamily: fonts.display,
            fontSize: 46,
            lineHeight: 1,
            textTransform: "uppercase",
            letterSpacing: 1,
            color: colors.bg,
            background: colors.varGreen,
            padding: "16px 28px 14px",
            borderRadius: 14,
            boxShadow: "0 10px 40px rgba(0,0,0,0.5)",
            opacity: labelIn,
            transform: `translateX(${(1 - labelIn) * -60}px)`,
          }}
        >
          {label}
        </div>
      )}
    </AbsoluteFill>
  );
};

/** Flash y sombra inferior al congelar el fotograma del gol. */
const FreezeFx: React.FC<{ t: Timeline }> = ({ t }) => {
  const frame = useCurrentFrame();
  if (frame < t.freezeStart) return null;
  const flash = interpolate(frame, [t.freezeStart, t.freezeStart + 10], [0.6, 0], clamp);
  const shade =
    interpolate(frame, [t.freezeStart + 4, t.freezeStart + 14], [0, 1], clamp) *
    interpolate(frame, [t.outroStart, t.outroStart + 10], [1, 0], clamp);
  return (
    <>
      <AbsoluteFill
        style={{
          opacity: shade,
          background: "linear-gradient(to top, rgba(10,13,11,0.94) 0%, rgba(10,13,11,0.8) 32%, rgba(10,13,11,0) 58%)",
        }}
      />
      <AbsoluteFill style={{ backgroundColor: "#ffffff", opacity: flash }} />
    </>
  );
};

/* ───────────────────────── Veredicto ───────────────────────── */

const Verdict: React.FC<{ item: ClipItem; t: Timeline }> = ({ item, t }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (frame < t.verdictStart || frame > t.outroStart + 12) return null;

  const banner = spring({ frame: frame - t.verdictStart, fps, config: { damping: 8, stiffness: 170 } });
  const title = spring({ frame: frame - t.verdictStart - 10, fps, config: { damping: 12 } });
  const fact = spring({ frame: frame - t.verdictStart - 22, fps, config: { damping: 15 } });
  const out = interpolate(frame, [t.outroStart, t.outroStart + 10], [1, 0], clamp);

  return (
    <div
      style={{
        position: "absolute",
        left: SAFE.left,
        width: CONTENT_WIDTH,
        top: 1120,
        display: "flex",
        flexDirection: "column",
        gap: 20,
        opacity: out,
      }}
    >
      <div
        style={{
          background: colors.varGreen,
          color: colors.bg,
          fontFamily: fonts.display,
          fontSize: 104,
          lineHeight: 1,
          padding: "22px 0 16px",
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
          fontFamily: fonts.display,
          fontSize: 74,
          lineHeight: 1,
          textTransform: "uppercase",
          textAlign: "center",
          letterSpacing: 1,
          textShadow: "0 4px 30px rgba(0,0,0,0.9)",
          opacity: title,
          transform: `translateY(${(1 - title) * 40}px)`,
        }}
      >
        {item.answer_title}
      </div>
      <div
        style={{
          background: "rgba(17,22,19,0.92)",
          border: `3px solid ${colors.line}`,
          borderLeft: `10px solid ${colors.varGreen}`,
          borderRadius: 24,
          padding: "22px 30px",
          fontWeight: 600,
          fontSize: 40,
          lineHeight: 1.24,
          opacity: fact,
          transform: `translateY(${(1 - fact) * 50}px)`,
        }}
      >
        {item.explanation_es}
      </div>
    </div>
  );
};

/** Lluvia de confeti verde y blanco al confirmar el gol. */
const Celebration: React.FC<{ t: Timeline }> = ({ t }) => {
  const frame = useCurrentFrame();
  const local = frame - t.verdictStart;
  if (local < 0 || local > 70) return null;

  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {Array.from({ length: 40 }).map((_, i) => {
        const angle = random(`a${i}`) * Math.PI * 2;
        const speed = 18 + random(`s${i}`) * 26;
        const x = 520 + Math.cos(angle) * speed * local;
        const y = 1100 + Math.sin(angle) * speed * local + 0.9 * local * local;
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

/* ───────────────────────── Cierre ───────────────────────── */

const Outro: React.FC<{ item: ClipItem; t: Timeline }> = ({ item, t }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (frame < t.outroStart) return null;

  const local = frame - t.outroStart;
  const text = spring({ frame: local - 10, fps, config: { damping: 13 } });
  const monitor = interpolate(local, [8, 26], [0, 1], clamp);
  const cta = spring({ frame: local - 22, fps, config: { damping: 13 } });
  const pill = spring({ frame: local - 30, fps, config: { damping: 10, stiffness: 160 } });

  const qEnd = item.cta.indexOf("?");
  const first = qEnd >= 0 ? item.cta.slice(0, qEnd + 1) : item.cta;
  const rest = qEnd >= 0 ? item.cta.slice(qEnd + 1).trim() : "";
  const monitorHeight = OUTRO.monitorWidth * 0.66;

  return (
    <AbsoluteFill>
      <div
        style={{
          position: "absolute",
          left: OUTRO.textLeft,
          width: OUTRO.textWidth,
          top: OUTRO.monitorTop + monitorHeight / 2,
          transform: `translate(${(1 - text) * -60}px, -50%)`,
          opacity: text,
          fontFamily: fonts.display,
          fontSize: 171,
          lineHeight: 0.98,
          letterSpacing: 1.5,
          textAlign: "right",
        }}
      >
        <div>CHECK</div>
        <div>THE</div>
      </div>
      <div style={{ position: "absolute", left: OUTRO.monitorLeft, top: OUTRO.monitorTop, opacity: monitor }}>
        <VarMonitor width={OUTRO.monitorWidth}>
          <span />
        </VarMonitor>
      </div>
      <div
        style={{
          position: "absolute",
          left: SAFE.left,
          width: CONTENT_WIDTH,
          top: 900,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          textAlign: "center",
        }}
      >
        <div
          style={{
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
          checkthevar.app
        </div>
      </div>
    </AbsoluteFill>
  );
};

/* ───────────────────────── Sonido (efectos propios, sin música) ───────────────────────── */

const Sfx: React.FC<{ item: ClipItem; t: Timeline }> = ({ item, t }) => {
  const q = item.question;
  const quickAnswers =
    q.mode === "survival" ? q.questions.slice(0, -1).map((_, i) => t.questionStart + i * SURVIVAL_QUICK + 33) : [];
  const cuts: number[] = [];
  item.reels.forEach((reel, r) => {
    let f = t.reelStarts[r];
    reel.segments.forEach((s, i) => {
      if (i > 0) cuts.push(f);
      f += segFrames(s);
    });
  });

  return (
    <>
      <Sequence from={0} durationInFrames={20}>
        <Audio src={staticFile("sfx/hit.wav")} volume={0.9} />
      </Sequence>
      <Sequence from={t.questionStart} durationInFrames={20}>
        <Audio src={staticFile("sfx/whoosh.wav")} volume={0.6} />
      </Sequence>
      {quickAnswers.map((f) => (
        <Sequence key={`qa${f}`} from={f} durationInFrames={24}>
          <Audio src={staticFile("sfx/confirm.wav")} volume={0.45} />
        </Sequence>
      ))}
      {[0, 1, 2].map((s) => (
        <Sequence key={`tick${s}`} from={t.countdownStart + s * 30} durationInFrames={6}>
          <Audio src={staticFile("sfx/tick.wav")} volume={0.7} />
        </Sequence>
      ))}
      <Sequence from={t.buttonPress} durationInFrames={20}>
        <Audio src={staticFile("sfx/whistle.wav")} volume={0.55} />
      </Sequence>
      <Sequence from={t.overlayStart} durationInFrames={28}>
        <Audio src={staticFile("sfx/buzz.wav")} volume={0.7} />
      </Sequence>
      {t.reelStarts.map((f) => (
        <Sequence key={`reel${f}`} from={f} durationInFrames={20}>
          <Audio src={staticFile("sfx/whoosh.wav")} volume={0.7} />
        </Sequence>
      ))}
      {cuts.map((f) => (
        <Sequence key={`cut${f}`} from={f} durationInFrames={12}>
          <Audio src={staticFile("sfx/hit.wav")} volume={0.3} />
        </Sequence>
      ))}
      <Sequence from={t.verdictStart} durationInFrames={30}>
        <Audio src={staticFile("sfx/confirm.wav")} volume={0.8} />
      </Sequence>
      <Sequence from={t.outroStart} durationInFrames={15}>
        <Audio src={staticFile("sfx/whoosh.wav")} volume={0.5} />
      </Sequence>
    </>
  );
};
