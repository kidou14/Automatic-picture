/**
 * CursorLayer.tsx
 * Dimension G: cursor style variants.
 *   G1 — OS Cursor     (original: white arrow + ripple rings)
 *   G3 — Glowing Orb   (semi-transparent glowing circle)
 *   G6 — Dot + Trail   (5-dot following trail)
 */
import React from "react";
import { interpolate, Easing } from "remotion";
import { StyleG } from "../styles/StyleConfig";
import { CursorKeyframe } from "./AnimatedCursor";

export type { CursorKeyframe };

// ─── Shared helpers ───────────────────────────────────────────────────────────

/** Evaluate cursor (x, y) at any frame using keyframe interpolation */
export function evalCursorPos(
  keyframes: CursorKeyframe[],
  frame: number
): { x: number; y: number } {
  if (keyframes.length === 0) return { x: 0, y: 0 };
  const clamped = Math.max(
    keyframes[0].frame,
    Math.min(keyframes[keyframes.length - 1].frame, frame)
  );
  let from = keyframes[0];
  let to = keyframes[keyframes.length - 1];
  for (let i = 0; i < keyframes.length - 1; i++) {
    if (clamped >= keyframes[i].frame && clamped <= keyframes[i + 1].frame) {
      from = keyframes[i];
      to = keyframes[i + 1];
      break;
    }
  }
  return {
    x: interpolate(clamped, [from.frame, to.frame], [from.x, to.x], {
      easing: Easing.inOut(Easing.cubic),
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }),
    y: interpolate(clamped, [from.frame, to.frame], [from.y, to.y], {
      easing: Easing.inOut(Easing.cubic),
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }),
  };
}

function clickBounceScale(frame: number, clickFrames: number[]): number {
  for (const cf of clickFrames) {
    const rel = frame - cf;
    if (rel >= 0 && rel < 18) {
      return interpolate(rel, [0, 6, 12, 18], [1, 0.65, 1.08, 1], {
        extrapolateRight: "clamp",
      });
    }
  }
  return 1;
}

function buildRipples(
  frame: number,
  clickFrames: number[]
): Array<{ key: string; progress: number }> {
  return clickFrames
    .filter((cf) => frame - cf >= 0 && frame - cf < 32)
    .map((cf) => ({ key: String(cf), progress: (frame - cf) / 32 }));
}

// ─── G1: OS Cursor ────────────────────────────────────────────────────────────
const OSCursor: React.FC<{
  cx: number; cy: number; scale: number; accentColor: string;
  ripples: Array<{ key: string; progress: number }>;
}> = ({ cx, cy, scale, accentColor, ripples }) => (
  <div style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 100 }}>
    {ripples.map(({ key, progress }) => (
      <div
        key={key}
        style={{
          position: "absolute",
          left: cx - 4 - progress * 40,
          top: cy - 4 - progress * 40,
          width: 8 + progress * 80,
          height: 8 + progress * 80,
          borderRadius: "50%",
          border: `2px solid ${accentColor}${Math.round((0.9 - progress * 0.9) * 255).toString(16).padStart(2, "0")}`,
          boxShadow: `0 0 ${12 * (1 - progress)}px ${accentColor}${Math.round((0.5 - progress * 0.5) * 255).toString(16).padStart(2, "0")}`,
        }}
      />
    ))}
    <div
      style={{
        position: "absolute",
        left: cx,
        top: cy,
        transform: `scale(${scale})`,
        transformOrigin: "top left",
      }}
    >
      <svg width="36" height="44" viewBox="0 0 36 44" fill="none">
        <defs>
          <filter id="cur-shadow">
            <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#000" floodOpacity="0.5" />
          </filter>
        </defs>
        <path
          d="M6 4 L6 34 L13 26 L18 38 L21 37 L16 25 L26 25 Z"
          fill="white"
          stroke="#1e1b4b"
          strokeWidth="2"
          strokeLinejoin="round"
          filter="url(#cur-shadow)"
        />
      </svg>
    </div>
  </div>
);

// ─── G3: Glowing Orb ─────────────────────────────────────────────────────────
const GlowingOrb: React.FC<{
  cx: number; cy: number; scale: number; accentColor: string;
  ripples: Array<{ key: string; progress: number }>;
}> = ({ cx, cy, scale, accentColor, ripples }) => {
  const r = 22 * scale;
  return (
    <div style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 100 }}>
      {ripples.map(({ key, progress }) => {
        const alpha = Math.round((0.7 - progress * 0.7) * 255).toString(16).padStart(2, "0");
        return (
          <div
            key={key}
            style={{
              position: "absolute",
              left: cx - 8 - progress * 55,
              top: cy - 8 - progress * 55,
              width: 16 + progress * 110,
              height: 16 + progress * 110,
              borderRadius: "50%",
              border: `1.5px solid ${accentColor}${alpha}`,
            }}
          />
        );
      })}
      <div
        style={{
          position: "absolute",
          left: cx - r,
          top: cy - r,
          width: r * 2,
          height: r * 2,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${accentColor}bb 0%, ${accentColor}44 55%, transparent 100%)`,
          boxShadow: `0 0 ${32 * scale}px ${accentColor}66, 0 0 ${16 * scale}px ${accentColor}44`,
        }}
      />
    </div>
  );
};

// ─── G6: Dot + Trail ─────────────────────────────────────────────────────────
const DotTrail: React.FC<{
  frame: number;
  keyframes: CursorKeyframe[];
  scale: number;
  accentColor: string;
}> = ({ frame, keyframes, scale, accentColor }) => {
  const OFFSETS = [0, 4, 8, 12, 16];
  return (
    <div style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 100 }}>
      {OFFSETS.map((offset, ti) => {
        const { x, y } = evalCursorPos(keyframes, Math.max(0, frame - offset));
        const dotSize = (10 - ti * 1.5) * (ti === 0 ? scale : 1);
        const opacity = 1 - ti * 0.18;
        return (
          <div
            key={ti}
            style={{
              position: "absolute",
              left: x - dotSize / 2,
              top: y - dotSize / 2,
              width: dotSize,
              height: dotSize,
              borderRadius: "50%",
              background: accentColor,
              opacity,
              boxShadow: ti === 0 ? `0 0 ${dotSize * 2.5}px ${accentColor}` : "none",
            }}
          />
        );
      })}
    </div>
  );
};

// ─── CursorLayer ─────────────────────────────────────────────────────────────

interface Props {
  frame: number;
  fps: number;
  keyframes: CursorKeyframe[];
  clickFrames?: number[];
  style: StyleG;
  accentColor: string;
}

export const CursorLayer: React.FC<Props> = ({
  frame,
  keyframes,
  clickFrames = [],
  style,
  accentColor,
}) => {
  if (keyframes.length === 0) return null;

  const { x: cx, y: cy } = evalCursorPos(keyframes, frame);
  const scale = clickBounceScale(frame, clickFrames);
  const ripples = buildRipples(frame, clickFrames);

  if (style === "G1") {
    return <OSCursor cx={cx} cy={cy} scale={scale} accentColor={accentColor} ripples={ripples} />;
  }
  if (style === "G3") {
    return <GlowingOrb cx={cx} cy={cy} scale={scale} accentColor={accentColor} ripples={ripples} />;
  }
  if (style === "G6") {
    return <DotTrail frame={frame} keyframes={keyframes} scale={scale} accentColor={accentColor} />;
  }
  return null;
};
