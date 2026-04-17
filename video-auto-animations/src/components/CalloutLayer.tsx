/**
 * CalloutLayer.tsx
 * Dimension F: step callout / subtitle style variants.
 *   F1 — Glass Card Bottom (original: frosted glass card)
 *   F5 — Terminal Style   (monospace typing animation)
 *   F8 — Kinetic Word     (each word springs in from below)
 */
import React from "react";
import { interpolate, spring, Easing } from "remotion";
import { StyleF } from "../styles/StyleConfig";

interface CalloutProps {
  frame: number;
  fps: number;
  step: number;
  title: string;
  totalDuration: number;
  accentColor: string;
  style: StyleF;
}

// ─── F1: Glass Card (original StepCallout behaviour) ─────────────────────────
const GlassCardCallout: React.FC<CalloutProps> = ({
  frame, step, title, totalDuration, accentColor,
}) => {
  const FADE_IN = 22;
  const FADE_OUT_START = Math.max(FADE_IN + 4, totalDuration - 18);

  const slideX = interpolate(frame, [0, FADE_IN], [80, 0], {
    easing: Easing.out(Easing.cubic),
    extrapolateRight: "clamp",
  });
  const opacity =
    frame < FADE_OUT_START
      ? interpolate(frame, [0, FADE_IN], [0, 1], { extrapolateRight: "clamp" })
      : interpolate(frame, [FADE_OUT_START, totalDuration], [1, 0], { extrapolateRight: "clamp" });
  const floatY = Math.sin(frame * 0.07) * 5;

  return (
    <div
      style={{
        position: "absolute",
        bottom: 60,
        left: 40,
        right: 40,
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

// ─── F5: Terminal Style ───────────────────────────────────────────────────────
const TerminalCallout: React.FC<CalloutProps> = ({
  frame, step, title, totalDuration, accentColor,
}) => {
  const FADE_IN = 16;
  const FADE_OUT_START = Math.max(FADE_IN + 4, totalDuration - 14);

  const opacity =
    frame < FADE_OUT_START
      ? interpolate(frame, [0, FADE_IN], [0, 1], { extrapolateRight: "clamp" })
      : interpolate(frame, [FADE_OUT_START, totalDuration], [1, 0], { extrapolateRight: "clamp" });

  const fullText = `> Step ${step}: ${title}`;
  // One character every 1.5 frames, starts after 4 frames
  const visibleChars = Math.min(
    fullText.length,
    Math.floor(Math.max(0, frame - 4) / 1.5)
  );
  const showCursor =
    visibleChars < fullText.length || Math.floor(frame * 0.5) % 2 === 0;

  return (
    <div
      style={{
        position: "absolute",
        bottom: 60,
        left: 40,
        right: 40,
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

// ─── F8: Kinetic Word ─────────────────────────────────────────────────────────
const KineticWordCallout: React.FC<CalloutProps> = ({
  frame, fps, step, title, totalDuration, accentColor,
}) => {
  const FADE_OUT_START = Math.max(8, totalDuration - 14);
  const containerOpacity =
    frame >= FADE_OUT_START
      ? interpolate(frame, [FADE_OUT_START, totalDuration], [1, 0], { extrapolateRight: "clamp" })
      : 1;

  const words = title.split(" ");
  const STAGGER = 5;
  const ENTER_DUR = 18;

  return (
    <div
      style={{
        position: "absolute",
        bottom: 60,
        left: 40,
        right: 40,
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

// ─── CalloutLayer ─────────────────────────────────────────────────────────────
export const CalloutLayer: React.FC<CalloutProps> = (props) => {
  if (props.style === "F1") return <GlassCardCallout {...props} />;
  if (props.style === "F5") return <TerminalCallout {...props} />;
  if (props.style === "F8") return <KineticWordCallout {...props} />;
  return <GlassCardCallout {...props} />;
};
