/**
 * BackgroundLayer.tsx
 * Dimension A: background atmosphere variants.
 *   A1 — Deep Space   (original: floating particles + HUD grid)
 *   A2 — Constellation (particles + auto-connecting lines)
 *   A6 — Bokeh Circles (soft blurry orbs, organic)
 *   A10 — Gradient Mesh (animated multi-point radial gradient)
 */
import React from "react";
import { StyleA } from "../styles/StyleConfig";
import { HUDGrid } from "./HUDGrid";

const W = 1080, H = 1920;
const COUNT = 38;

// ─── Shared particle data (golden-angle, deterministic) ───────────────────────
const PARTICLES = Array.from({ length: COUNT }, (_, i) => ({
  x: (i * 137.508) % W,
  baseY: (i * 113.7) % H,
  speed: 0.28 + (i % 7) * 0.06,
  size: 2 + (i % 4),
  phase: i * 0.83,
  opacity: 0.25 + (i % 5) * 0.09,
}));

// ─── A1: Deep Space ───────────────────────────────────────────────────────────
const DeepSpaceField: React.FC<{ frame: number; accentColor: string }> = ({ frame, accentColor }) => (
  <div style={{ position: "absolute", top: 0, left: 0, width: W, height: H, pointerEvents: "none" }}>
    {PARTICLES.map((p, i) => {
      const y = ((p.baseY - p.speed * frame) % H + H) % H;
      const pulse = 0.7 + Math.sin(frame * 0.04 + p.phase) * 0.3;
      const color = i % 3 === 0 ? accentColor : i % 3 === 1 ? "#6366f1" : "#38bdf8";
      return (
        <div
          key={i}
          style={{
            position: "absolute",
            left: p.x - p.size / 2,
            top: y - p.size / 2,
            width: p.size,
            height: p.size,
            borderRadius: "50%",
            background: color,
            opacity: p.opacity * pulse,
            boxShadow: `0 0 ${p.size * 2}px ${color}`,
          }}
        />
      );
    })}
  </div>
);

// ─── A2: Constellation ────────────────────────────────────────────────────────
const ConstellationField: React.FC<{ frame: number; accentColor: string }> = ({ frame, accentColor }) => {
  const positions = PARTICLES.map((p) => ({
    x: p.x,
    y: ((p.baseY - p.speed * frame) % H + H) % H,
    opacity: p.opacity * (0.7 + Math.sin(frame * 0.04 + p.phase) * 0.3),
    size: p.size,
  }));

  const lines: React.ReactElement[] = [];
  for (let i = 0; i < positions.length; i++) {
    for (let j = i + 1; j < positions.length; j++) {
      const dx = positions[i].x - positions[j].x;
      const dy = positions[i].y - positions[j].y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 130) {
        lines.push(
          <line
            key={`${i}-${j}`}
            x1={positions[i].x} y1={positions[i].y}
            x2={positions[j].x} y2={positions[j].y}
            stroke={accentColor}
            strokeOpacity={(1 - dist / 130) * 0.28}
            strokeWidth="1"
          />
        );
      }
    }
  }

  return (
    <svg
      width={W} height={H} viewBox={`0 0 ${W} ${H}`}
      style={{ position: "absolute", top: 0, left: 0, pointerEvents: "none" }}
    >
      {lines}
      {positions.map((p, i) => (
        <circle
          key={i}
          cx={p.x} cy={p.y} r={PARTICLES[i].size * 0.8}
          fill={accentColor}
          opacity={p.opacity * 0.65}
        />
      ))}
    </svg>
  );
};

// ─── A6: Bokeh Circles ────────────────────────────────────────────────────────
const BOKEH = Array.from({ length: 14 }, (_, i) => ({
  x: (i * 211.3 + 80) % W,
  y: (i * 173.7 + 60) % H,
  radius: 40 + (i % 5) * 50,
  speedX: ((i % 3) - 1) * 0.16 * (i % 2 === 0 ? 1 : -1),
  speedY: 0.07 + (i % 4) * 0.055,
  phase: i * 1.41,
  opacity: 0.032 + (i % 4) * 0.018,
}));

const BokehField: React.FC<{ frame: number; accentColor: string }> = ({ frame, accentColor }) => {
  const colors = [accentColor, "#38bdf8", "#818cf8", accentColor];
  return (
    <svg
      width={W} height={H} viewBox={`0 0 ${W} ${H}`}
      style={{ position: "absolute", top: 0, left: 0, pointerEvents: "none" }}
    >
      <defs>
        <filter id="bk-blur" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="28" />
        </filter>
      </defs>
      {BOKEH.map((b, i) => {
        const x = ((b.x + b.speedX * frame) % W + W) % W;
        const y = ((b.y + b.speedY * frame) % H + H) % H;
        const pulse = 0.6 + Math.sin(frame * 0.018 + b.phase) * 0.4;
        return (
          <circle
            key={i}
            cx={x} cy={y} r={b.radius}
            fill={colors[i % colors.length]}
            opacity={b.opacity * pulse}
            filter="url(#bk-blur)"
          />
        );
      })}
    </svg>
  );
};

// ─── A10: Gradient Mesh ───────────────────────────────────────────────────────
const MESH = Array.from({ length: 5 }, (_, i) => ({
  baseX: [0.25, 0.75, 0.5, 0.18, 0.82][i] * W,
  baseY: [0.22, 0.28, 0.58, 0.78, 0.72][i] * H,
  ampX: [0.13, 0.11, 0.09, 0.11, 0.10][i] * W,
  ampY: [0.09, 0.13, 0.10, 0.09, 0.12][i] * H,
  freqX: [0.0055, 0.0070, 0.0048, 0.0063, 0.0079][i],
  freqY: [0.0088, 0.0050, 0.0073, 0.0055, 0.0065][i],
  phase: i * 1.257,
  opacity: [0.14, 0.10, 0.13, 0.09, 0.11][i],
}));

const GradientMesh: React.FC<{ frame: number; accentColor: string }> = ({ frame, accentColor }) => {
  const colors = [accentColor, "#38bdf8", accentColor, "#818cf8", "#38bdf8"];
  return (
    <svg
      width={W} height={H} viewBox={`0 0 ${W} ${H}`}
      style={{ position: "absolute", top: 0, left: 0, pointerEvents: "none" }}
    >
      <defs>
        {MESH.map((p, i) => (
          <radialGradient key={i} id={`gm${i}`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={colors[i]} stopOpacity={p.opacity} />
            <stop offset="100%" stopColor={colors[i]} stopOpacity="0" />
          </radialGradient>
        ))}
      </defs>
      {MESH.map((p, i) => {
        const cx = p.baseX + Math.sin(frame * p.freqX + p.phase) * p.ampX;
        const cy = p.baseY + Math.cos(frame * p.freqY + p.phase * 0.7) * p.ampY;
        return (
          <ellipse key={i} cx={cx} cy={cy} rx={W * 0.44} ry={H * 0.30} fill={`url(#gm${i})`} />
        );
      })}
    </svg>
  );
};

// ─── Ambient blobs (always present regardless of A variant) ──────────────────
const AmbientBlobs: React.FC<{ frame: number; accentColor: string }> = ({ frame, accentColor }) => (
  <svg
    width={W} height={H} viewBox={`0 0 ${W} ${H}`}
    style={{ position: "absolute", top: 0, left: 0, pointerEvents: "none" }}
  >
    <defs>
      <radialGradient id="ab0" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stopColor={accentColor} stopOpacity="0.13" />
        <stop offset="100%" stopColor={accentColor} stopOpacity="0" />
      </radialGradient>
      <radialGradient id="ab1" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.08" />
        <stop offset="100%" stopColor="#38bdf8" stopOpacity="0" />
      </radialGradient>
      <radialGradient id="ab2" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stopColor={accentColor} stopOpacity="0.09" />
        <stop offset="100%" stopColor={accentColor} stopOpacity="0" />
      </radialGradient>
    </defs>
    <ellipse
      cx={540 + Math.sin(frame * 0.0088) * 280}
      cy={580 + Math.cos(frame * 0.0056) * 220}
      rx={520} ry={442} fill="url(#ab0)"
    />
    <ellipse
      cx={200 + Math.cos(frame * 0.0072) * 200}
      cy={1200 + Math.sin(frame * 0.0104) * 300}
      rx={460} ry={391} fill="url(#ab1)"
    />
    <ellipse
      cx={900 + Math.sin(frame * 0.0048) * 160}
      cy={1600 + Math.cos(frame * 0.008) * 200}
      rx={400} ry={340} fill="url(#ab2)"
    />
  </svg>
);

// ─── BackgroundLayer ──────────────────────────────────────────────────────────

interface Props {
  frame: number;
  style: StyleA;
  accentColor: string;
}

export const BackgroundLayer: React.FC<Props> = ({ frame, style, accentColor }) => (
  <>
    <AmbientBlobs frame={frame} accentColor={accentColor} />
    {style === "A1"  && <DeepSpaceField   frame={frame} accentColor={accentColor} />}
    {style === "A2"  && <ConstellationField frame={frame} accentColor={accentColor} />}
    {style === "A6"  && <BokehField        frame={frame} accentColor={accentColor} />}
    {style === "A10" && <GradientMesh      frame={frame} accentColor={accentColor} />}
    {/* HUD grid only on tech-aesthetic variants */}
    {(style === "A1" || style === "A2") && <HUDGrid frame={frame} />}
  </>
);
