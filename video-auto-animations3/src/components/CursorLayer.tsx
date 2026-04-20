/**
 * CursorLayer.tsx — V3 version
 * Uses a glowing orb (finger-tap style) — more appropriate for a phone mockup.
 */
import React from "react";
import { interpolate, Easing } from "remotion";

export interface CursorKeyframe {
  frame: number;
  x: number;
  y: number;
}

function evalCursorPos(keyframes: CursorKeyframe[], frame: number): { x: number; y: number } {
  if (keyframes.length === 0) return { x: 0, y: 0 };
  const clamped = Math.max(keyframes[0].frame, Math.min(keyframes[keyframes.length - 1].frame, frame));
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
    x: interpolate(clamped, [from.frame, to.frame], [from.x, to.x], { easing: Easing.inOut(Easing.cubic), extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
    y: interpolate(clamped, [from.frame, to.frame], [from.y, to.y], { easing: Easing.inOut(Easing.cubic), extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
  };
}

interface Props {
  frame: number;
  fps: number;
  keyframes: CursorKeyframe[];
  clickFrames?: number[];
  accentColor: string;
}

export const CursorLayer: React.FC<Props> = ({ frame, keyframes, clickFrames = [], accentColor }) => {
  if (keyframes.length === 0) return null;

  const { x: cx, y: cy } = evalCursorPos(keyframes, frame);

  // Click bounce scale
  let scale = 1;
  const ripples: Array<{ key: string; progress: number }> = [];
  for (const cf of clickFrames) {
    const rel = frame - cf;
    if (rel >= 0 && rel < 36) {
      scale = interpolate(rel, [0, 12, 24, 36], [1, 0.65, 1.08, 1], { extrapolateRight: "clamp" });
    }
    if (rel >= 0 && rel < 64) {
      ripples.push({ key: String(cf), progress: rel / 64 });
    }
  }

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
