/**
 * GenericPromo.tsx
 * Data-driven promotional video composition.
 * Accepts a PromoScript as props; style_seed drives random visual variety
 * across 10 independent dimensions (A–J) via StyleConfig.
 */
import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  interpolate,
  spring,
  Easing,
  Img,
} from "remotion";
import { StyleConfig, DEFAULT_STYLE, buildStyleConfig } from "../styles/StyleConfig";
import { BackgroundLayer } from "../components/BackgroundLayer";
import { CursorLayer, CursorKeyframe } from "../components/CursorLayer";
import { CalloutLayer } from "../components/CalloutLayer";
import { AttentionGuide } from "../components/AttentionGuide";
import { ClickBurst } from "../components/ClickBurst";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface IntroScene {
  type: "intro";
  duration: number;
  title: string;
  subtitle: string;
}

export interface InteractionScene {
  type: "interaction";
  duration: number;
  before_url: string;
  after_url: string;
  ss_height: number;
  scroll_before: number;
  scroll_after: number;
  click_x: number | null;
  click_y: number | null;
  callout_text: string;
  callout_side?: "left" | "right";
  step_number: number;
}

export interface ResultScene {
  type: "result";
  duration: number;
  screenshot_url: string;
  ss_height: number;
  scroll: number;
  callout_text: string;
}

export interface OutroScene {
  type: "outro";
  duration: number;
  cta: string;
}

export type SceneConfig = IntroScene | InteractionScene | ResultScene | OutroScene;

export interface PromoScript {
  product_name: string;
  tagline: string;
  accent_color: string;
  url?: string;
  style_seed?: string; // drives random style selection; omit for defaults
  scenes: SceneConfig[];
}

export interface GenericPromoProps {
  script: PromoScript;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const W = 1080;
const H = 1920;
const FRAME_TOP = 200;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function computeStartFrames(scenes: SceneConfig[]): number[] {
  let acc = 0;
  return scenes.map((s) => { const start = acc; acc += s.duration; return start; });
}

// ─── SceneTransitionWrapper (Dimension C) ────────────────────────────────────

const SceneTransitionWrapper: React.FC<{
  styleC: StyleConfig["C"];
  localFrame: number;
  children: React.ReactNode;
}> = ({ styleC, localFrame, children }) => {
  if (styleC === "C1") return <>{children}</>;

  // C4: Scale Punch — new scene bounces in from slightly small
  if (styleC === "C4") {
    const DUR = 14;
    const scale =
      localFrame < DUR
        ? interpolate(localFrame, [0, 6, 10, DUR], [0.88, 1.04, 0.98, 1.0], {
            extrapolateRight: "clamp",
          })
        : 1;
    return (
      <div style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", transform: `scale(${scale})`, transformOrigin: "50% 50%" }}>
        {children}
      </div>
    );
  }

  // C7: Glitch Flash — brief horizontal jitter + oversaturation
  if (styleC === "C7") {
    if (localFrame > 8) return <>{children}</>;
    const JITTER = [0, 18, -15, 20, -12, 8, -4, 0, 0];
    const gx = JITTER[Math.min(localFrame, JITTER.length - 1)] ?? 0;
    const sat = localFrame < 5 ? 2.2 : 1;
    return (
      <div style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", transform: `translateX(${gx}px)`, filter: `saturate(${sat})` }}>
        {children}
      </div>
    );
  }

  // C9: Blur Dissolve — fade in from blur
  if (styleC === "C9") {
    const DUR = 14;
    const blurVal = localFrame < DUR ? interpolate(localFrame, [0, DUR], [14, 0], { extrapolateRight: "clamp" }) : 0;
    const opacity = localFrame < DUR ? interpolate(localFrame, [0, DUR], [0, 1], { extrapolateRight: "clamp" }) : 1;
    return (
      <div style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", filter: `blur(${blurVal}px)`, opacity }}>
        {children}
      </div>
    );
  }

  return <>{children}</>;
};

// ─── ScreenView (Dimensions B, J) ────────────────────────────────────────────

const ScreenView: React.FC<{
  url: string;
  ssHeight: number;
  scrollOffset: number;
  localFrame: number;
  entrance?: boolean;
  opacity?: number;
  styleB: StyleConfig["B"];
  styleJ: StyleConfig["J"];
  sceneDuration: number;
  accentColor: string;
}> = ({
  url, ssHeight, scrollOffset, localFrame,
  entrance = false, opacity = 1,
  styleB, styleJ, sceneDuration, accentColor,
}) => {
  // Entrance animation (always-on for first interaction scene)
  const enterP = entrance
    ? spring({ frame: localFrame, fps: 30, config: { damping: 28, stiffness: 120 }, durationInFrames: 35 })
    : 1;
  const rotX = interpolate(enterP, [0, 1], [20, 0]);
  const transY = interpolate(enterP, [0, 1], [100, 0]);
  const fadeIn = entrance
    ? interpolate(localFrame, [0, 12], [0, 1], { extrapolateRight: "clamp" })
    : 1;

  // J2: Ken Burns — slow scale + drift
  const kbScale = styleJ === "J2" ? 1 + localFrame * 0.00035 : 1;
  const kbX = styleJ === "J2" ? localFrame * 0.04 : 0;

  const combinedOpacity = fadeIn * opacity;

  // B4: Floating Card — screenshot inside rounded card
  if (styleB === "B4") {
    return (
      <div style={{ position: "absolute", top: 0, left: 0, width: W, height: H, overflow: "hidden", opacity: combinedOpacity }}>
        <div
          style={{
            position: "absolute", top: 0, left: 0, width: W, height: H,
            transformOrigin: "50% 30%",
            transform: `perspective(1400px) rotateX(${rotX}deg) translateY(${transY}px)`,
          }}
        >
          <div
            style={{
              position: "absolute",
              top: FRAME_TOP - 24,
              left: 44,
              right: 44,
              bottom: 90,
              borderRadius: 36,
              overflow: "hidden",
              boxShadow: `0 40px 100px rgba(0,0,0,0.70), 0 0 0 1.5px ${accentColor}44, 0 0 50px ${accentColor}18`,
              border: `1.5px solid ${accentColor}33`,
            }}
          >
            <Img
              src={url}
              style={{
                position: "absolute",
                top: -scrollOffset,
                left: 0,
                width: W - 88,
                height: ssHeight,
                transform: `scale(${kbScale}) translateX(${kbX}px)`,
                transformOrigin: "top left",
              }}
            />
            <div
              style={{
                position: "absolute", bottom: 0, left: 0, width: "100%", height: 200,
                background: "linear-gradient(to bottom, transparent, #050714)",
                pointerEvents: "none",
              }}
            />
          </div>
        </div>
      </div>
    );
  }

  // B1: Raw Masked (original)
  return (
    <div style={{ position: "absolute", top: 0, left: 0, width: W, height: H, overflow: "hidden", opacity: combinedOpacity }}>
      <div
        style={{
          position: "absolute", top: 0, left: 0, width: W, height: H,
          transformOrigin: "50% 30%",
          transform: `perspective(1400px) rotateX(${rotX}deg) translateY(${transY}px)`,
        }}
      >
        <Img
          src={url}
          style={{
            position: "absolute",
            top: FRAME_TOP - scrollOffset,
            left: 0,
            width: W,
            height: ssHeight,
            transform: `scale(${kbScale}) translateX(${kbX}px)`,
            transformOrigin: "top left",
          }}
        />
        {/* Top mask */}
        <div style={{ position: "absolute", top: 0, left: 0, width: W, height: FRAME_TOP + 40, background: "linear-gradient(to bottom, #050714 55%, transparent)", pointerEvents: "none" }} />
        {/* Bottom mask */}
        <div style={{ position: "absolute", bottom: 0, left: 0, width: W, height: 320, background: "linear-gradient(to bottom, transparent, #050714)", pointerEvents: "none" }} />
      </div>
    </div>
  );
};

// ─── IntroSceneView (Dimension H) ────────────────────────────────────────────

const IntroSceneView: React.FC<{
  scene: IntroScene;
  localFrame: number;
  accentColor: string;
  styleH: StyleConfig["H"];
}> = ({ scene, localFrame, accentColor, styleH }) => {
  // H4: Typewriter Resolve — characters scramble then lock in
  if (styleH === "H4") {
    const CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz@#$%!?0123456789";
    const RESOLVE_START = 6;
    const STAGGER = 3;
    const CHAR_DUR = 4;
    const displayChars = scene.title.split("").map((ch, ci) => {
      if (ch === " ") return " ";
      const resolveAt = RESOLVE_START + ci * STAGGER;
      if (localFrame >= resolveAt + CHAR_DUR) return ch;
      const idx = Math.abs((ci * 7 + localFrame * 11) % CHARS.length);
      if (localFrame >= resolveAt) {
        const prog = (localFrame - resolveAt) / CHAR_DUR;
        return prog > 0.65 ? ch : CHARS[idx];
      }
      return CHARS[Math.abs((ci * 7 + localFrame * 3) % CHARS.length)];
    });
    const titleOpacity = interpolate(localFrame, [2, 14], [0, 1], { extrapolateRight: "clamp" });
    const subtitleOpacity = interpolate(
      localFrame,
      [scene.title.length * STAGGER + RESOLVE_START, scene.title.length * STAGGER + RESOLVE_START + 16],
      [0, 1],
      { extrapolateRight: "clamp" }
    );
    return (
      <AbsoluteFill style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <div style={{ fontSize: 88, fontWeight: 900, fontFamily: "'Courier New', 'SF Mono', monospace", textAlign: "center", opacity: titleOpacity, color: "#ffffff", lineHeight: 1.1, padding: "0 60px", letterSpacing: 3 }}>
          {displayChars.join("")}
        </div>
        <div style={{ width: 60, height: 3, background: accentColor, borderRadius: 2, marginTop: 40, boxShadow: `0 0 14px ${accentColor}`, opacity: subtitleOpacity }} />
        <div style={{ color: "#94a3b8", fontSize: 34, fontFamily: "'Courier New', monospace", fontWeight: 400, textAlign: "center", marginTop: 28, opacity: subtitleOpacity, padding: "0 80px", lineHeight: 1.45 }}>
          {scene.subtitle}
        </div>
      </AbsoluteFill>
    );
  }

  // H5: Record Start — REC blink then title appears
  if (styleH === "H5") {
    const REC_DUR = 20;
    const recCrossfade = interpolate(localFrame, [REC_DUR - 8, REC_DUR + 4], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
    const recOn = Math.floor(localFrame / 8) % 2 === 0;
    const titleFrame = Math.max(0, localFrame - REC_DUR);
    const titleSpring = spring({ frame: titleFrame, fps: 30, config: { damping: 22, stiffness: 120 }, durationInFrames: 35 });
    const titleY = interpolate(titleSpring, [0, 1], [80, 0]);
    const titleOpacity = interpolate(titleFrame, [0, 20], [0, 1], { extrapolateRight: "clamp" });
    const subtitleOpacity = interpolate(titleFrame, [18, 42], [0, 1], { extrapolateRight: "clamp" });
    return (
      <AbsoluteFill style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        {/* REC indicator */}
        {localFrame < REC_DUR + 4 && (
          <div style={{ position: "absolute", top: 60, left: 60, display: "flex", alignItems: "center", gap: 14, opacity: recCrossfade }}>
            <div style={{ width: 20, height: 20, borderRadius: "50%", background: "#ef4444", boxShadow: recOn ? "0 0 16px #ef4444" : "none", opacity: recOn ? 1 : 0.25 }} />
            <span style={{ fontFamily: "monospace", fontSize: 30, fontWeight: 700, color: recOn ? "#ef4444" : "#ef444455", letterSpacing: 4 }}>REC</span>
          </div>
        )}
        {/* Title */}
        <div style={{ fontSize: 92, fontWeight: 900, fontFamily: "system-ui, -apple-system, sans-serif", textAlign: "center", transform: `translateY(${titleY}px)`, opacity: titleOpacity, background: `linear-gradient(135deg, #ffffff 20%, ${accentColor} 75%)`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", lineHeight: 1.1, padding: "0 60px", letterSpacing: -1 }}>
          {scene.title}
        </div>
        <div style={{ width: interpolate(titleFrame, [22, 48], [0, 480], { easing: Easing.out(Easing.cubic), extrapolateRight: "clamp" }), height: 3, background: `linear-gradient(to right, transparent, ${accentColor}, transparent)`, marginTop: 36, borderRadius: 2 }} />
        <div style={{ color: "#94a3b8", fontSize: 36, fontFamily: "system-ui, -apple-system, sans-serif", fontWeight: 400, textAlign: "center", marginTop: 32, opacity: subtitleOpacity, padding: "0 80px", lineHeight: 1.45, letterSpacing: 0.5 }}>
          {scene.subtitle}
        </div>
      </AbsoluteFill>
    );
  }

  // H1: Text Spring (default / original)
  const titleSpring = spring({ frame: localFrame, fps: 30, config: { damping: 22, stiffness: 120 }, durationInFrames: 35 });
  const titleY = interpolate(titleSpring, [0, 1], [80, 0]);
  const titleOpacity = interpolate(localFrame, [0, 20], [0, 1], { extrapolateRight: "clamp" });
  const subtitleOpacity = interpolate(localFrame, [18, 42], [0, 1], { extrapolateRight: "clamp" });
  const lineWidth = interpolate(localFrame, [22, 48], [0, 480], { easing: Easing.out(Easing.cubic), extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
      <div style={{ fontSize: 92, fontWeight: 900, fontFamily: "system-ui, -apple-system, sans-serif", textAlign: "center", transform: `translateY(${titleY}px)`, opacity: titleOpacity, background: `linear-gradient(135deg, #ffffff 20%, ${accentColor} 75%)`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", lineHeight: 1.1, padding: "0 60px", letterSpacing: -1 }}>
        {scene.title}
      </div>
      <div style={{ width: lineWidth, height: 3, background: `linear-gradient(to right, transparent, ${accentColor}, transparent)`, marginTop: 36, borderRadius: 2 }} />
      <div style={{ color: "#94a3b8", fontSize: 36, fontFamily: "system-ui, -apple-system, sans-serif", fontWeight: 400, textAlign: "center", marginTop: 32, opacity: subtitleOpacity, padding: "0 80px", lineHeight: 1.45, letterSpacing: 0.5 }}>
        {scene.subtitle}
      </div>
      <div style={{ width: 10, height: 10, borderRadius: "50%", background: accentColor, marginTop: 52, opacity: subtitleOpacity, boxShadow: `0 0 20px ${accentColor}` }} />
    </AbsoluteFill>
  );
};

// ─── InteractionSceneView (Dimensions D, E, G, F, J, B) ──────────────────────

const InteractionSceneView: React.FC<{
  scene: InteractionScene;
  localFrame: number;
  accentColor: string;
  entrance: boolean;
  style: StyleConfig;
}> = ({ scene, localFrame, accentColor, entrance, style }) => {
  const {
    before_url, after_url, ss_height,
    scroll_before, scroll_after,
    click_x, click_y,
    callout_text, step_number, duration,
  } = scene;

  const CLICK_AT = 24;
  const CROSSFADE_END = CLICK_AT + 18;

  const canvasClickX = click_x ?? W / 2;
  const canvasClickY =
    click_x !== null && click_y !== null
      ? FRAME_TOP + click_y - scroll_before
      : H * 0.5;

  const hasCursor = click_x !== null;

  // ── Dimension J: screenshot scroll animation ──────────────────────────────
  const scrollBefore = scroll_before;
  const scrollAfter =
    style.J === "J4"
      ? interpolate(localFrame, [CLICK_AT, CLICK_AT + 22], [scroll_before, scroll_after], {
          easing: Easing.inOut(Easing.cubic),
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        })
      : scroll_after;

  // ── Dimension E: before→after reveal ─────────────────────────────────────
  let beforeOpacity = 1;
  let afterOpacity = 0;
  let afterClipPath: string | undefined;

  if (style.E === "E1") {
    // Opacity crossfade
    const crossfade = interpolate(localFrame, [CLICK_AT, CROSSFADE_END], [0, 1], {
      extrapolateLeft: "clamp", extrapolateRight: "clamp",
    });
    beforeOpacity = 1 - crossfade;
    afterOpacity = crossfade;
  } else if (style.E === "E2") {
    // Ripple Reveal — circular clip expanding from click point
    const r = interpolate(localFrame, [CLICK_AT, CLICK_AT + 24], [0, 2400], {
      extrapolateLeft: "clamp", extrapolateRight: "clamp",
    });
    beforeOpacity = 1;
    afterOpacity = localFrame >= CLICK_AT ? 1 : 0;
    afterClipPath = localFrame >= CLICK_AT
      ? `circle(${r}px at ${canvasClickX}px ${canvasClickY}px)`
      : "circle(0px at 0px 0px)";
  } else if (style.E === "E6") {
    // Glitch Replace — brief RGB jitter then hard cut
    const GLITCH_END = CLICK_AT + 6;
    if (localFrame < CLICK_AT) {
      beforeOpacity = 1;
      afterOpacity = 0;
    } else if (localFrame < GLITCH_END) {
      beforeOpacity = 1;
      afterOpacity = 0;
    } else {
      beforeOpacity = 0;
      afterOpacity = 1;
    }
  }

  const isGlitching = style.E === "E6" && localFrame >= CLICK_AT && localFrame < CLICK_AT + 6;
  const glitchOffset = isGlitching
    ? [0, 14, -11, 16, -9, 6][Math.min(localFrame - CLICK_AT, 5)]
    : 0;

  // ── Cursor keyframes ──────────────────────────────────────────────────────
  const cursorKeyframes: CursorKeyframe[] = hasCursor
    ? [
        { frame: 0, x: 1150, y: 40 },
        { frame: CLICK_AT - 4, x: canvasClickX, y: canvasClickY },
        { frame: CLICK_AT + 4, x: canvasClickX, y: canvasClickY },
        { frame: duration - 4, x: 1200, y: H + 60 },
      ]
    : [];

  const calloutStart = 6;
  const showCallout = localFrame >= calloutStart;

  const screenProps = {
    ssHeight: ss_height,
    localFrame,
    entrance,
    styleB: style.B,
    styleJ: style.J,
    sceneDuration: duration,
    accentColor,
  };

  return (
    <>
      {/* Before screenshot */}
      <div style={{ position: "absolute", top: 0, left: 0, width: W, height: H, transform: `translateX(${glitchOffset}px)`, filter: isGlitching ? `saturate(2.2) hue-rotate(${glitchOffset * 2}deg)` : "none" }}>
        <ScreenView
          url={before_url}
          scrollOffset={scrollBefore}
          opacity={beforeOpacity}
          {...screenProps}
          entrance={entrance}
        />
      </div>

      {/* After screenshot */}
      {afterOpacity > 0 && (
        <div style={{ position: "absolute", top: 0, left: 0, width: W, height: H, clipPath: afterClipPath }}>
          <ScreenView
            url={after_url}
            scrollOffset={scrollAfter}
            opacity={afterOpacity}
            {...screenProps}
            entrance={false}
          />
        </div>
      )}

      {/* Attention guide (pre-click) — Dimension D */}
      {hasCursor && (
        <AttentionGuide
          frame={localFrame}
          clickAt={CLICK_AT}
          targetX={canvasClickX}
          targetY={canvasClickY}
          accentColor={accentColor}
          style={style.D}
        />
      )}

      {/* Click burst */}
      {hasCursor && (
        <ClickBurst
          frame={localFrame - CLICK_AT}
          x={canvasClickX}
          y={canvasClickY}
          color={accentColor}
        />
      )}

      {/* Cursor — Dimension G */}
      {hasCursor && (
        <CursorLayer
          frame={localFrame}
          fps={30}
          keyframes={cursorKeyframes}
          clickFrames={[CLICK_AT]}
          style={style.G}
          accentColor={accentColor}
        />
      )}

      {/* Step callout — Dimension F */}
      {showCallout && (
        <CalloutLayer
          frame={localFrame - calloutStart}
          fps={30}
          step={step_number}
          title={callout_text}
          totalDuration={duration - calloutStart - 6}
          accentColor={accentColor}
          style={style.F}
        />
      )}
    </>
  );
};

// ─── ResultSceneView ──────────────────────────────────────────────────────────

const ResultSceneView: React.FC<{
  scene: ResultScene;
  localFrame: number;
  accentColor: string;
  stepNum: number;
  style: StyleConfig;
}> = ({ scene, localFrame, accentColor, stepNum, style }) => {
  const { screenshot_url, ss_height, scroll, callout_text, duration } = scene;

  const revealProgress = interpolate(localFrame, [0, 32], [0, 1], {
    easing: Easing.out(Easing.cubic),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const clipBottom = interpolate(revealProgress, [0, 1], [100, 0]);

  const glowAlpha = Math.round((0.08 + Math.sin(localFrame * 0.14) * 0.06) * 255)
    .toString(16)
    .padStart(2, "0");

  const calloutStart = 28;
  const showCallout = localFrame >= calloutStart;

  return (
    <>
      <div style={{ position: "absolute", top: 0, left: 0, width: W, height: H, clipPath: `inset(0 0 ${clipBottom}% 0)` }}>
        <ScreenView
          url={screenshot_url}
          ssHeight={ss_height}
          scrollOffset={scroll}
          localFrame={localFrame}
          entrance={false}
          opacity={1}
          styleB={style.B}
          styleJ={style.J}
          sceneDuration={duration}
          accentColor={accentColor}
        />
      </div>

      <div style={{ position: "absolute", top: FRAME_TOP, left: 0, width: W, height: 800, background: `radial-gradient(ellipse at 50% 35%, ${accentColor}${glowAlpha} 0%, transparent 60%)`, pointerEvents: "none", mixBlendMode: "screen" }} />

      {showCallout && (
        <CalloutLayer
          frame={localFrame - calloutStart}
          fps={30}
          step={stepNum}
          title={callout_text}
          totalDuration={duration - calloutStart - 6}
          accentColor={accentColor}
          style={style.F}
        />
      )}
    </>
  );
};

// ─── OutroSceneView (Dimension I) ────────────────────────────────────────────

// I5: Confetti burst + CTA
const CONFETTI = Array.from({ length: 32 }, (_, i) => ({
  angle: (i / 32) * Math.PI * 2,
  speed: 6 + (i % 5) * 2.4,
  colorIdx: i % 3,
  w: 10 + (i % 4) * 5,
  h: 6 + (i % 3) * 4,
  spinRate: ((i % 5) - 2) * 4.5,
  gravity: 0.08 + (i % 4) * 0.03,
}));

const OutroSceneView: React.FC<{
  scene: OutroScene;
  localFrame: number;
  accentColor: string;
  styleI: StyleConfig["I"];
}> = ({ scene, localFrame, accentColor, styleI }) => {
  const { duration, cta } = scene;

  // I5: Confetti Burst
  if (styleI === "I5") {
    const colors = [accentColor, "#f59e0b", "#10b981"];
    const BURST_AT = 8;
    const f = Math.max(0, localFrame - BURST_AT);
    const ctaOpacity = interpolate(localFrame, [22, 36], [0, 1], { extrapolateRight: "clamp" });
    const ctaScale = interpolate(
      spring({ frame: Math.max(0, localFrame - 22), fps: 30, config: { damping: 18, stiffness: 110 }, durationInFrames: 28 }),
      [0, 1], [0.85, 1]
    );
    const fadeOut = interpolate(localFrame, [duration - 12, duration], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

    return (
      <AbsoluteFill style={{ display: "flex", alignItems: "center", justifyContent: "center", opacity: fadeOut }}>
        {/* Confetti */}
        <div style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", pointerEvents: "none" }}>
          {CONFETTI.map((p, i) => {
            const vx = Math.cos(p.angle) * p.speed;
            const vy = Math.sin(p.angle) * p.speed;
            const x = W / 2 + vx * f;
            const y = H / 2 + (vy * f + p.gravity * f * f);
            const rot = p.spinRate * f;
            const op = interpolate(f, [0, 18, 55], [0, 0.92, 0], { extrapolateRight: "clamp" });
            return (
              <div key={i} style={{ position: "absolute", left: x - p.w / 2, top: y - p.h / 2, width: p.w, height: p.h, background: colors[p.colorIdx], borderRadius: 3, transform: `rotate(${rot}deg)`, opacity: op }} />
            );
          })}
        </div>
        {/* CTA */}
        <div style={{ textAlign: "center", opacity: ctaOpacity, transform: `scale(${ctaScale})` }}>
          <div style={{ fontSize: 72, fontWeight: 900, fontFamily: "system-ui, -apple-system, sans-serif", background: `linear-gradient(135deg, #ffffff 25%, ${accentColor})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", letterSpacing: -1 }}>
            {cta}
          </div>
          <div style={{ color: "#64748b", fontSize: 26, fontFamily: "system-ui", marginTop: 20, letterSpacing: 3, textTransform: "uppercase" }}>
            Start for free
          </div>
        </div>
      </AbsoluteFill>
    );
  }

  // I6: Cinematic Fade — minimal, elegant
  if (styleI === "I6") {
    const fadeIn = interpolate(localFrame, [0, 22], [0, 1], { extrapolateRight: "clamp" });
    const fadeOut = interpolate(localFrame, [duration - 14, duration], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
    const opacity = Math.min(fadeIn, fadeOut);
    const scale = interpolate(localFrame, [0, duration], [1.06, 1.0], { extrapolateRight: "clamp" });
    return (
      <AbsoluteFill style={{ display: "flex", alignItems: "center", justifyContent: "center", opacity }}>
        <div style={{ textAlign: "center", transform: `scale(${scale})` }}>
          <div style={{ fontSize: 80, fontWeight: 900, fontFamily: "system-ui, -apple-system, sans-serif", color: "#ffffff", letterSpacing: -2, marginBottom: 16 }}>
            {cta}
          </div>
          <div style={{ width: 60, height: 2, background: accentColor, borderRadius: 1, margin: "0 auto 20px", boxShadow: `0 0 12px ${accentColor}` }} />
          <div style={{ color: "#475569", fontSize: 24, letterSpacing: 4, textTransform: "uppercase", fontFamily: "system-ui" }}>
            Start for free
          </div>
        </div>
      </AbsoluteFill>
    );
  }

  // I1: Brand Card + Rings (original)
  const fadeIn = interpolate(localFrame, [0, 22], [0, 1], { extrapolateRight: "clamp" });
  const fadeOut = interpolate(localFrame, [duration - 12, duration], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const opacity = Math.min(fadeIn, fadeOut);
  const cardScale = interpolate(
    spring({ frame: localFrame, fps: 30, config: { damping: 18, stiffness: 100 }, durationInFrames: 30 }),
    [0, 1], [0.82, 1]
  );
  const ringScale = 1 + localFrame * 0.006;
  const ringOpacity = interpolate(localFrame, [0, 10, duration - 10, duration], [0, 0.25, 0.25, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", opacity }}>
      <div style={{ position: "absolute", width: 480, height: 480, borderRadius: "50%", border: `1.5px solid ${accentColor}`, opacity: ringOpacity, transform: `scale(${ringScale})` }} />
      <div style={{ position: "absolute", width: 560, height: 560, borderRadius: "50%", border: `1px solid ${accentColor}`, opacity: ringOpacity * 0.5, transform: `scale(${ringScale * 1.08})` }} />
      <div style={{ background: "rgba(10,10,26,0.92)", backdropFilter: "blur(32px)", border: `1px solid ${accentColor}44`, borderRadius: 36, padding: "64px 90px", textAlign: "center", boxShadow: `0 0 80px ${accentColor}18, 0 24px 72px rgba(0,0,0,0.55)`, transform: `scale(${cardScale})` }}>
        <div style={{ fontSize: 72, fontWeight: 900, fontFamily: "system-ui, -apple-system, sans-serif", background: `linear-gradient(135deg, #ffffff 25%, ${accentColor})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", lineHeight: 1.1, letterSpacing: -1 }}>
          {cta}
        </div>
        <div style={{ color: "#64748b", fontSize: 26, fontFamily: "system-ui, -apple-system, sans-serif", marginTop: 20, letterSpacing: 3, textTransform: "uppercase", fontWeight: 500 }}>
          Start for free
        </div>
        <div style={{ width: 60, height: 3, background: accentColor, borderRadius: 2, margin: "24px auto 0", boxShadow: `0 0 12px ${accentColor}` }} />
      </div>
    </AbsoluteFill>
  );
};

// ─── Default script ───────────────────────────────────────────────────────────

const defaultScript: PromoScript = {
  product_name: "Your Product",
  tagline: "See what it can do",
  accent_color: "#6366f1",
  scenes: [
    { type: "intro",  duration: 50, title: "Your Product", subtitle: "See what it can do" },
    { type: "outro", duration: 40, cta: "Try Your Product" },
  ],
};

// ─── Main composition ─────────────────────────────────────────────────────────

export const GenericPromo: React.FC<GenericPromoProps> = ({
  script = defaultScript,
}) => {
  const frame = useCurrentFrame();
  const { scenes, accent_color, style_seed } = script;
  const startFrames = computeStartFrames(scenes);

  // Derive deterministic style from seed (same seed → same look every render)
  const style: StyleConfig = style_seed
    ? buildStyleConfig(style_seed)
    : DEFAULT_STYLE;

  // Find current scene
  let currentIdx = 0;
  for (let i = 0; i < startFrames.length; i++) {
    if (frame >= startFrames[i]) currentIdx = i;
  }
  const currentScene = scenes[currentIdx];
  const localFrame = frame - startFrames[currentIdx];

  const firstInteractionIdx = scenes.findIndex((s) => s.type === "interaction");
  const interactionSceneCount = scenes.filter((s) => s.type === "interaction").length;

  return (
    <AbsoluteFill style={{ background: "#050714" }}>
      {/* Dimension A: background */}
      <BackgroundLayer frame={frame} style={style.A} accentColor={accent_color} />

      {/* Scene content — wrapped with Dimension C transition */}
      <SceneTransitionWrapper styleC={style.C} localFrame={localFrame}>
        {(() => {
          switch (currentScene.type) {
            case "intro":
              return (
                <IntroSceneView
                  scene={currentScene}
                  localFrame={localFrame}
                  accentColor={accent_color}
                  styleH={style.H}
                />
              );
            case "interaction":
              return (
                <InteractionSceneView
                  scene={currentScene}
                  localFrame={localFrame}
                  accentColor={accent_color}
                  entrance={currentIdx === firstInteractionIdx}
                  style={style}
                />
              );
            case "result":
              return (
                <ResultSceneView
                  scene={currentScene}
                  localFrame={localFrame}
                  accentColor={accent_color}
                  stepNum={interactionSceneCount + 1}
                  style={style}
                />
              );
            case "outro":
              return (
                <OutroSceneView
                  scene={currentScene}
                  localFrame={localFrame}
                  accentColor={accent_color}
                  styleI={style.I}
                />
              );
          }
        })()}
      </SceneTransitionWrapper>
    </AbsoluteFill>
  );
};
