import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  Easing,
} from "remotion";

// Canvas center
const CX = 200;
const CY = 200;

// Ring radii
const R_OUTER = 128;
const R_INNER = 106;

// Circumferences
const C_OUTER = 2 * Math.PI * R_OUTER;
const C_INNER = 2 * Math.PI * R_INNER;

export const SignalPlusLoading: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  // Seamless loop progress: 0 → 1 (frame 0 == frame durationInFrames visually)
  const t = frame / durationInFrames;

  // ── Outer ring: clockwise 360° per loop ──
  // Use easeInOut for more premium feel vs linear
  const outerRot = interpolate(t, [0, 1], [0, 360], {
    easing: Easing.inOut(Easing.sin),
    extrapolateRight: "clamp",
  });

  // ── Inner ring: counter-clockwise at 0.65× speed, offset 90° ──
  const innerRot = interpolate(t, [0, 1], [90, 90 - 360 * 0.65], {
    easing: Easing.inOut(Easing.sin),
    extrapolateRight: "clamp",
  });

  // ── Logo: subtle breathing scale (±2%) at 1× per loop ──
  const logoScale = 1 + interpolate(
    Math.sin(t * Math.PI * 2),
    [-1, 1],
    [-0.02, 0.02]
  );

  // ── Glow pulse (0.4–1.0) driven by frame, in seconds ──
  const glowPulse = 0.4 + interpolate(
    Math.sin((frame / fps) * Math.PI * 2 * (durationInFrames / fps) * 0.5),
    [-1, 1],
    [0, 0.6]
  );

  // Outer: two 36%-coverage arcs + 14% gaps
  const outerArcLen = C_OUTER * 0.36;
  const outerGapLen = C_OUTER * 0.14;
  const outerDash = `${outerArcLen} ${outerGapLen} ${outerArcLen} ${
    C_OUTER - 2 * outerArcLen - 2 * outerGapLen
  }`;

  // Inner: single 26%-coverage arc
  const innerArcLen = C_INNER * 0.26;
  const innerDash = `${innerArcLen} ${C_INNER - innerArcLen}`;

  // Logo transform: center 288×150 icon (bbox center: x≈144, y≈75), scale 0.57×
  const LOGO_SCALE = 0.57;
  const logoTransform = `translate(${CX},${CY}) scale(${LOGO_SCALE * logoScale}) translate(-144,-75)`;

  return (
    <AbsoluteFill style={{ background: "#070D1A" }}>
      <svg
        width="400"
        height="400"
        viewBox="0 0 400 400"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {/* Arc gradients — userSpaceOnUse so gradient sweeps as arc rotates */}
          <linearGradient
            id="arcGrad1"
            x1="70" y1="200" x2="330" y2="200"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%" stopColor="#0085FF" />
            <stop offset="50%" stopColor="#00C8F8" />
            <stop offset="100%" stopColor="#00FFF1" />
          </linearGradient>
          <linearGradient
            id="arcGrad2"
            x1="330" y1="200" x2="70" y2="200"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%" stopColor="#00FFD1" />
            <stop offset="100%" stopColor="#0083FD" />
          </linearGradient>

          {/* Logo gradients (exact match to original SVG) */}
          <linearGradient
            id="lg0"
            x1="44.16" y1="150.252" x2="241.992" y2="52.4352"
            gradientUnits="userSpaceOnUse"
          >
            <stop stopColor="#0085FF" />
            <stop offset="1" stopColor="#00FFF1" />
          </linearGradient>
          <linearGradient
            id="lg1"
            x1="243.84" y1="0" x2="74.7268" y2="132.959"
            gradientUnits="userSpaceOnUse"
          >
            <stop stopColor="#00FFD1" />
            <stop offset="1" stopColor="#0083FD" />
          </linearGradient>
          <linearGradient
            id="lg2"
            x1="243.84" y1="56.36" x2="47.7001" y2="107.465"
            gradientUnits="userSpaceOnUse"
          >
            <stop stopColor="#00FFE3" />
            <stop offset="1" stopColor="#01AAFC" />
          </linearGradient>

          {/* Arc glow filter */}
          <filter id="arcGlow" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          {/* Logo glow filter — intensity driven by glowPulse */}
          <filter id="logoGlow" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur
              in="SourceGraphic"
              stdDeviation={6 * glowPulse}
              result="blur"
            />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          {/* Background radial glow */}
          <radialGradient id="bgGlow" cx="50%" cy="50%" r="45%">
            <stop
              offset="0%"
              stopColor="#004EAA"
              stopOpacity={0.22 * glowPulse}
            />
            <stop offset="100%" stopColor="#004EAA" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Background ambient glow */}
        <circle cx="200" cy="200" r="200" fill="url(#bgGlow)" />

        {/* Subtle track rings */}
        <circle
          cx={CX} cy={CY} r={R_OUTER}
          fill="none" stroke="#0C1F38" strokeWidth="1"
        />
        <circle
          cx={CX} cy={CY} r={R_INNER}
          fill="none" stroke="#0C1F38" strokeWidth="1"
        />

        {/* ── Outer ring: two arcs rotating clockwise ── */}
        <g
          transform={`rotate(${outerRot},${CX},${CY})`}
          filter="url(#arcGlow)"
        >
          <circle
            cx={CX} cy={CY} r={R_OUTER}
            fill="none"
            stroke="url(#arcGrad1)"
            strokeWidth="9"
            strokeDasharray={outerDash}
            strokeLinecap="round"
          />
        </g>

        {/* ── Inner ring: single arc counter-rotating ── */}
        <g
          transform={`rotate(${innerRot},${CX},${CY})`}
          filter="url(#arcGlow)"
        >
          <circle
            cx={CX} cy={CY} r={R_INNER}
            fill="none"
            stroke="url(#arcGrad2)"
            strokeWidth="6"
            strokeDasharray={innerDash}
            strokeLinecap="round"
            opacity="0.85"
          />
        </g>

        {/* ── SignalPlus logo mark (icon only, centered) ── */}
        <g transform={logoTransform} filter="url(#logoGlow)">
          {/* Band 1: bottom diagonal */}
          <path
            d="M46.1857 56.1599H243.626C243.862 56.1599 243.925 56.5037 243.701 56.5739C216.265 65.1322 179.275 103.832 144.432 131.214C144.432 131.214 122.546 150.296 94.0572 150.24C69.972 150.193 50.7613 136.462 45.5567 132.359C44.6488 131.643 44.16 130.555 44.16 129.404L44.16 58.1702C44.16 57.06 45.067 56.1599 46.1857 56.1599Z"
            fill="url(#lg0)"
          />
          {/* Band 2: top diagonal */}
          <path
            d="M241.814 94.08H44.3736C44.138 94.08 44.0746 93.7362 44.2994 93.6662C71.7352 85.1077 108.725 46.4076 143.568 19.0261C143.568 19.0261 165.454 -0.055978 193.943 0.000123462C218.028 0.0475536 237.239 13.7779 242.443 17.8812C243.351 18.5971 243.84 19.6849 243.84 20.8357V92.0697C243.84 93.1799 242.933 94.08 241.814 94.08Z"
            fill="url(#lg1)"
          />
          {/* Intersection highlight */}
          <path
            fillRule="evenodd"
            clipRule="evenodd"
            d="M243.627 56.1599C243.862 56.1603 243.925 56.5036 243.701 56.574C227.701 61.5652 208.452 76.8092 188.273 94.0798H44.374C44.1384 94.0798 44.075 93.7358 44.2997 93.6658C60.3001 88.6744 79.549 73.4306 99.7275 56.1599H243.627Z"
            fill="url(#lg2)"
          />
        </g>
      </svg>
    </AbsoluteFill>
  );
};
