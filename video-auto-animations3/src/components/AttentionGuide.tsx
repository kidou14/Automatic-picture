/**
 * AttentionGuide.tsx — V3 version
 * Always uses Sonar Ping (D3) — most readable for phone demo context.
 */
import React from "react";

interface Props {
  frame: number;
  clickAt: number;
  targetX: number;
  targetY: number;
  accentColor: string;
}

export const AttentionGuide: React.FC<Props> = ({ frame, clickAt, targetX, targetY, accentColor }) => {
  if (frame >= clickAt - 1) return null;

  const PERIOD = 52;
  const RINGS = 3;
  const MAX_R = 76;

  return (
    <svg
      width="100%"
      height="100%"
      style={{ position: "absolute", top: 0, left: 0, pointerEvents: "none", zIndex: 50 }}
    >
      {Array.from({ length: RINGS }, (_, ri) => {
        const offset = ri * Math.floor(PERIOD / RINGS);
        const t = ((frame - offset) % PERIOD + PERIOD) % PERIOD;
        const progress = t / PERIOD;
        const r = progress * MAX_R;
        const opacity = (1 - progress) * 0.65;
        return (
          <circle
            key={ri}
            cx={targetX}
            cy={targetY}
            r={r}
            fill="none"
            stroke={accentColor}
            strokeWidth="2"
            opacity={opacity}
          />
        );
      })}
      <circle cx={targetX} cy={targetY} r={5} fill={accentColor} opacity={0.85} />
    </svg>
  );
};
