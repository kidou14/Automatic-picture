/**
 * MockupPromo.tsx — V3 main Remotion composition
 *
 * Architecture:
 *   - BackgroundCinema  : atmospheric background (always present)
 *   - CameraRig         : CSS 3D perspective wrapper (always present)
 *     └ PhoneMockup     : CSS phone frame with <Video> screen (always present)
 *   - Scene overlays    : text / callouts / cursor / burst drawn on top
 *
 * The phone is always visible; the <Video> startFrom changes per scene to show
 * the correct moment of the screen recording.
 */
import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  Easing,
} from "remotion";
import { StyleConfig, DEFAULT_STYLE, buildStyleConfig } from "../styles/StyleConfig";
import { BackgroundCinema } from "../components/BackgroundCinema";
import { PhoneMockup, PHONE_W, PHONE_H } from "../components/PhoneMockup";
import { CameraRig } from "../components/CameraRig";
import { CalloutLayer } from "../components/CalloutLayer";
import { CursorLayer, CursorKeyframe } from "../components/CursorLayer";
import { AttentionGuide } from "../components/AttentionGuide";
import { ClickBurst } from "../components/ClickBurst";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface IntroScene {
  type: "intro";
  duration: number;
  title: string;
  subtitle: string;
  video_start_ms: number;
}

export interface InteractionScene {
  type: "interaction";
  duration: number;
  video_start_ms: number;
  click_ms: number;
  click_x: number | null;
  click_y: number | null;
  scroll_before?: number;
  callout_text: string;
  step_number: number;
}

export interface ResultScene {
  type: "result";
  duration: number;
  video_start_ms: number;
  callout_text: string;
}

export interface OutroScene {
  type: "outro";
  duration: number;
  cta: string;
}

export type SceneConfig = IntroScene | InteractionScene | ResultScene | OutroScene;

export interface MockupScript {
  product_name: string;
  tagline: string;
  accent_color: string;
  screen_video_url: string;
  background_video_url?: string;
  style_seed?: string;
  scenes: SceneConfig[];
}

export interface MockupPromoProps {
  script: MockupScript;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const W = 1080;
const H = 1920;

// Phone screen origin within the 1080×1920 canvas (phone is centered)
const PHONE_LEFT = (W - PHONE_W) / 2;    // 120px
const PHONE_TOP = (H - PHONE_H) / 2 - 40; // ~10px (CameraRig marginTop -40)
const SCREEN_INSET = 14;
const SCREEN_W = PHONE_W - SCREEN_INSET * 2; // 812px
const SCREEN_H = PHONE_H - SCREEN_INSET * 2; // 1792px

// ─── Coordinate mapping: video CSS px → composition canvas px ──────────────

const VIDEO_CSS_W = 390;
const VIDEO_CSS_H = 844;
const SCALE_X = SCREEN_W / VIDEO_CSS_W;  // ~2.082
const SCALE_Y = SCREEN_H / VIDEO_CSS_H;  // ~2.123

/**
 * Map a click coordinate from the Playwright capture coordinate system
 * (DPR-scaled native pixels, e.g. click_x up to 1080px) to canvas position
 * overlaid on the phone screen.
 *
 * Playwright stores coords as CSS-px × DPR (≈ 2.769), so we divide by DPR first.
 */
function mapScreenCoord(
  nativePx: number,
  nativePy: number,
  scrollBefore: number
): { cx: number; cy: number } {
  const DPR = 2.769;
  const cssPx = nativePx / DPR;
  const cssPy = nativePy / DPR - scrollBefore / DPR;

  return {
    cx: PHONE_LEFT + SCREEN_INSET + cssPx * SCALE_X,
    cy: PHONE_TOP + SCREEN_INSET + cssPy * SCALE_Y,
  };
}

/** ms offset in video → Remotion startFrom frame (60fps composition) */
function msToStartFrom(ms: number): number {
  return Math.max(0, Math.round(ms / 1000 * 60));
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function computeStartFrames(scenes: SceneConfig[]): number[] {
  let acc = 0;
  return scenes.map((s) => { const start = acc; acc += s.duration; return start; });
}

// ─── Intro overlay ────────────────────────────────────────────────────────────

const IntroOverlay: React.FC<{
  scene: IntroScene;
  localFrame: number;
  accentColor: string;
  styleH: StyleConfig["H"];
}> = ({ scene, localFrame, accentColor, styleH }) => {
  // H4: Typewriter scramble
  if (styleH === "H4") {
    const CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz@#$%!?0123456789";
    const RESOLVE_START = 12;
    const STAGGER = 6;
    const CHAR_DUR = 8;
    const displayChars = scene.title.split("").map((ch, ci) => {
      if (ch === " ") return " ";
      const resolveAt = RESOLVE_START + ci * STAGGER;
      if (localFrame >= resolveAt + CHAR_DUR) return ch;
      const idx = Math.abs((ci * 7 + localFrame * 11) % CHARS.length);
      if (localFrame >= resolveAt) return ((localFrame - resolveAt) / CHAR_DUR) > 0.65 ? ch : CHARS[idx];
      return CHARS[Math.abs((ci * 7 + localFrame * 3) % CHARS.length)];
    });
    const titleOpacity = interpolate(localFrame, [4, 28], [0, 1], { extrapolateRight: "clamp" });
    const subtitleOpacity = interpolate(localFrame, [scene.title.length * STAGGER + RESOLVE_START, scene.title.length * STAGGER + RESOLVE_START + 32], [0, 1], { extrapolateRight: "clamp" });
    return (
      <AbsoluteFill style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", paddingBottom: 180 }}>
        <div style={{ fontSize: 80, fontWeight: 900, fontFamily: "'Courier New', 'SF Mono', monospace", textAlign: "center", opacity: titleOpacity, color: "#ffffff", lineHeight: 1.1, padding: "0 60px", letterSpacing: 3 }}>
          {displayChars.join("")}
        </div>
        <div style={{ width: 60, height: 3, background: accentColor, borderRadius: 2, marginTop: 36, boxShadow: `0 0 14px ${accentColor}`, opacity: subtitleOpacity }} />
        <div style={{ color: "#94a3b8", fontSize: 32, fontFamily: "'Courier New', monospace", textAlign: "center", marginTop: 24, opacity: subtitleOpacity, padding: "0 80px", lineHeight: 1.45 }}>
          {scene.subtitle}
        </div>
      </AbsoluteFill>
    );
  }

  // H5: REC blink then title
  if (styleH === "H5") {
    const REC_DUR = 40;
    const recCrossfade = interpolate(localFrame, [REC_DUR - 16, REC_DUR + 8], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
    const recOn = Math.floor(localFrame / 16) % 2 === 0;
    const titleFrame = Math.max(0, localFrame - REC_DUR);
    const titleSpring = spring({ frame: titleFrame, fps: 60, config: { damping: 22, stiffness: 120 }, durationInFrames: 70 });
    const titleY = interpolate(titleSpring, [0, 1], [80, 0]);
    const titleOpacity = interpolate(titleFrame, [0, 40], [0, 1], { extrapolateRight: "clamp" });
    const subtitleOpacity = interpolate(titleFrame, [36, 84], [0, 1], { extrapolateRight: "clamp" });
    return (
      <AbsoluteFill style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", paddingBottom: 180 }}>
        {localFrame < REC_DUR + 8 && (
          <div style={{ position: "absolute", top: 60, left: 60, display: "flex", alignItems: "center", gap: 14, opacity: recCrossfade }}>
            <div style={{ width: 20, height: 20, borderRadius: "50%", background: "#ef4444", boxShadow: recOn ? "0 0 16px #ef4444" : "none", opacity: recOn ? 1 : 0.25 }} />
            <span style={{ fontFamily: "monospace", fontSize: 28, fontWeight: 700, color: recOn ? "#ef4444" : "#ef444455", letterSpacing: 4 }}>REC</span>
          </div>
        )}
        <div style={{ fontSize: 84, fontWeight: 900, fontFamily: "system-ui, -apple-system, sans-serif", textAlign: "center", transform: `translateY(${titleY}px)`, opacity: titleOpacity, background: `linear-gradient(135deg, #ffffff 20%, ${accentColor} 75%)`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", lineHeight: 1.1, padding: "0 60px", letterSpacing: -1 }}>
          {scene.title}
        </div>
        <div style={{ width: interpolate(titleFrame, [44, 96], [0, 480], { easing: Easing.out(Easing.cubic), extrapolateRight: "clamp" }), height: 3, background: `linear-gradient(to right, transparent, ${accentColor}, transparent)`, marginTop: 32, borderRadius: 2 }} />
        <div style={{ color: "#94a3b8", fontSize: 34, fontFamily: "system-ui", textAlign: "center", marginTop: 28, opacity: subtitleOpacity, padding: "0 80px", lineHeight: 1.45 }}>
          {scene.subtitle}
        </div>
      </AbsoluteFill>
    );
  }

  // H1: Text Spring (default)
  const titleSpring = spring({ frame: localFrame, fps: 60, config: { damping: 22, stiffness: 120 }, durationInFrames: 70 });
  const titleY = interpolate(titleSpring, [0, 1], [80, 0]);
  const titleOpacity = interpolate(localFrame, [0, 40], [0, 1], { extrapolateRight: "clamp" });
  const subtitleOpacity = interpolate(localFrame, [36, 84], [0, 1], { extrapolateRight: "clamp" });
  const lineWidth = interpolate(localFrame, [44, 96], [0, 480], { easing: Easing.out(Easing.cubic), extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", paddingBottom: 180 }}>
      <div style={{ fontSize: 88, fontWeight: 900, fontFamily: "system-ui, -apple-system, sans-serif", textAlign: "center", transform: `translateY(${titleY}px)`, opacity: titleOpacity, background: `linear-gradient(135deg, #ffffff 20%, ${accentColor} 75%)`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", lineHeight: 1.1, padding: "0 60px", letterSpacing: -1 }}>
        {scene.title}
      </div>
      <div style={{ width: lineWidth, height: 3, background: `linear-gradient(to right, transparent, ${accentColor}, transparent)`, marginTop: 36, borderRadius: 2 }} />
      <div style={{ color: "#94a3b8", fontSize: 34, fontFamily: "system-ui, -apple-system, sans-serif", textAlign: "center", marginTop: 28, opacity: subtitleOpacity, padding: "0 80px", lineHeight: 1.45 }}>
        {scene.subtitle}
      </div>
      <div style={{ width: 10, height: 10, borderRadius: "50%", background: accentColor, marginTop: 48, opacity: subtitleOpacity, boxShadow: `0 0 20px ${accentColor}` }} />
    </AbsoluteFill>
  );
};

// ─── Interaction overlays ─────────────────────────────────────────────────────

const InteractionOverlay: React.FC<{
  scene: InteractionScene;
  localFrame: number;
  accentColor: string;
  style: StyleConfig;
}> = ({ scene, localFrame, accentColor, style }) => {
  const { click_x, click_y, click_ms, video_start_ms, callout_text, step_number, duration, scroll_before = 0 } = scene;

  // Click fires at localFrame corresponding to (click_ms - video_start_ms)
  const CLICK_AT = Math.round((click_ms - video_start_ms) / 1000 * 60);
  const hasCursor = click_x !== null && click_y !== null;

  const { cx: canvasClickX, cy: canvasClickY } = hasCursor
    ? mapScreenCoord(click_x!, click_y!, scroll_before)
    : { cx: W / 2, cy: H * 0.5 };

  const cursorKeyframes: CursorKeyframe[] = hasCursor
    ? [
        { frame: 0, x: PHONE_LEFT + PHONE_W + 80, y: PHONE_TOP + 100 },
        { frame: Math.max(0, CLICK_AT - 10), x: canvasClickX, y: canvasClickY },
        { frame: CLICK_AT + 10, x: canvasClickX, y: canvasClickY },
        { frame: duration - 8, x: PHONE_LEFT + PHONE_W + 120, y: H + 60 },
      ]
    : [];

  const calloutStart = 10;
  const showCallout = localFrame >= calloutStart;

  return (
    <>
      {/* Attention guide (sonar ping before click) */}
      {hasCursor && (
        <AttentionGuide
          frame={localFrame}
          clickAt={CLICK_AT}
          targetX={canvasClickX}
          targetY={canvasClickY}
          accentColor={accentColor}
        />
      )}

      {/* Click burst at click moment */}
      {hasCursor && (
        <ClickBurst
          frame={localFrame - CLICK_AT}
          x={canvasClickX}
          y={canvasClickY}
          color={accentColor}
        />
      )}

      {/* Cursor (finger-tap orb) */}
      {hasCursor && (
        <CursorLayer
          frame={localFrame}
          fps={60}
          keyframes={cursorKeyframes}
          clickFrames={[CLICK_AT]}
          accentColor={accentColor}
        />
      )}

      {/* Step callout */}
      {showCallout && (
        <CalloutLayer
          frame={localFrame - calloutStart}
          fps={60}
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

// ─── Result overlay ───────────────────────────────────────────────────────────

const ResultOverlay: React.FC<{
  scene: ResultScene;
  localFrame: number;
  accentColor: string;
  stepNum: number;
  style: StyleConfig;
}> = ({ scene, localFrame, accentColor, stepNum, style }) => {
  const { callout_text, duration } = scene;
  const calloutStart = 40;
  const glowAlpha = Math.round((0.06 + Math.sin(localFrame * 0.07) * 0.04) * 255).toString(16).padStart(2, "0");

  return (
    <>
      {/* Ambient glow centered on phone */}
      <div style={{
        position: "absolute",
        top: H * 0.25,
        left: 0,
        width: W,
        height: H * 0.5,
        background: `radial-gradient(ellipse at 50% 35%, ${accentColor}${glowAlpha} 0%, transparent 60%)`,
        pointerEvents: "none",
        mixBlendMode: "screen",
      }} />

      {localFrame >= calloutStart && (
        <CalloutLayer
          frame={localFrame - calloutStart}
          fps={60}
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

// ─── Outro overlay ────────────────────────────────────────────────────────────

const CONFETTI_DATA = Array.from({ length: 32 }, (_, i) => ({
  angle: (i / 32) * Math.PI * 2,
  speed: 6 + (i % 5) * 2.4,
  colorIdx: i % 3,
  w: 10 + (i % 4) * 5,
  h: 6 + (i % 3) * 4,
  spinRate: ((i % 5) - 2) * 4.5,
  gravity: 0.08 + (i % 4) * 0.03,
}));

const OutroOverlay: React.FC<{
  scene: OutroScene;
  localFrame: number;
  accentColor: string;
  styleI: StyleConfig["I"];
}> = ({ scene, localFrame, accentColor, styleI }) => {
  const { duration, cta } = scene;

  if (styleI === "I5") {
    const colors = [accentColor, "#f59e0b", "#10b981"];
    const BURST_AT = 16;
    const f = Math.max(0, localFrame - BURST_AT);
    const ctaOpacity = interpolate(localFrame, [44, 72], [0, 1], { extrapolateRight: "clamp" });
    const ctaScale = interpolate(spring({ frame: Math.max(0, localFrame - 44), fps: 60, config: { damping: 18, stiffness: 110 }, durationInFrames: 56 }), [0, 1], [0.85, 1]);
    const fadeOut = interpolate(localFrame, [duration - 24, duration], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
    return (
      <AbsoluteFill style={{ display: "flex", alignItems: "center", justifyContent: "center", opacity: fadeOut }}>
        <div style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", pointerEvents: "none" }}>
          {CONFETTI_DATA.map((p, i) => {
            const vx = Math.cos(p.angle) * p.speed;
            const vy = Math.sin(p.angle) * p.speed;
            const x = W / 2 + vx * f;
            const y = H / 2 + (vy * f + p.gravity * f * f);
            const rot = p.spinRate * f;
            const op = interpolate(f, [0, 36, 110], [0, 0.92, 0], { extrapolateRight: "clamp" });
            return <div key={i} style={{ position: "absolute", left: x - p.w / 2, top: y - p.h / 2, width: p.w, height: p.h, background: colors[p.colorIdx], borderRadius: 3, transform: `rotate(${rot}deg)`, opacity: op }} />;
          })}
        </div>
        <div style={{ textAlign: "center", opacity: ctaOpacity, transform: `scale(${ctaScale})` }}>
          <div style={{ fontSize: 72, fontWeight: 900, fontFamily: "system-ui", background: `linear-gradient(135deg, #ffffff 25%, ${accentColor})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", letterSpacing: -1 }}>{cta}</div>
          <div style={{ color: "#64748b", fontSize: 26, fontFamily: "system-ui", marginTop: 20, letterSpacing: 3, textTransform: "uppercase" }}>Start for free</div>
        </div>
      </AbsoluteFill>
    );
  }

  if (styleI === "I6") {
    const fadeIn = interpolate(localFrame, [0, 44], [0, 1], { extrapolateRight: "clamp" });
    const fadeOut = interpolate(localFrame, [duration - 28, duration], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
    const scale = interpolate(localFrame, [0, duration], [1.06, 1.0], { extrapolateRight: "clamp" });
    return (
      <AbsoluteFill style={{ display: "flex", alignItems: "center", justifyContent: "center", opacity: Math.min(fadeIn, fadeOut) }}>
        <div style={{ textAlign: "center", transform: `scale(${scale})` }}>
          <div style={{ fontSize: 80, fontWeight: 900, fontFamily: "system-ui", color: "#ffffff", letterSpacing: -2, marginBottom: 16 }}>{cta}</div>
          <div style={{ width: 60, height: 2, background: accentColor, borderRadius: 1, margin: "0 auto 20px", boxShadow: `0 0 12px ${accentColor}` }} />
          <div style={{ color: "#475569", fontSize: 24, letterSpacing: 4, textTransform: "uppercase", fontFamily: "system-ui" }}>Start for free</div>
        </div>
      </AbsoluteFill>
    );
  }

  // I1: Brand Card + Rings (default)
  const fadeIn = interpolate(localFrame, [0, 44], [0, 1], { extrapolateRight: "clamp" });
  const fadeOut = interpolate(localFrame, [duration - 24, duration], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const opacity = Math.min(fadeIn, fadeOut);
  const cardScale = interpolate(spring({ frame: localFrame, fps: 60, config: { damping: 18, stiffness: 100 }, durationInFrames: 60 }), [0, 1], [0.82, 1]);
  const ringScale = 1 + localFrame * 0.003;
  const ringOpacity = interpolate(localFrame, [0, 20, duration - 20, duration], [0, 0.25, 0.25, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", opacity }}>
      <div style={{ position: "absolute", width: 480, height: 480, borderRadius: "50%", border: `1.5px solid ${accentColor}`, opacity: ringOpacity, transform: `scale(${ringScale})` }} />
      <div style={{ position: "absolute", width: 560, height: 560, borderRadius: "50%", border: `1px solid ${accentColor}`, opacity: ringOpacity * 0.5, transform: `scale(${ringScale * 1.08})` }} />
      <div style={{ background: "rgba(10,10,26,0.92)", backdropFilter: "blur(32px)", border: `1px solid ${accentColor}44`, borderRadius: 36, padding: "64px 90px", textAlign: "center", boxShadow: `0 0 80px ${accentColor}18, 0 24px 72px rgba(0,0,0,0.55)`, transform: `scale(${cardScale})` }}>
        <div style={{ fontSize: 72, fontWeight: 900, fontFamily: "system-ui", background: `linear-gradient(135deg, #ffffff 25%, ${accentColor})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", lineHeight: 1.1, letterSpacing: -1 }}>{cta}</div>
        <div style={{ color: "#64748b", fontSize: 26, fontFamily: "system-ui", marginTop: 20, letterSpacing: 3, textTransform: "uppercase", fontWeight: 500 }}>Start for free</div>
        <div style={{ width: 60, height: 3, background: accentColor, borderRadius: 2, margin: "24px auto 0", boxShadow: `0 0 12px ${accentColor}` }} />
      </div>
    </AbsoluteFill>
  );
};

// ─── Main Composition ─────────────────────────────────────────────────────────

const DEFAULT_SCRIPT: MockupScript = {
  product_name: "Your Product",
  tagline: "See what it can do",
  accent_color: "#6366f1",
  screen_video_url: "",
  style_seed: "preview",
  scenes: [
    { type: "intro", duration: 120, title: "Your Product", subtitle: "See what it can do", video_start_ms: 0 },
    { type: "outro", duration: 100, cta: "Try Your Product" },
  ],
};

export const MockupPromo: React.FC<MockupPromoProps> = ({ script = DEFAULT_SCRIPT }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { scenes, accent_color, screen_video_url, background_video_url, style_seed } = script;
  const startFrames = computeStartFrames(scenes);

  const style: StyleConfig = style_seed ? buildStyleConfig(style_seed) : DEFAULT_STYLE;

  // Find current scene
  let currentIdx = 0;
  for (let i = 0; i < startFrames.length; i++) {
    if (frame >= startFrames[i]) currentIdx = i;
  }
  const currentScene = scenes[currentIdx];
  const localFrame = frame - startFrames[currentIdx];

  // Determine video startFrom for the phone screen.
  // Remotion <Video startFrom={S}> shows source frame (compositionFrame + S) at each step.
  // We want: at global frame F = sceneStart + localFrame, show source frame videoSourceFrame + localFrame.
  // Solving: F + startFrom = videoSourceFrame + localFrame → startFrom = videoSourceFrame - sceneStart.
  let videoStartFrom = 0;
  if ("video_start_ms" in currentScene) {
    const videoSourceFrame = msToStartFrom(
      (currentScene as IntroScene | InteractionScene | ResultScene).video_start_ms
    );
    videoStartFrom = Math.max(0, videoSourceFrame - startFrames[currentIdx]);
  }

  const interactionSceneCount = scenes.filter((s) => s.type === "interaction").length;

  // Scene crossfade: fade to dark at end of each scene, fade from dark at start (skip first)
  const XFADE = 10;
  let xfadeOpacity = 0;
  if (localFrame < XFADE && currentIdx > 0) {
    xfadeOpacity = 1 - localFrame / XFADE;
  }
  if (localFrame > currentScene.duration - XFADE) {
    xfadeOpacity = Math.max(xfadeOpacity, (localFrame - (currentScene.duration - XFADE)) / XFADE);
  }
  xfadeOpacity = Math.min(1, Math.max(0, xfadeOpacity));

  return (
    <AbsoluteFill style={{ background: "#020510" }}>
      {/* Background */}
      <BackgroundCinema
        frame={frame}
        accentColor={accent_color}
        backgroundVideoUrl={background_video_url}
      />

      {/* Phone + Camera */}
      <CameraRig
        frame={frame}
        localFrame={localFrame}
        fps={fps}
        sceneType={currentScene.type as "intro" | "interaction" | "result" | "outro"}
        sceneIndex={currentIdx}
        cameraPreset={style.P}
      >
        <PhoneMockup
          screenVideoUrl={screen_video_url}
          startFrom={videoStartFrom}
          accentColor={accent_color}
        />
      </CameraRig>

      {/* Scene-specific overlays (text, callouts, cursor) */}
      {currentScene.type === "intro" && (
        <IntroOverlay
          scene={currentScene as IntroScene}
          localFrame={localFrame}
          accentColor={accent_color}
          styleH={style.H}
        />
      )}

      {currentScene.type === "interaction" && (
        <InteractionOverlay
          scene={currentScene as InteractionScene}
          localFrame={localFrame}
          accentColor={accent_color}
          style={style}
        />
      )}

      {currentScene.type === "result" && (
        <ResultOverlay
          scene={currentScene as ResultScene}
          localFrame={localFrame}
          accentColor={accent_color}
          stepNum={interactionSceneCount + 1}
          style={style}
        />
      )}

      {currentScene.type === "outro" && (
        <OutroOverlay
          scene={currentScene as OutroScene}
          localFrame={localFrame}
          accentColor={accent_color}
          styleI={style.I}
        />
      )}

      {/* Scene crossfade overlay */}
      {xfadeOpacity > 0 && (
        <AbsoluteFill
          style={{
            background: `rgba(2,5,16,${xfadeOpacity.toFixed(3)})`,
            pointerEvents: "none",
          }}
        />
      )}
    </AbsoluteFill>
  );
};
