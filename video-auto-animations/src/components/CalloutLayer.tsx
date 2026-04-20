/**
 * CalloutLayer.tsx
 * Dimension F: step callout / subtitle style variants.
 *   F1 — Glass Card Bottom  (frosted glass card)
 *   F2 — Gradient Strip     (left accent bar, minimal background)
 *   F3 — Hero Center        (large centered text, ignores N position)
 *   F5 — Terminal Style     (monospace typing animation)
 *   F6 — Pill Compact       (small rounded pill, single line)
 *   F8 — Kinetic Word       (each word springs in from below)
 *   F9 — Corner Badge       (small top-right badge, ignores N position)
 *
 * Dimension N: callout position anchor (applied to F1/F2/F5/F6/F8).
 *   N1 — Bottom center   (default)
 *   N2 — Top             (above fold)
 *   N3 — Bottom-left     (left half only)
 *   N4 — Flush bottom    (full-width edge bar)
 *   N5 — Lower third     (~30% from bottom)
 */
import React from "react";
import { interpolate, spring, Easing } from "remotion";
import { StyleF, StyleN } from "../styles/StyleConfig";

interface CalloutProps {
  frame: number;
  fps: number;
  step: number;
  title: string;
  totalDuration: number;
  accentColor: string;
  style: StyleF;
  styleN?: StyleN;
}

// ─── Position helper (Dimension N) ───────────────────────────────────────────

function calloutPosition(styleN: StyleN = "N1"): Partial<React.CSSProperties> {
  switch (styleN) {
    case "N2": return { top: 60, left: 40, right: 40 };
    case "N3": return { bottom: 60, left: 40, right: "45%" };
    case "N4": return { bottom: 0, left: 0, right: 0 };
    case "N5": return { bottom: "28%", left: 40, right: 40 };
    default:   return { bottom: 60, left: 40, right: 40 };
  }
}

// ─── F1: Glass Card ───────────────────────────────────────────────────────────
const GlassCardCallout: React.FC<CalloutProps> = ({
  frame, step, title, totalDuration, accentColor, styleN,
}) => {
  const FADE_IN = 44;
  const FADE_OUT_START = Math.max(FADE_IN + 8, totalDuration - 36);

  const slideX = interpolate(frame, [0, FADE_IN], [80, 0], {
    easing: Easing.out(Easing.cubic),
    extrapolateRight: "clamp",
  });
  const opacity =
    frame < FADE_OUT_START
      ? interpolate(frame, [0, FADE_IN], [0, 1], { extrapolateRight: "clamp" })
      : interpolate(frame, [FADE_OUT_START, totalDuration], [1, 0], { extrapolateRight: "clamp" });
  const floatY = Math.sin(frame * 0.035) * 5;

  return (
    <div
      style={{
        position: "absolute",
        ...calloutPosition(styleN),
        opacity,
        transform: `translateX(${slideX}px) translateY(${floatY}px)`,
        background: "rgba(10,10,26,0.82)",
        backdropFilter: "blur(20px)",
        border: `1px solid ${accentColor}44`,
        borderRadius: 24,
        padding: "28px 32px",
        display: "flex",
        alignItems: "center",
        gap: 24,
        boxShadow: `0 8px 40px rgba(0,0,0,0.5), 0 0 0 1px ${accentColor}22`,
      }}
    >
      {/* Step badge */}
      <div
        style={{
          width: 64,
          height: 64,
          borderRadius: "50%",
          background: `linear-gradient(135deg, ${accentColor}, #818cf8)`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          fontSize: 28,
          fontWeight: 800,
          color: "#fff",
          boxShadow: `0 0 24px ${accentColor}66`,
        }}
      >
        {step}
      </div>
      <div
        style={{
          color: "#f1f5f9",
          fontSize: 30,
          fontWeight: 700,
          lineHeight: 1.25,
          fontFamily: "system-ui, -apple-system, sans-serif",
        }}
      >
        {title}
      </div>
      {/* Accent edge line */}
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 20,
          bottom: 20,
          width: 4,
          borderRadius: 2,
          background: `linear-gradient(to bottom, ${accentColor}, transparent)`,
        }}
      />
    </div>
  );
};

// ─── F2: Gradient Strip ───────────────────────────────────────────────────────
const GradientStripCallout: React.FC<CalloutProps> = ({
  frame, step, title, totalDuration, accentColor, styleN,
}) => {
  const FADE_IN = 40;
  const FADE_OUT_START = Math.max(FADE_IN + 8, totalDuration - 32);

  const slideX = interpolate(frame, [0, FADE_IN], [-60, 0], {
    easing: Easing.out(Easing.cubic),
    extrapolateRight: "clamp",
  });
  const opacity =
    frame < FADE_OUT_START
      ? interpolate(frame, [0, FADE_IN], [0, 1], { extrapolateRight: "clamp" })
      : interpolate(frame, [FADE_OUT_START, totalDuration], [1, 0], { extrapolateRight: "clamp" });

  return (
    <div
      style={{
        position: "absolute",
        ...calloutPosition(styleN),
        opacity,
        transform: `translateX(${slideX}px)`,
        display: "flex",
        alignItems: "center",
        gap: 20,
        padding: "16px 0",
      }}
    >
      {/* Left accent bar */}
      <div
        style={{
          width: 5,
          height: 72,
          background: `linear-gradient(to bottom, ${accentColor}, ${accentColor}33)`,
          borderRadius: 3,
          flexShrink: 0,
          boxShadow: `0 0 12px ${accentColor}66`,
        }}
      />
      {/* Step number */}
      <span
        style={{
          color: accentColor,
          fontSize: 20,
          fontWeight: 900,
          fontFamily: "system-ui, -apple-system, sans-serif",
          opacity: 0.85,
          minWidth: 28,
        }}
      >
        {String(step).padStart(2, "0")}
      </span>
      {/* Divider */}
      <div style={{ width: 1, height: 38, background: `${accentColor}44`, flexShrink: 0 }} />
      {/* Title */}
      <div
        style={{
          color: "#f1f5f9",
          fontSize: 32,
          fontWeight: 700,
          fontFamily: "system-ui, -apple-system, sans-serif",
          lineHeight: 1.3,
          textShadow: "0 2px 12px rgba(0,0,0,0.7)",
        }}
      >
        {title}
      </div>
    </div>
  );
};

// ─── F3: Hero Center (ignores N — always centered) ────────────────────────────
const HeroCenterCallout: React.FC<CalloutProps> = ({
  frame, fps, totalDuration, accentColor, title,
}) => {
  const FADE_IN = 44;
  const FADE_OUT_START = Math.max(FADE_IN + 8, totalDuration - 36);

  const opacity =
    frame < FADE_OUT_START
      ? interpolate(frame, [0, FADE_IN], [0, 1], { extrapolateRight: "clamp" })
      : interpolate(frame, [FADE_OUT_START, totalDuration], [1, 0], { extrapolateRight: "clamp" });

  const scaleP = spring({ frame, fps, config: { damping: 22, stiffness: 100 }, durationInFrames: 50 });
  const scale = interpolate(scaleP, [0, 1], [0.92, 1]);

  return (
    <div
      style={{
        position: "absolute",
        bottom: "30%",
        left: 0,
        right: 0,
        opacity,
        transform: `scale(${scale})`,
        textAlign: "center",
        padding: "36px 48px",
        background:
          "linear-gradient(to bottom, transparent, rgba(5,7,20,0.88) 25%, rgba(5,7,20,0.88) 75%, transparent)",
      }}
    >
      <div
        style={{
          fontSize: 52,
          fontWeight: 900,
          color: "#ffffff",
          lineHeight: 1.15,
          fontFamily: "system-ui, -apple-system, sans-serif",
          letterSpacing: -0.5,
        }}
      >
        {title}
      </div>
      <div
        style={{
          width: 48,
          height: 3,
          background: accentColor,
          margin: "18px auto 0",
          borderRadius: 2,
          boxShadow: `0 0 10px ${accentColor}`,
        }}
      />
    </div>
  );
};

// ─── F5: Terminal Style ───────────────────────────────────────────────────────
const TerminalCallout: React.FC<CalloutProps> = ({
  frame, step, title, totalDuration, accentColor, styleN,
}) => {
  const FADE_IN = 32;
  const FADE_OUT_START = Math.max(FADE_IN + 8, totalDuration - 28);

  const opacity =
    frame < FADE_OUT_START
      ? interpolate(frame, [0, FADE_IN], [0, 1], { extrapolateRight: "clamp" })
      : interpolate(frame, [FADE_OUT_START, totalDuration], [1, 0], { extrapolateRight: "clamp" });

  const fullText = `> Step ${step}: ${title}`;
  const visibleChars = Math.min(
    fullText.length,
    Math.floor(Math.max(0, frame - 8) / 3)
  );
  const showCursor =
    visibleChars < fullText.length || Math.floor(frame * 0.25) % 2 === 0;

  return (
    <div
      style={{
        position: "absolute",
        ...calloutPosition(styleN),
        opacity,
        background: "rgba(0,0,0,0.90)",
        backdropFilter: "blur(12px)",
        border: `1px solid ${accentColor}55`,
        borderRadius: 12,
        padding: "20px 28px",
      }}
    >
      <div
        style={{
          fontSize: 26,
          color: accentColor,
          fontWeight: 600,
          lineHeight: 1.5,
          fontFamily: "'Courier New', 'SF Mono', 'Menlo', monospace",
          letterSpacing: 0.5,
        }}
      >
        {fullText.slice(0, visibleChars)}
        {showCursor && <span style={{ opacity: 0.9 }}>█</span>}
      </div>
    </div>
  );
};

// ─── F6: Pill Compact ─────────────────────────────────────────────────────────
const PillCallout: React.FC<CalloutProps> = ({
  frame, fps, step, title, totalDuration, accentColor, styleN,
}) => {
  const FADE_IN = 36;
  const FADE_OUT_START = Math.max(FADE_IN + 8, totalDuration - 28);

  const opacity =
    frame < FADE_OUT_START
      ? interpolate(frame, [0, FADE_IN], [0, 1], { extrapolateRight: "clamp" })
      : interpolate(frame, [FADE_OUT_START, totalDuration], [1, 0], { extrapolateRight: "clamp" });

  const scaleP = spring({ frame, fps, config: { damping: 20, stiffness: 150 }, durationInFrames: 40 });
  const scale = interpolate(scaleP, [0, 1], [0.72, 1]);

  // Pill uses left anchor from N but ignores right (compact width)
  const pos = calloutPosition(styleN);
  const pillPos: Partial<React.CSSProperties> = {
    bottom: (pos as any).bottom,
    top: (pos as any).top,
    left: (pos as any).left ?? 40,
  };

  return (
    <div
      style={{
        position: "absolute",
        ...pillPos,
        opacity,
        transform: `scale(${scale})`,
        transformOrigin: "left center",
        display: "inline-flex",
        alignItems: "center",
        gap: 14,
        background: `linear-gradient(135deg, ${accentColor}28, rgba(10,10,26,0.85))`,
        border: `1.5px solid ${accentColor}66`,
        borderRadius: 100,
        padding: "14px 26px",
        backdropFilter: "blur(10px)",
        boxShadow: `0 4px 20px rgba(0,0,0,0.35), 0 0 0 1px ${accentColor}18`,
      }}
    >
      {/* Glow dot */}
      <div
        style={{
          width: 10,
          height: 10,
          borderRadius: "50%",
          background: accentColor,
          flexShrink: 0,
          boxShadow: `0 0 8px ${accentColor}, 0 0 16px ${accentColor}66`,
        }}
      />
      {/* Title */}
      <span
        style={{
          color: "#f1f5f9",
          fontSize: 26,
          fontWeight: 700,
          fontFamily: "system-ui, -apple-system, sans-serif",
          whiteSpace: "nowrap",
        }}
      >
        {title}
      </span>
      {/* Step badge */}
      <span
        style={{
          background: `${accentColor}33`,
          color: accentColor,
          fontSize: 16,
          fontWeight: 800,
          borderRadius: 100,
          padding: "3px 10px",
          flexShrink: 0,
        }}
      >
        {step}
      </span>
    </div>
  );
};

// ─── F8: Kinetic Word ─────────────────────────────────────────────────────────
const KineticWordCallout: React.FC<CalloutProps> = ({
  frame, fps, step, title, totalDuration, accentColor, styleN,
}) => {
  const FADE_OUT_START = Math.max(16, totalDuration - 28);
  const containerOpacity =
    frame >= FADE_OUT_START
      ? interpolate(frame, [FADE_OUT_START, totalDuration], [1, 0], { extrapolateRight: "clamp" })
      : 1;

  const words = title.split(" ");
  const STAGGER = 10;
  const ENTER_DUR = 36;

  return (
    <div
      style={{
        position: "absolute",
        ...calloutPosition(styleN),
        opacity: containerOpacity,
        background: "rgba(10,10,26,0.80)",
        backdropFilter: "blur(16px)",
        border: `1px solid ${accentColor}33`,
        borderRadius: 20,
        padding: "22px 28px",
        display: "flex",
        alignItems: "center",
        gap: 18,
        flexWrap: "wrap",
        overflow: "hidden",
      }}
    >
      {/* Step badge */}
      <div
        style={{
          width: 52,
          height: 52,
          borderRadius: "50%",
          background: `linear-gradient(135deg, ${accentColor}, #818cf8)`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          fontSize: 22,
          fontWeight: 800,
          color: "#fff",
        }}
      >
        {step}
      </div>

      {/* Words animating in */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "baseline" }}>
        {words.map((word, wi) => {
          const wordFrame = Math.max(0, frame - wi * STAGGER);
          const sp = spring({
            frame: wordFrame,
            fps,
            config: { damping: 16, stiffness: 130 },
            durationInFrames: ENTER_DUR,
          });
          const y = interpolate(sp, [0, 1], [30, 0]);
          const op = interpolate(wordFrame, [0, ENTER_DUR * 0.4], [0, 1], {
            extrapolateRight: "clamp",
          });
          return (
            <span
              key={wi}
              style={{
                color: "#f1f5f9",
                fontSize: 30,
                fontWeight: 700,
                fontFamily: "system-ui, -apple-system, sans-serif",
                transform: `translateY(${y}px)`,
                opacity: op,
                display: "inline-block",
              }}
            >
              {word}
            </span>
          );
        })}
      </div>
    </div>
  );
};

// ─── F9: Corner Badge (always top-right, ignores N) ──────────────────────────
const CornerBadgeCallout: React.FC<CalloutProps> = ({
  frame, step, title, totalDuration, accentColor,
}) => {
  const FADE_IN = 28;
  const FADE_OUT_START = Math.max(FADE_IN + 8, totalDuration - 24);

  const opacity =
    frame < FADE_OUT_START
      ? interpolate(frame, [0, FADE_IN], [0, 1], { extrapolateRight: "clamp" })
      : interpolate(frame, [FADE_OUT_START, totalDuration], [1, 0], { extrapolateRight: "clamp" });

  const slideY = interpolate(frame, [0, FADE_IN], [-50, 0], {
    easing: Easing.out(Easing.cubic),
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        position: "absolute",
        top: 80,
        right: 36,
        opacity,
        transform: `translateY(${slideY}px)`,
        background: `linear-gradient(135deg, ${accentColor}, #818cf8)`,
        borderRadius: 18,
        padding: "16px 24px",
        maxWidth: 380,
        boxShadow: `0 8px 32px ${accentColor}44, 0 2px 8px rgba(0,0,0,0.4)`,
      }}
    >
      <div
        style={{
          color: "#fff",
          fontSize: 14,
          fontWeight: 700,
          opacity: 0.85,
          letterSpacing: 1.5,
          textTransform: "uppercase",
          fontFamily: "system-ui, -apple-system, sans-serif",
          marginBottom: 6,
        }}
      >
        Step {step}
      </div>
      <div
        style={{
          color: "#fff",
          fontSize: 22,
          fontWeight: 800,
          fontFamily: "system-ui, -apple-system, sans-serif",
          lineHeight: 1.25,
        }}
      >
        {title}
      </div>
    </div>
  );
};

// ─── CalloutLayer ─────────────────────────────────────────────────────────────
export const CalloutLayer: React.FC<CalloutProps> = (props) => {
  switch (props.style) {
    case "F1": return <GlassCardCallout {...props} />;
    case "F2": return <GradientStripCallout {...props} />;
    case "F3": return <HeroCenterCallout {...props} />;
    case "F5": return <TerminalCallout {...props} />;
    case "F6": return <PillCallout {...props} />;
    case "F8": return <KineticWordCallout {...props} />;
    case "F9": return <CornerBadgeCallout {...props} />;
    default:   return <GlassCardCallout {...props} />;
  }
};
