/**
 * AttentionGuide.tsx
 * Dimension D: pre-click attention guidance variants.
 *   D1 — None       (original: no guide)
 *   D3 — Sonar Ping (expanding rings from target point)
 *   D9 — Halo Pulse (glow orb at target, radius oscillates)
 */
import React from "react";
import { StyleD } from "../styles/StyleConfig";

interface Props {
  frame: number;
  clickAt: number;    // global frame when click fires
  targetX: number;   // canvas px
  targetY: number;   // canvas px
  accentColor: string;
  style: StyleD;
}

// ─── D3: Sonar Ping ───────────────────────────────────────────────────────────
const SonarPing: React.FC<Props> = ({ frame, clickAt, targetX, targetY, accentColor }) => {
  // Hide once click fires
  if (frame >= clickAt - 1) return null;

  const PERIOD = 26; // frames per ring cycle
  const RINGS = 3;
  const MAX_R = 76;

  return (
    <svg
      width="100%"
      height="100%"
      style={{ position: "absolute", top: 0, left: 0, pointerEvents: "none", zIndex: 50 }}
    >
      {/* Rings */}
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
      {/* Static centre dot */}
      <circle cx={targetX} cy={targetY} r={5} fill={accentColor} opacity={0.85} />
    </svg>
  );
};

// ─── D9: Halo Pulse ───────────────────────────────────────────────────────────
const HaloPulse: React.FC<Props> = ({ frame, clickAt, targetX, targetY, accentColor }) => {
  if (frame >= clickAt - 1) return null;

  const glowR = 22 + Math.sin(frame * 0.22) * 9;
  const glowOpacity = 0.5 + Math.sin(frame * 0.22) * 0.28;

  // Encode the gradient opacity into the id name to avoid radialGradient id collisions
  // across multiple SVGs on the same page (rare but possible)
  const gradId = `halo-g-${Math.round(glowOpacity * 100)}`;

  return (
    <svg
      width="100%"
      height="100%"
      style={{ position: "absolute", top: 0, left: 0, pointerEvents: "none", zIndex: 50 }}
    >
      <defs>
        <radialGradient id={gradId} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={accentColor} stopOpacity={glowOpacity} />
          <stop offset="100%" stopColor={accentColor} stopOpacity="0" />
        </radialGradient>
      </defs>
      {/* Glow halo */}
      <circle cx={targetX} cy={targetY} r={glowR * 2.2} fill={`url(#${gradId})`} />
      {/* Centre dot */}
      <circle
        cx={targetX}
        cy={targetY}
        r={6}
        fill={accentColor}
        opacity={0.9}
        style={{ filter: `drop-shadow(0 0 8px ${accentColor})` }}
      />
    </svg>
  );
};

// ─── AttentionGuide ───────────────────────────────────────────────────────────
export const AttentionGuide: React.FC<Props> = (props) => {
  if (props.style === "D1") return null;
  if (props.style === "D3") return <SonarPing {...props} />;
  if (props.style === "D9") return <HaloPulse {...props} />;
  return null;
};
