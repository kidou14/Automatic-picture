import React from "react";
import { interpolate, spring, Easing } from "remotion";

interface Props {
  frame: number;           // local frame (starts at 0 when Sequence begins)
  fps: number;
  step: number;
  title: string;
  subtitle?: string;
  side?: "left" | "right"; // slide in from which side
  totalDuration: number;   // when to start fading out
  accentColor?: string;
}

export const StepCallout: React.FC<Props> = ({
  frame,
  fps,
  step,
  title,
  subtitle,
  side = "right",
  totalDuration,
  accentColor = "#6366f1",
}) => {
  const FADE_IN = 22;
  const FADE_OUT_START = totalDuration - 18;

  // Slide in
  const enterProgress = Math.min(1, frame / FADE_IN);
  const slideX = interpolate(frame, [0, FADE_IN], [side === "right" ? 100 : -100, 0], {
    easing: Easing.out(Easing.cubic),
    extrapolateRight: "clamp",
  });
  const opacity = frame < FADE_OUT_START
    ? interpolate(frame, [0, FADE_IN], [0, 1], { extrapolateRight: "clamp" })
    : interpolate(frame, [FADE_OUT_START, totalDuration], [1, 0], { extrapolateRight: "clamp" });

  // Gentle float
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
      {/* Step circle */}
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

      {/* Text */}
      <div>
        <div style={{ color: "#f1f5f9", fontSize: 30, fontWeight: 700, lineHeight: 1.25, fontFamily: "sans-serif" }}>
          {title}
        </div>
        {subtitle && (
          <div style={{ color: "#94a3b8", fontSize: 22, marginTop: 6, fontFamily: "sans-serif" }}>
            {subtitle}
          </div>
        )}
      </div>

      {/* Accent line */}
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
