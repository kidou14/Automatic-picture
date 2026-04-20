/**
 * GenericPromo.tsx
 * Data-driven promotional video composition.
 * Accepts a PromoScript as props; style_seed drives random visual variety
 * across 13 independent dimensions (A–N) via StyleConfig.
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
import { ColorTintLayer } from "../components/ColorTintLayer";
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
  style_seed?: string;
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

// ─── SceneTransitionWrapper (Dimensions C + K) ───────────────────────────────

const SceneTransitionWrapper: React.FC<{
  styleC: StyleConfig["C"];
  styleK: StyleConfig["K"];
  localFrame: number;
  children: React.ReactNode;
}> = ({ styleC, styleK, localFrame, children }) => {
  // ── Dimension K: directional entrance ─────────────────────────────────────
  let kTransform = "";
  if (styleK !== "K1") {
    const slideP = spring({
      frame: localFrame,
      fps: 60,
      config: { damping: 28, stiffness: 110 },
      durationInFrames: 50,
    });
    if (styleK === "K2") kTransform = `translateX(${interpolate(slideP, [0, 1], [-1080, 0])}px)`;
    else if (styleK === "K3") kTransform = `translateX(${interpolate(slideP, [0, 1], [1080, 0])}px)`;
    else if (styleK === "K4") kTransform = `translateY(${interpolate(slideP, [0, 1], [600, 0])}px)`;
    else if (styleK === "K5") kTransform = `translateY(${interpolate(slideP, [0, 1], [-600, 0])}px)`;
    else if (styleK === "K6") kTransform = `scale(${interpolate(slideP, [0, 1], [1.18, 1.0])})`;
  }

  const withK = (node: React.ReactNode) =>
    kTransform ? (
      <div style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", transform: kTransform, overflow: "hidden" }}>
        {node}
      </div>
    ) : <>{node}</>;

  // ── Dimension C: transition style ─────────────────────────────────────────
  if (styleC === "C1") return withK(children);

  if (styleC === "C2") {
    const opacity = localFrame < 28 ? interpolate(localFrame, [0, 28], [0, 1], { extrapolateRight: "clamp" }) : 1;
    return withK(
      <div style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", opacity }}>
        {children}
      </div>
    );
  }

  if (styleC === "C3") {
    const p = spring({ frame: localFrame, fps: 60, config: { damping: 26, stiffness: 100 }, durationInFrames: 44 });
    const y = interpolate(p, [0, 1], [40, 0]);
    const opacity = interpolate(localFrame, [0, 22], [0, 1], { extrapolateRight: "clamp" });
    return withK(
      <div style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", transform: `translateY(${y}px)`, opacity }}>
        {children}
      </div>
    );
  }

  if (styleC === "C4") {
    const DUR = 28;
    const scale =
      localFrame < DUR
        ? interpolate(localFrame, [0, 12, 20, DUR], [0.88, 1.04, 0.98, 1.0], { extrapolateRight: "clamp" })
        : 1;
    return withK(
      <div style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", transform: `scale(${scale})`, transformOrigin: "50% 50%" }}>
        {children}
      </div>
    );
  }

  if (styleC === "C5") {
    const p = spring({ frame: localFrame, fps: 60, config: { damping: 24, stiffness: 90 }, durationInFrames: 32 });
    const scale = interpolate(p, [0, 1], [1.06, 1.0]);
    const opacity = interpolate(localFrame, [0, 24], [0, 1], { extrapolateRight: "clamp" });
    return withK(
      <div style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", transform: `scale(${scale})`, opacity }}>
        {children}
      </div>
    );
  }

  if (styleC === "C6") {
    const DUR = 36;
    const r = localFrame < DUR
      ? interpolate(localFrame, [0, DUR], [0, 1600], { easing: Easing.out(Easing.cubic), extrapolateRight: "clamp" })
      : 1600;
    return withK(
      <div style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", clipPath: `circle(${r}px at 50% 50%)` }}>
        {children}
      </div>
    );
  }

  if (styleC === "C8") {
    const DUR = 32;
    const pct = localFrame < DUR
      ? interpolate(localFrame, [0, DUR], [0, 100], { easing: Easing.out(Easing.cubic), extrapolateRight: "clamp" })
      : 100;
    return withK(
      <div style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", clipPath: `inset(0 ${100 - pct}% 0 0)` }}>
        {children}
      </div>
    );
  }

  if (styleC === "C9") {
    const DUR = 28;
    const blurVal = localFrame < DUR ? interpolate(localFrame, [0, DUR], [14, 0], { extrapolateRight: "clamp" }) : 0;
    const opacity = localFrame < DUR ? interpolate(localFrame, [0, DUR], [0, 1], { extrapolateRight: "clamp" }) : 1;
    return withK(
      <div style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", filter: `blur(${blurVal}px)`, opacity }}>
        {children}
      </div>
    );
  }

  return withK(children);
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
  styleB, styleJ, accentColor,
}) => {
  const enterP = entrance
    ? spring({ frame: localFrame, fps: 60, config: { damping: 28, stiffness: 120 }, durationInFrames: 70 })
    : 1;
  const rotX = interpolate(enterP, [0, 1], [20, 0]);
  const transY = interpolate(enterP, [0, 1], [100, 0]);
  const fadeIn = entrance
    ? interpolate(localFrame, [0, 24], [0, 1], { extrapolateRight: "clamp" })
    : 1;

  // ── Dimension J: Ken Burns paths ──────────────────────────────────────────
  let kbScale = 1, kbX = 0, kbY = 0, kbRotate = 0;
  if (styleJ === "J2") {
    // Scale + drift right
    kbScale = 1 + localFrame * 0.000175;
    kbX = localFrame * 0.02;
  } else if (styleJ === "J3") {
    // Scale + drift top-right corner (reveals bottom-left)
    kbScale = 1 + localFrame * 0.000175;
    kbX = -localFrame * 0.018;
    kbY = localFrame * 0.012;
  } else if (styleJ === "J5") {
    // Scale + drift bottom-left corner (reveals top-right)
    kbScale = 1 + localFrame * 0.00015;
    kbX = localFrame * 0.012;
    kbY = -localFrame * 0.018;
  } else if (styleJ === "J6") {
    // Pure vertical pan downward (no scale)
    kbY = localFrame * 0.022;
  } else if (styleJ === "J7") {
    // Gentle rotation + subtle zoom (most cinematic)
    kbScale = 1 + localFrame * 0.00012;
    kbRotate = localFrame * 0.0018;
  }

  const combinedOpacity = fadeIn * opacity;

  if (styleB === "B2") {
    // Shadow Float — heavy drop shadow, no border chrome
    return (
      <div style={{ position: "absolute", top: 0, left: 0, width: W, height: H, overflow: "hidden", opacity: combinedOpacity }}>
        <div style={{ position: "absolute", top: 0, left: 0, width: W, height: H, transformOrigin: "50% 30%", transform: `perspective(1400px) rotateX(${rotX}deg) translateY(${transY}px)` }}>
          <div style={{ position: "absolute", top: FRAME_TOP, left: 32, right: 32, bottom: 80, overflow: "hidden", boxShadow: "0 80px 160px rgba(0,0,0,0.85), 0 24px 60px rgba(0,0,0,0.60)" }}>
            <Img src={url} style={{ position: "absolute", top: -scrollOffset, left: 0, width: W - 64, height: ssHeight, transform: `scale(${kbScale}) translateX(${kbX}px) translateY(${kbY}px) rotate(${kbRotate}deg)`, transformOrigin: "top left" }} />
            <div style={{ position: "absolute", bottom: 0, left: 0, width: "100%", height: 200, background: "linear-gradient(to bottom, transparent, #050714)", pointerEvents: "none" }} />
          </div>
        </div>
      </div>
    );
  }

  if (styleB === "B3") {
    // Thin Stroke — 1px accent border, gradient masks
    return (
      <div style={{ position: "absolute", top: 0, left: 0, width: W, height: H, overflow: "hidden", opacity: combinedOpacity }}>
        <div style={{ position: "absolute", top: 0, left: 0, width: W, height: H, transformOrigin: "50% 30%", transform: `perspective(1400px) rotateX(${rotX}deg) translateY(${transY}px)` }}>
          <Img src={url} style={{ position: "absolute", top: FRAME_TOP - scrollOffset, left: 0, width: W, height: ssHeight, transform: `scale(${kbScale}) translateX(${kbX}px) translateY(${kbY}px) rotate(${kbRotate}deg)`, transformOrigin: "top left" }} />
          <div style={{ position: "absolute", top: 0, left: 0, width: W, height: FRAME_TOP + 40, background: "linear-gradient(to bottom, #050714 55%, transparent)", pointerEvents: "none" }} />
          <div style={{ position: "absolute", bottom: 0, left: 0, width: W, height: 320, background: "linear-gradient(to bottom, transparent, #050714)", pointerEvents: "none" }} />
          <div style={{ position: "absolute", top: FRAME_TOP, left: 0, right: 0, bottom: 64, border: `1px solid ${accentColor}50`, pointerEvents: "none" }} />
        </div>
      </div>
    );
  }

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
                transform: `scale(${kbScale}) translateX(${kbX}px) translateY(${kbY}px) rotate(${kbRotate}deg)`,
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

  if (styleB === "B5") {
    // Glow Frame — accent inner glow
    return (
      <div style={{ position: "absolute", top: 0, left: 0, width: W, height: H, overflow: "hidden", opacity: combinedOpacity }}>
        <div style={{ position: "absolute", top: 0, left: 0, width: W, height: H, transformOrigin: "50% 30%", transform: `perspective(1400px) rotateX(${rotX}deg) translateY(${transY}px)` }}>
          <Img src={url} style={{ position: "absolute", top: FRAME_TOP - scrollOffset, left: 0, width: W, height: ssHeight, transform: `scale(${kbScale}) translateX(${kbX}px) translateY(${kbY}px) rotate(${kbRotate}deg)`, transformOrigin: "top left" }} />
          <div style={{ position: "absolute", top: 0, left: 0, width: W, height: FRAME_TOP + 40, background: "linear-gradient(to bottom, #050714 55%, transparent)", pointerEvents: "none" }} />
          <div style={{ position: "absolute", bottom: 0, left: 0, width: W, height: 320, background: "linear-gradient(to bottom, transparent, #050714)", pointerEvents: "none" }} />
          <div style={{ position: "absolute", top: FRAME_TOP, left: 0, right: 0, bottom: 64, boxShadow: `inset 0 0 80px ${accentColor}1a, inset 0 0 30px ${accentColor}0d`, pointerEvents: "none" }} />
        </div>
      </div>
    );
  }

  if (styleB === "B6") {
    // Gradient Sides — left + right edges fade to dark
    return (
      <div style={{ position: "absolute", top: 0, left: 0, width: W, height: H, overflow: "hidden", opacity: combinedOpacity }}>
        <div style={{ position: "absolute", top: 0, left: 0, width: W, height: H, transformOrigin: "50% 30%", transform: `perspective(1400px) rotateX(${rotX}deg) translateY(${transY}px)` }}>
          <Img src={url} style={{ position: "absolute", top: FRAME_TOP - scrollOffset, left: 0, width: W, height: ssHeight, transform: `scale(${kbScale}) translateX(${kbX}px) translateY(${kbY}px) rotate(${kbRotate}deg)`, transformOrigin: "top left" }} />
          <div style={{ position: "absolute", top: 0, left: 0, width: W, height: FRAME_TOP + 40, background: "linear-gradient(to bottom, #050714 55%, transparent)", pointerEvents: "none" }} />
          <div style={{ position: "absolute", bottom: 0, left: 0, width: W, height: 320, background: "linear-gradient(to bottom, transparent, #050714)", pointerEvents: "none" }} />
          <div style={{ position: "absolute", top: 0, left: 0, width: 140, height: H, background: "linear-gradient(to right, #050714, transparent)", pointerEvents: "none" }} />
          <div style={{ position: "absolute", top: 0, right: 0, width: 140, height: H, background: "linear-gradient(to left, #050714, transparent)", pointerEvents: "none" }} />
        </div>
      </div>
    );
  }

  if (styleB === "B7") {
    // Corner Marks — L-bracket corner indicators
    const CT = FRAME_TOP;
    const CB = 64;
    const SZ = 30;
    const TK = 2;
    const corners: React.CSSProperties[] = [
      { top: CT, left: 0, width: SZ, height: TK },
      { top: CT, left: 0, width: TK, height: SZ },
      { top: CT, right: 0, width: SZ, height: TK },
      { top: CT, right: 0, width: TK, height: SZ },
      { bottom: CB, left: 0, width: SZ, height: TK },
      { bottom: CB, left: 0, width: TK, height: SZ },
      { bottom: CB, right: 0, width: SZ, height: TK },
      { bottom: CB, right: 0, width: TK, height: SZ },
    ];
    return (
      <div style={{ position: "absolute", top: 0, left: 0, width: W, height: H, overflow: "hidden", opacity: combinedOpacity }}>
        <div style={{ position: "absolute", top: 0, left: 0, width: W, height: H, transformOrigin: "50% 30%", transform: `perspective(1400px) rotateX(${rotX}deg) translateY(${transY}px)` }}>
          <Img src={url} style={{ position: "absolute", top: FRAME_TOP - scrollOffset, left: 0, width: W, height: ssHeight, transform: `scale(${kbScale}) translateX(${kbX}px) translateY(${kbY}px) rotate(${kbRotate}deg)`, transformOrigin: "top left" }} />
          <div style={{ position: "absolute", top: 0, left: 0, width: W, height: FRAME_TOP + 40, background: "linear-gradient(to bottom, #050714 55%, transparent)", pointerEvents: "none" }} />
          <div style={{ position: "absolute", bottom: 0, left: 0, width: W, height: 320, background: "linear-gradient(to bottom, transparent, #050714)", pointerEvents: "none" }} />
          {corners.map((c, i) => (
            <div key={i} style={{ position: "absolute", ...c, background: accentColor, opacity: 0.7, pointerEvents: "none" }} />
          ))}
        </div>
      </div>
    );
  }

  // B1: Raw Masked (default)
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
            transform: `scale(${kbScale}) translateX(${kbX}px) translateY(${kbY}px) rotate(${kbRotate}deg)`,
            transformOrigin: "top left",
          }}
        />
        <div style={{ position: "absolute", top: 0, left: 0, width: W, height: FRAME_TOP + 40, background: "linear-gradient(to bottom, #050714 55%, transparent)", pointerEvents: "none" }} />
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
  // H2: Split Reveal — two accent panels slide apart to reveal title
  if (styleH === "H2") {
    const SPLIT_DUR = 40;
    const splitP = spring({ frame: localFrame, fps: 60, config: { damping: 22, stiffness: 100 }, durationInFrames: SPLIT_DUR });
    const panelX = interpolate(splitP, [0, 1], [0, 620]);
    const titleOpacity = interpolate(localFrame, [SPLIT_DUR - 10, SPLIT_DUR + 20], [0, 1], { extrapolateRight: "clamp" });
    const subtitleOpacity = interpolate(localFrame, [SPLIT_DUR + 24, SPLIT_DUR + 64], [0, 1], { extrapolateRight: "clamp" });
    const titleScale = interpolate(
      spring({ frame: Math.max(0, localFrame - SPLIT_DUR + 10), fps: 60, config: { damping: 20, stiffness: 120 }, durationInFrames: 50 }),
      [0, 1], [0.88, 1]
    );
    return (
      <AbsoluteFill style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
        {/* Left panel */}
        <div style={{ position: "absolute", top: 0, left: 0, width: "50%", height: "100%", background: `linear-gradient(to right, ${accentColor}22, ${accentColor}08)`, transform: `translateX(-${panelX}px)` }} />
        {/* Right panel */}
        <div style={{ position: "absolute", top: 0, right: 0, width: "50%", height: "100%", background: `linear-gradient(to left, ${accentColor}22, ${accentColor}08)`, transform: `translateX(${panelX}px)` }} />
        {/* Title */}
        <div style={{ opacity: titleOpacity, transform: `scale(${titleScale})`, textAlign: "center", padding: "0 60px", position: "relative" }}>
          <div style={{ fontSize: 92, fontWeight: 900, fontFamily: "system-ui, -apple-system, sans-serif", background: `linear-gradient(135deg, #ffffff 20%, ${accentColor} 75%)`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", lineHeight: 1.1, letterSpacing: -1 }}>
            {scene.title}
          </div>
          <div style={{ width: interpolate(Math.max(0, localFrame - SPLIT_DUR), [0, 50], [0, 480], { easing: Easing.out(Easing.cubic), extrapolateRight: "clamp" }), height: 3, background: `linear-gradient(to right, transparent, ${accentColor}, transparent)`, marginTop: 36, borderRadius: 2 }} />
          <div style={{ color: "#94a3b8", fontSize: 36, fontFamily: "system-ui, -apple-system, sans-serif", fontWeight: 400, textAlign: "center", marginTop: 32, opacity: subtitleOpacity, padding: "0 80px", lineHeight: 1.45 }}>
            {scene.subtitle}
          </div>
        </div>
      </AbsoluteFill>
    );
  }

  // H3: Color Burst — radial accent explosion, then title resolves
  if (styleH === "H3") {
    const burstR = interpolate(localFrame, [0, 32], [0, 1400], {
      easing: Easing.out(Easing.cubic),
      extrapolateRight: "clamp",
    });
    const burstOpacity = interpolate(localFrame, [0, 18, 44], [0.75, 0.35, 0], { extrapolateRight: "clamp" });
    const titleOpacity = interpolate(localFrame, [26, 58], [0, 1], { extrapolateRight: "clamp" });
    const titleScale = interpolate(
      spring({ frame: Math.max(0, localFrame - 26), fps: 60, config: { damping: 22, stiffness: 110 }, durationInFrames: 50 }),
      [0, 1], [0.85, 1]
    );
    const subtitleOpacity = interpolate(localFrame, [62, 94], [0, 1], { extrapolateRight: "clamp" });
    return (
      <AbsoluteFill style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        {/* Burst */}
        <div style={{ position: "absolute", width: burstR * 2, height: burstR * 2, borderRadius: "50%", background: `radial-gradient(circle, ${accentColor} 0%, ${accentColor}44 40%, transparent 70%)`, opacity: burstOpacity, left: "50%", top: "50%", transform: "translate(-50%, -50%)", pointerEvents: "none" }} />
        {/* Title */}
        <div style={{ opacity: titleOpacity, transform: `scale(${titleScale})`, textAlign: "center", padding: "0 60px", position: "relative" }}>
          <div style={{ fontSize: 92, fontWeight: 900, fontFamily: "system-ui, -apple-system, sans-serif", background: `linear-gradient(135deg, #ffffff 20%, ${accentColor} 75%)`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", lineHeight: 1.1, letterSpacing: -1 }}>
            {scene.title}
          </div>
          <div style={{ width: interpolate(Math.max(0, localFrame - 26), [0, 50], [0, 480], { easing: Easing.out(Easing.cubic), extrapolateRight: "clamp" }), height: 3, background: `linear-gradient(to right, transparent, ${accentColor}, transparent)`, marginTop: 36, borderRadius: 2 }} />
          <div style={{ color: "#94a3b8", fontSize: 36, fontFamily: "system-ui, -apple-system, sans-serif", fontWeight: 400, textAlign: "center", marginTop: 32, opacity: subtitleOpacity, padding: "0 80px", lineHeight: 1.45 }}>
            {scene.subtitle}
          </div>
        </div>
      </AbsoluteFill>
    );
  }

  // H4: Typewriter Resolve
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
      if (localFrame >= resolveAt) {
        const prog = (localFrame - resolveAt) / CHAR_DUR;
        return prog > 0.65 ? ch : CHARS[idx];
      }
      return CHARS[Math.abs((ci * 7 + localFrame * 3) % CHARS.length)];
    });
    const titleOpacity = interpolate(localFrame, [4, 28], [0, 1], { extrapolateRight: "clamp" });
    const subtitleOpacity = interpolate(
      localFrame,
      [scene.title.length * STAGGER + RESOLVE_START, scene.title.length * STAGGER + RESOLVE_START + 32],
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

  // H5: Record Start
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
      <AbsoluteFill style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        {localFrame < REC_DUR + 8 && (
          <div style={{ position: "absolute", top: 60, left: 60, display: "flex", alignItems: "center", gap: 14, opacity: recCrossfade }}>
            <div style={{ width: 20, height: 20, borderRadius: "50%", background: "#ef4444", boxShadow: recOn ? "0 0 16px #ef4444" : "none", opacity: recOn ? 1 : 0.25 }} />
            <span style={{ fontFamily: "monospace", fontSize: 30, fontWeight: 700, color: recOn ? "#ef4444" : "#ef444455", letterSpacing: 4 }}>REC</span>
          </div>
        )}
        <div style={{ fontSize: 92, fontWeight: 900, fontFamily: "system-ui, -apple-system, sans-serif", textAlign: "center", transform: `translateY(${titleY}px)`, opacity: titleOpacity, background: `linear-gradient(135deg, #ffffff 20%, ${accentColor} 75%)`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", lineHeight: 1.1, padding: "0 60px", letterSpacing: -1 }}>
          {scene.title}
        </div>
        <div style={{ width: interpolate(titleFrame, [44, 96], [0, 480], { easing: Easing.out(Easing.cubic), extrapolateRight: "clamp" }), height: 3, background: `linear-gradient(to right, transparent, ${accentColor}, transparent)`, marginTop: 36, borderRadius: 2 }} />
        <div style={{ color: "#94a3b8", fontSize: 36, fontFamily: "system-ui, -apple-system, sans-serif", fontWeight: 400, textAlign: "center", marginTop: 32, opacity: subtitleOpacity, padding: "0 80px", lineHeight: 1.45, letterSpacing: 0.5 }}>
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

// ─── InteractionSceneView (Dimensions D, E, G, F, J, B, N) ───────────────────

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

  const CLICK_AT = 48;

  const canvasClickX = click_x ?? W / 2;
  const canvasClickY =
    click_x !== null && click_y !== null
      ? FRAME_TOP + click_y - scroll_before
      : H * 0.5;

  const hasCursor = click_x !== null;

  // ── Dimension J: screenshot scroll animation ───────────────────────────────
  const scrollAfter =
    style.J === "J4"
      ? scroll_before + spring({
          frame: Math.max(0, localFrame - CLICK_AT),
          fps: 60,
          config: { damping: 22, stiffness: 75, mass: 1.2 },
          durationInFrames: 55,
        }) * (scroll_after - scroll_before)
      : scroll_after;

  // ── Dimension E: before→after reveal ──────────────────────────────────────
  let beforeOpacity = 1;
  let afterOpacity = 0;
  let afterClipPath: string | undefined;

  if (style.E === "E1") {
    const crossfade = Math.min(1, spring({
      frame: Math.max(0, localFrame - CLICK_AT),
      fps: 60,
      config: { damping: 26, stiffness: 90 },
      durationInFrames: 40,
    }));
    beforeOpacity = 1 - crossfade;
    afterOpacity = crossfade;
  } else if (style.E === "E2") {
    const r = interpolate(localFrame, [CLICK_AT, CLICK_AT + 48], [0, 2400], {
      extrapolateLeft: "clamp", extrapolateRight: "clamp",
    });
    beforeOpacity = 1;
    afterOpacity = localFrame >= CLICK_AT ? 1 : 0;
    afterClipPath = localFrame >= CLICK_AT
      ? `circle(${r}px at ${canvasClickX}px ${canvasClickY}px)`
      : "circle(0px at 0px 0px)";
  } else if (style.E === "E6") {
    const GLITCH_END = CLICK_AT + 12;
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

  const isGlitching = style.E === "E6" && localFrame >= CLICK_AT && localFrame < CLICK_AT + 12;
  const glitchOffset = isGlitching
    ? [0, 14, 14, -11, -11, 16, 16, -9, -9, 6, 6, 0][Math.min(localFrame - CLICK_AT, 11)]
    : 0;

  // ── Cursor keyframes ───────────────────────────────────────────────────────
  const cursorKeyframes: CursorKeyframe[] = hasCursor
    ? [
        { frame: 0, x: 1150, y: 40 },
        { frame: CLICK_AT - 8, x: canvasClickX, y: canvasClickY },
        { frame: CLICK_AT + 8, x: canvasClickX, y: canvasClickY },
        { frame: duration - 8, x: 1200, y: H + 60 },
      ]
    : [];

  const calloutStart = 12;
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
        <ScreenView url={before_url} scrollOffset={scroll_before} opacity={beforeOpacity} {...screenProps} entrance={entrance} />
      </div>

      {/* After screenshot */}
      {afterOpacity > 0 && (
        <div style={{ position: "absolute", top: 0, left: 0, width: W, height: H, clipPath: afterClipPath }}>
          <ScreenView url={after_url} scrollOffset={scrollAfter} opacity={afterOpacity} {...screenProps} entrance={false} />
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
        <ClickBurst frame={localFrame - CLICK_AT} x={canvasClickX} y={canvasClickY} color={accentColor} />
      )}

      {/* Cursor — Dimension G */}
      {hasCursor && (
        <CursorLayer
          frame={localFrame}
          fps={60}
          keyframes={cursorKeyframes}
          clickFrames={[CLICK_AT]}
          style={style.G}
          accentColor={accentColor}
        />
      )}

      {/* Step callout — Dimensions F + N */}
      {showCallout && (
        <CalloutLayer
          frame={localFrame - calloutStart}
          fps={60}
          step={step_number}
          title={callout_text}
          totalDuration={duration - calloutStart - 6}
          accentColor={accentColor}
          style={style.F}
          styleN={style.N}
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

  const revealProgress = interpolate(localFrame, [0, 64], [0, 1], {
    easing: Easing.out(Easing.cubic),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const clipBottom = interpolate(revealProgress, [0, 1], [100, 0]);

  const glowAlpha = Math.round((0.08 + Math.sin(localFrame * 0.07) * 0.06) * 255)
    .toString(16)
    .padStart(2, "0");

  const calloutStart = 56;
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
          fps={60}
          step={stepNum}
          title={callout_text}
          totalDuration={duration - calloutStart - 6}
          accentColor={accentColor}
          style={style.F}
          styleN={style.N}
        />
      )}
    </>
  );
};

// ─── OutroSceneView (Dimension I) ────────────────────────────────────────────

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

  // I2: Glitch Out — title shows, then glitches and disappears
  if (styleI === "I2") {
    const fadeIn = interpolate(localFrame, [0, 44], [0, 1], { extrapolateRight: "clamp" });
    const GLITCH_START = duration - 28;
    const glitching = localFrame >= GLITCH_START;
    const GLITCH_SEQ = [0, 22, -15, 30, -20, 12, -10, 18, -8, 0];
    const glitchX = glitching ? (GLITCH_SEQ[Math.min(localFrame - GLITCH_START, GLITCH_SEQ.length - 1)] ?? 0) : 0;
    const glitchOpacity = glitching
      ? interpolate(localFrame, [GLITCH_START, duration], [1, 0], { extrapolateRight: "clamp" })
      : Math.min(fadeIn, 1);
    const glitchFilter = glitching ? `saturate(2.5) hue-rotate(${glitchX * 3}deg)` : "none";
    return (
      <AbsoluteFill style={{ display: "flex", alignItems: "center", justifyContent: "center", opacity: glitchOpacity, transform: `translateX(${glitchX}px)`, filter: glitchFilter }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 80, fontWeight: 900, fontFamily: "system-ui, -apple-system, sans-serif", background: `linear-gradient(135deg, #ffffff 25%, ${accentColor})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", letterSpacing: -1 }}>
            {cta}
          </div>
          <div style={{ color: "#64748b", fontSize: 26, fontFamily: "system-ui", marginTop: 20, letterSpacing: 3, textTransform: "uppercase" }}>
            Start for free
          </div>
        </div>
      </AbsoluteFill>
    );
  }

  // I3: Scale Burst — content scales up and fades out
  if (styleI === "I3") {
    const fadeIn = interpolate(localFrame, [0, 44], [0, 1], { extrapolateRight: "clamp" });
    const BURST_START = duration - 32;
    const burstP = localFrame >= BURST_START
      ? spring({ frame: localFrame - BURST_START, fps: 60, config: { damping: 50, stiffness: 180 }, durationInFrames: 32 })
      : 0;
    const scale = localFrame >= BURST_START ? interpolate(burstP, [0, 1], [1.0, 1.28]) : 1;
    const opacity = localFrame >= BURST_START
      ? interpolate(localFrame, [BURST_START, duration], [1, 0], { extrapolateRight: "clamp" })
      : Math.min(fadeIn, 1);
    return (
      <AbsoluteFill style={{ display: "flex", alignItems: "center", justifyContent: "center", opacity, transform: `scale(${scale})` }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 80, fontWeight: 900, fontFamily: "system-ui, -apple-system, sans-serif", background: `linear-gradient(135deg, #ffffff 25%, ${accentColor})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", letterSpacing: -1 }}>
            {cta}
          </div>
          <div style={{ color: "#64748b", fontSize: 26, fontFamily: "system-ui", marginTop: 20, letterSpacing: 3, textTransform: "uppercase" }}>
            Start for free
          </div>
        </div>
      </AbsoluteFill>
    );
  }

  // I5: Confetti Burst
  if (styleI === "I5") {
    const colors = [accentColor, "#f59e0b", "#10b981"];
    const BURST_AT = 16;
    const f = Math.max(0, localFrame - BURST_AT);
    const ctaOpacity = interpolate(localFrame, [44, 72], [0, 1], { extrapolateRight: "clamp" });
    const ctaScale = interpolate(
      spring({ frame: Math.max(0, localFrame - 44), fps: 60, config: { damping: 18, stiffness: 110 }, durationInFrames: 56 }),
      [0, 1], [0.85, 1]
    );
    const fadeOut = interpolate(localFrame, [duration - 24, duration], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
    return (
      <AbsoluteFill style={{ display: "flex", alignItems: "center", justifyContent: "center", opacity: fadeOut }}>
        <div style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", pointerEvents: "none" }}>
          {CONFETTI.map((p, i) => {
            const vx = Math.cos(p.angle) * p.speed;
            const vy = Math.sin(p.angle) * p.speed;
            const x = W / 2 + vx * f;
            const y = H / 2 + (vy * f + p.gravity * f * f);
            const rot = p.spinRate * f;
            const op = interpolate(f, [0, 36, 110], [0, 0.92, 0], { extrapolateRight: "clamp" });
            return (
              <div key={i} style={{ position: "absolute", left: x - p.w / 2, top: y - p.h / 2, width: p.w, height: p.h, background: colors[p.colorIdx], borderRadius: 3, transform: `rotate(${rot}deg)`, opacity: op }} />
            );
          })}
        </div>
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

  // I6: Cinematic Fade
  if (styleI === "I6") {
    const fadeIn = interpolate(localFrame, [0, 44], [0, 1], { extrapolateRight: "clamp" });
    const fadeOut = interpolate(localFrame, [duration - 28, duration], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
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

  // I1: Brand Card + Rings (default)
  const fadeIn = interpolate(localFrame, [0, 44], [0, 1], { extrapolateRight: "clamp" });
  const fadeOut = interpolate(localFrame, [duration - 24, duration], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const opacity = Math.min(fadeIn, fadeOut);
  const cardScale = interpolate(
    spring({ frame: localFrame, fps: 60, config: { damping: 18, stiffness: 100 }, durationInFrames: 60 }),
    [0, 1], [0.82, 1]
  );
  const ringScale = 1 + localFrame * 0.003;
  const ringOpacity = interpolate(localFrame, [0, 20, duration - 20, duration], [0, 0.25, 0.25, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

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

  const style: StyleConfig = style_seed
    ? buildStyleConfig(style_seed)
    : DEFAULT_STYLE;

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

      {/* Scene content — Dimensions C + K */}
      <SceneTransitionWrapper styleC={style.C} styleK={style.K} localFrame={localFrame}>
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

      {/* Dimension L: global color tint (topmost layer) */}
      <ColorTintLayer style={style.L} />
    </AbsoluteFill>
  );
};
