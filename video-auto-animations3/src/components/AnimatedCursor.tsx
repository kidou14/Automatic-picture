import React from "react";
import { interpolate, Easing } from "remotion";

export interface CursorKeyframe {
  frame: number;
  x: number;
  y: number;
}

interface Props {
  frame: number;
  fps: number;
  keyframes: CursorKeyframe[];
  clickFrames?: number[];
  visible?: boolean;
}

export const AnimatedCursor: React.FC<Props> = ({
  frame,
  keyframes,
  clickFrames = [],
  visible = true,
}) => {
  if (!visible || keyframes.length === 0) return null;

  const clampedFrame = Math.max(keyframes[0].frame, Math.min(keyframes[keyframes.length - 1].frame, frame));

  let fromKf = keyframes[0];
  let toKf = keyframes[keyframes.length - 1];
  for (let i = 0; i < keyframes.length - 1; i++) {
    if (clampedFrame >= keyframes[i].frame && clampedFrame <= keyframes[i + 1].frame) {
      fromKf = keyframes[i];
      toKf = keyframes[i + 1];
      break;
    }
  }

  const cx = interpolate(clampedFrame, [fromKf.frame, toKf.frame], [fromKf.x, toKf.x], {
    easing: Easing.inOut(Easing.cubic),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const cy = interpolate(clampedFrame, [fromKf.frame, toKf.frame], [fromKf.y, toKf.y], {
    easing: Easing.inOut(Easing.cubic),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  let cursorScale = 1;
  const ripples: Array<{ key: string; progress: number }> = [];

  for (const cf of clickFrames) {
    const rel = frame - cf;
    if (rel >= 0 && rel < 18) {
      cursorScale = interpolate(rel, [0, 6, 12, 18], [1, 0.65, 1.08, 1], { extrapolateRight: "clamp" });
    }
    if (rel >= 0 && rel < 32) {
      ripples.push({ key: String(cf), progress: rel / 32 });
    }
  }

  return (
    <div style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 100 }}>
      {ripples.map(({ key, progress }) => (
        <div
          key={key}
          style={{
            position: "absolute",
            left: cx - 4,
            top: cy - 4,
            width: 8 + progress * 80,
            height: 8 + progress * 80,
            marginLeft: -(progress * 40),
            marginTop: -(progress * 40),
            borderRadius: "50%",
            border: `2px solid rgba(99,102,241,${0.9 - progress})`,
            boxShadow: `0 0 ${12 * (1 - progress)}px rgba(99,102,241,${0.6 - progress * 0.6})`,
          }}
        />
      ))}
      <div
        style={{
          position: "absolute",
          left: cx,
          top: cy,
          transform: `scale(${cursorScale})`,
          transformOrigin: "top left",
        }}
      >
        <svg width="36" height="44" viewBox="0 0 36 44" fill="none">
          <filter id="cShadow">
            <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#000" floodOpacity="0.5" />
          </filter>
          <path
            d="M6 4 L6 34 L13 26 L18 38 L21 37 L16 25 L26 25 Z"
            fill="white"
            stroke="#1e1b4b"
            strokeWidth="2"
            strokeLinejoin="round"
            filter="url(#cShadow)"
          />
        </svg>
      </div>
    </div>
  );
};
