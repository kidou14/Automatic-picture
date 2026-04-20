/**
 * BackgroundLayer.tsx
 * Dimension A: background atmosphere variants.
 *   A1  — Deep Space    (floating particles + HUD grid)
 *   A2  — Constellation (particles + auto-connecting lines)
 *   A3  — Neon Rain     (vertical streaks falling downward)
 *   A6  — Bokeh Circles (soft blurry orbs, organic)
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

// ─── A3: Neon Rain ────────────────────────────────────────────────────────────
const STREAKS = Array.from({ length: 22 }, (_, i) => ({
  x: (i * 211.3 + 40) % W,
  baseY: (i * 173.7) % H,
  length: 40 + (i % 5) * 28,
  speed: 2.8 + (i % 4) * 1.1,
  opacity: 0.12 + (i % 4) * 0.09,
  phase: i * 0.97,
  colorIdx: i % 3,
}));

const NeonRain: React.FC<{ frame: number; accentColor: string }> = ({ frame, accentColor }) => {
  const colors = [accentColor, "#38bdf8", "#818cf8"];
  return (
    <svg
      width={W} height={H} viewBox={`0 0 ${W} ${H}`}
      style={{ position: "absolute", top: 0, left: 0, pointerEvents: "none" }}
    >
      {STREAKS.map((s, i) => {
        const y = ((s.baseY + s.speed * frame) % H + H) % H;
        const pulse = 0.6 + Math.sin(frame * 0.035 + s.phase) * 0.4;
        const color = colors[s.colorIdx];
        return (
          <line
            key={i}
            x1={s.x} y1={y}
            x2={s.x} y2={y + s.length}
            stroke={color}
            strokeOpacity={s.opacity * pulse}
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        );
      })}
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

// ─── A4: Aurora Bands ─────────────────────────────────────────────────────────
const AURORA = [
  { baseY: 0.22, freq: 0.0028, phase: 0.0 },
  { baseY: 0.50, freq: 0.0036, phase: 2.1 },
  { baseY: 0.78, freq: 0.0021, phase: 4.3 },
];

const AuroraBands: React.FC<{ frame: number; accentColor: string }> = ({ frame, accentColor }) => {
  const colors = [accentColor, "#38bdf8", "#818cf8"];
  const bands = AURORA.map((b, i) => ({
    cy: (b.baseY + Math.sin(frame * b.freq + b.phase) * 0.06) * H,
    opacity: 0.14 * (0.6 + Math.sin(frame * 0.018 + b.phase) * 0.4),
    color: colors[i],
  }));
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}
      style={{ position: "absolute", top: 0, left: 0, pointerEvents: "none" }}>
      <defs>
        {bands.map((band, i) => (
          <linearGradient key={i} id={`aug${i}`}
            x1="0" y1={band.cy - 220} x2="0" y2={band.cy + 220}
            gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor={band.color} stopOpacity="0" />
            <stop offset="50%" stopColor={band.color} stopOpacity={band.opacity} />
            <stop offset="100%" stopColor={band.color} stopOpacity="0" />
          </linearGradient>
        ))}
      </defs>
      {bands.map((band, i) => (
        <rect key={i} x={0} y={band.cy - 220} width={W} height={440} fill={`url(#aug${i})`} />
      ))}
    </svg>
  );
};

// ─── A5: Floating Shapes ──────────────────────────────────────────────────────
const SHAPES_DATA = Array.from({ length: 7 }, (_, i) => ({
  cx: (i * 211.3 + 100) % W,
  cy: (i * 173.7 + 80) % H,
  size: 44 + (i % 4) * 28,
  type: i % 3,
  speedX: ((i % 3) - 1) * 0.10,
  speedY: 0.03 + (i % 3) * 0.04,
  rotSpeed: ((i % 5) - 2) * 0.009,
  phase: i * 1.41,
  opacity: 0.07 + (i % 3) * 0.04,
  colorIdx: i % 3,
}));

const FloatingShapes: React.FC<{ frame: number; accentColor: string }> = ({ frame, accentColor }) => {
  const colors = [accentColor, "#818cf8", "#38bdf8"];
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}
      style={{ position: "absolute", top: 0, left: 0, pointerEvents: "none" }}>
      {SHAPES_DATA.map((s, i) => {
        const x = ((s.cx + s.speedX * frame) % W + W) % W;
        const y = ((s.cy + s.speedY * frame) % H + H) % H;
        const rot = s.rotSpeed * frame;
        const op = s.opacity * (0.7 + Math.sin(frame * 0.022 + s.phase) * 0.3);
        const color = colors[s.colorIdx];
        const half = s.size / 2;
        if (s.type === 0) {
          return <rect key={i} x={x - half} y={y - half} width={s.size} height={s.size} fill="none" stroke={color} strokeWidth="1" opacity={op} transform={`rotate(${rot} ${x} ${y})`} />;
        } else if (s.type === 1) {
          return <rect key={i} x={x - half} y={y - half} width={s.size} height={s.size} fill="none" stroke={color} strokeWidth="1" opacity={op} transform={`rotate(${45 + rot} ${x} ${y})`} />;
        } else {
          const pts = `${x},${y - half} ${x + half * 0.866},${y + half * 0.5} ${x - half * 0.866},${y + half * 0.5}`;
          return <polygon key={i} points={pts} fill="none" stroke={color} strokeWidth="1" opacity={op} transform={`rotate(${rot} ${x} ${y})`} />;
        }
      })}
    </svg>
  );
};

// ─── A7: Concentric Rings ─────────────────────────────────────────────────────
const ConcentricRings: React.FC<{ frame: number; accentColor: string }> = ({ frame, accentColor }) => {
  const cx = W / 2;
  const cy = H * 0.44;
  const NUM = 5;
  const PERIOD = 200;
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}
      style={{ position: "absolute", top: 0, left: 0, pointerEvents: "none" }}>
      {Array.from({ length: NUM }, (_, i) => {
        const phase = ((i / NUM) + (frame / PERIOD)) % 1;
        const r = 60 + phase * 820;
        const opacity = (1 - phase) * 0.13;
        const color = i % 2 === 0 ? accentColor : "#818cf8";
        return <circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth="1" opacity={opacity} />;
      })}
    </svg>
  );
};

// ─── A8: Horizon Line ─────────────────────────────────────────────────────────
const HorizonLine: React.FC<{ frame: number; accentColor: string }> = ({ frame, accentColor }) => {
  const y1 = H * (0.40 + Math.sin(frame * 0.007) * 0.05);
  const y2 = H * (0.65 + Math.sin(frame * 0.011 + 1.5) * 0.04);
  const op1 = 0.38 + Math.sin(frame * 0.014) * 0.16;
  const op2 = 0.24 + Math.sin(frame * 0.020 + 2.0) * 0.10;
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}
      style={{ position: "absolute", top: 0, left: 0, pointerEvents: "none" }}>
      <defs>
        <linearGradient id="hl-g1" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="transparent" />
          <stop offset="18%" stopColor={accentColor} />
          <stop offset="82%" stopColor="#38bdf8" />
          <stop offset="100%" stopColor="transparent" />
        </linearGradient>
        <linearGradient id="hl-g2" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="transparent" />
          <stop offset="28%" stopColor="#818cf8" />
          <stop offset="72%" stopColor={accentColor} />
          <stop offset="100%" stopColor="transparent" />
        </linearGradient>
      </defs>
      <line x1={0} y1={y1} x2={W} y2={y1} stroke="url(#hl-g1)" strokeWidth="2" opacity={op1} />
      <line x1={0} y1={y2} x2={W} y2={y2} stroke="url(#hl-g2)" strokeWidth="1.5" opacity={op2} />
    </svg>
  );
};

// ─── A9: Data Lines ───────────────────────────────────────────────────────────
const DATA_LINES_DATA = Array.from({ length: 7 }, (_, i) => ({
  y: (i * 0.145 + 0.08) * H,
  speed: 0.25 + (i % 3) * 0.18,
  len: 60 + (i % 4) * 100,
  opacity: 0.07 + (i % 3) * 0.04,
  phase: i * 1.88,
  colorIdx: i % 3,
}));

const DataLines: React.FC<{ frame: number; accentColor: string }> = ({ frame, accentColor }) => {
  const colors = [accentColor, "#38bdf8", "#818cf8"];
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}
      style={{ position: "absolute", top: 0, left: 0, pointerEvents: "none" }}>
      {DATA_LINES_DATA.map((dl, i) => {
        const xEnd = ((W + dl.len) - (frame * dl.speed) % (W + dl.len) + (W + dl.len)) % (W + dl.len);
        const xStart = xEnd - dl.len;
        const pulse = 0.7 + Math.sin(frame * 0.02 + dl.phase) * 0.3;
        return (
          <line key={i}
            x1={xStart} y1={dl.y} x2={xEnd} y2={dl.y}
            stroke={colors[dl.colorIdx]}
            strokeWidth="1"
            opacity={dl.opacity * pulse}
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
    {style === "A1"  && <DeepSpaceField    frame={frame} accentColor={accentColor} />}
    {style === "A2"  && <ConstellationField frame={frame} accentColor={accentColor} />}
    {style === "A3"  && <NeonRain          frame={frame} accentColor={accentColor} />}
    {style === "A4"  && <AuroraBands       frame={frame} accentColor={accentColor} />}
    {style === "A5"  && <FloatingShapes    frame={frame} accentColor={accentColor} />}
    {style === "A6"  && <BokehField        frame={frame} accentColor={accentColor} />}
    {style === "A7"  && <ConcentricRings   frame={frame} accentColor={accentColor} />}
    {style === "A8"  && <HorizonLine       frame={frame} accentColor={accentColor} />}
    {style === "A9"  && <DataLines         frame={frame} accentColor={accentColor} />}
    {style === "A10" && <GradientMesh      frame={frame} accentColor={accentColor} />}
    {/* HUD grid only on tech-aesthetic variants */}
    {(style === "A1" || style === "A2") && <HUDGrid frame={frame} />}
  </>
);
