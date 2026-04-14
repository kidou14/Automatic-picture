import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  Sequence,
  Easing,
  staticFile,
} from "remotion";
import { AnimatedCursor, CursorKeyframe } from "../components/AnimatedCursor";
import { ParticleField } from "../components/ParticleField";
import { GlowBlobs } from "../components/GlowBlobs";
import { StepCallout } from "../components/StepCallout";
import { ScreenshotViewer, FRAME_TOP, ssYToCanvas } from "../components/ScreenshotViewer";
import { ClickBurst } from "../components/ClickBurst";
import { HUDGrid } from "../components/HUDGrid";

// ─── Screenshot paths ─────────────────────────────────────────────────────────
const SS = {
  initial:   "screenshots/01-initial.png",
  optionTab: "screenshots/02-options-tab.png",
  formFill:  "screenshots/03-form-filled.png",
  calcBtn:   "screenshots/04-calc-visible.png",
  results:   "screenshots/05-results.png",
};

// ─── Coordinate constants ─────────────────────────────────────────────────────
// All coords measured in native pixels from screenshots/coords.json
// scrollOffset_03 = 0 (screenshots 01-03 start from top)
// scrollOffset_04 = 852 → places calcBtn at canvas y ≈ 1500

const SCROLL_04 = 852; // scrollOffset for 04-calc-visible screenshot

const POS = {
  optionsTab:       { x: 783, y: ssYToCanvas(616, 0) },       // canvas y ≈ 816
  inputUnderlying:  { x: 540, y: ssYToCanvas(1104, 0) },      // canvas y ≈ 1304
  inputPremium:     { x: 540, y: ssYToCanvas(1339, 0) },      // canvas y ≈ 1539
  inputStrike:      { x: 540, y: ssYToCanvas(1575, 0) },      // canvas y ≈ 1775
  calcBtn:          { x: 540, y: ssYToCanvas(2152, SCROLL_04) }, // canvas y ≈ 1500
};

// ─── Highlight box over a region ──────────────────────────────────────────────
const Highlight: React.FC<{
  frame: number; x: number; y: number; w: number; h: number; color: string;
}> = ({ frame, x, y, w, h, color }) => {
  const pulse = 0.6 + Math.sin(frame * 0.18) * 0.4;
  return (
    <div style={{
      position: "absolute",
      left: x - w / 2, top: y - h / 2, width: w, height: h,
      border: `3px solid ${color}`,
      borderRadius: 12,
      boxShadow: `0 0 ${24 * pulse}px ${color}, inset 0 0 ${16 * pulse}px ${color}22`,
      pointerEvents: "none",
    }} />
  );
};

// ─── Scan-reveal effect ───────────────────────────────────────────────────────
const ScanReveal: React.FC<{ frame: number; duration: number; y: number; height: number }> = ({
  frame, duration, y, height,
}) => {
  const progress = interpolate(frame, [0, duration], [0, 1], {
    easing: Easing.out(Easing.cubic),
    extrapolateRight: "clamp",
  });
  const scanY = y + progress * height;
  return (
    <div style={{ position: "absolute", top: y, left: 0, right: 0, height, overflow: "hidden", pointerEvents: "none" }}>
      {/* Scan line */}
      <div style={{
        position: "absolute",
        top: progress * height - 2,
        left: 0, right: 0, height: 4,
        background: "linear-gradient(to right, transparent 0%, #6366f1 20%, #818cf8 50%, #6366f1 80%, transparent 100%)",
        boxShadow: "0 0 20px #6366f1, 0 0 40px #818cf8",
        opacity: progress < 1 ? 1 : 0,
      }} />
      {/* Reveal mask — below scan line is visible */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0,
        height: progress * height,
        background: "transparent",
      }} />
      {/* Mask above scan line */}
      <div style={{
        position: "absolute",
        top: progress * height,
        left: 0, right: 0,
        bottom: 0,
        background: "#050714",
        opacity: progress < 1 ? 1 : 0,
      }} />
    </div>
  );
};

// ─── Number counter ───────────────────────────────────────────────────────────
const Counter: React.FC<{ frame: number; from: number; to: number; duration: number; prefix?: string; suffix?: string; color: string }> = ({
  frame, from, to, duration, prefix = "", suffix = "", color,
}) => {
  const val = interpolate(frame, [0, duration], [from, to], {
    easing: Easing.out(Easing.cubic),
    extrapolateRight: "clamp",
  });
  return (
    <span style={{ color, fontWeight: 800, fontFamily: "monospace" }}>
      {prefix}{val >= 0 ? "+" : ""}{val.toFixed(2)}{suffix}
    </span>
  );
};

// ─── Main Composition ─────────────────────────────────────────────────────────
export const EvCalcPromo: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // ── Scene phases ──────────────────────────────────────────────────────────
  // 0-50:   Opening
  // 40-130: SS01 enters + cursor moves to optionsTab
  // 110-145: click + crossfade SS01→SS02
  // 140-230: cursor fills form inputs + crossfade SS02→SS03
  // 220-275: scroll animation + SS04 + cursor to calcBtn + click
  // 252-280: crossfade SS04→SS05
  // 268-300: results + outro

  // ── Which screenshot to show ──────────────────────────────────────────────
  // We control which layers to pass to ScreenshotViewer based on phase
  const showSS = frame >= 40;
  const phase2 = frame >= 115; // after tab click
  const phase3 = frame >= 200; // after form fill
  const phase4 = frame >= 228; // show calc btn
  const phase5 = frame >= 255; // show results

  // Scroll offset animates 0→SCROLL_04 during frames 220-240
  const scrollOffset04 = interpolate(frame, [220, 240], [0, SCROLL_04], {
    easing: Easing.inOut(Easing.cubic),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Determine current from/to layers
  type SSLayer = { file: string; scrollOffset?: number };
  let fromLayer: SSLayer = { file: SS.initial };
  let toLayer: SSLayer | undefined;
  let cfStart: number | undefined;

  if (phase5) {
    fromLayer = { file: SS.calcBtn, scrollOffset: SCROLL_04 };
    toLayer   = { file: SS.results, scrollOffset: 0 };
    cfStart   = 255;
  } else if (phase4) {
    fromLayer = { file: SS.formFill };
    toLayer   = { file: SS.calcBtn, scrollOffset: SCROLL_04 };
    cfStart   = 228;
  } else if (phase3) {
    fromLayer = { file: SS.optionTab };
    toLayer   = { file: SS.formFill };
    cfStart   = 200;
  } else if (phase2) {
    fromLayer = { file: SS.initial };
    toLayer   = { file: SS.optionTab };
    cfStart   = 115;
  }

  // ── Cursor path ──────────────────────────────────────────────────────────
  const cursorKeyframes: CursorKeyframe[] = [
    { frame: 55,  x: 1150, y: 700 },          // offscreen right
    { frame: 95,  x: 920,  y: POS.optionsTab.y },  // approaching
    { frame: 115, x: POS.optionsTab.x,  y: POS.optionsTab.y },  // on tab
    { frame: 150, x: POS.inputUnderlying.x, y: POS.inputUnderlying.y },
    { frame: 165, x: POS.inputUnderlying.x, y: POS.inputUnderlying.y },
    { frame: 180, x: POS.inputPremium.x, y: POS.inputPremium.y },
    { frame: 198, x: POS.inputStrike.x,  y: POS.inputStrike.y },
    { frame: 218, x: POS.inputStrike.x,  y: POS.inputStrike.y },
    // During scroll (220-242): cursor slides down with the scroll
    { frame: 242, x: POS.calcBtn.x, y: 1900 },   // off bottom
    { frame: 244, x: POS.calcBtn.x, y: 400  },   // reappear top
    { frame: 255, x: POS.calcBtn.x, y: POS.calcBtn.y }, // on calc btn
    { frame: 270, x: POS.calcBtn.x, y: POS.calcBtn.y },
    { frame: 295, x: 1200, y: 1200 },             // exit
  ];

  const clickFrames = [115, 165, 180, 198, 255];

  // Cursor visible except during scroll transition
  const cursorVisible = frame >= 55 && frame < 300 && !(frame >= 220 && frame < 244);

  // ── Opening title ─────────────────────────────────────────────────────────
  const titleScale = spring({ frame, fps, config: { damping: 14, stiffness: 100 } });
  const titleOpacity = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: "clamp" });
  const titleExitOpacity = interpolate(frame, [40, 65], [1, 0], { extrapolateRight: "clamp" });

  const subtitleOpacity = interpolate(frame, [12, 32], [0, 1], {
    easing: Easing.out(Easing.cubic),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  }) * interpolate(frame, [40, 65], [1, 0], { extrapolateRight: "clamp" });

  // ── Top HUD bar ───────────────────────────────────────────────────────────
  const hudOpacity = interpolate(frame, [55, 80], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  // ── Results glow pulse ────────────────────────────────────────────────────
  const resultsPulse = frame >= 268 ? 0.5 + Math.sin((frame - 268) * 0.2) * 0.5 : 0;

  // ── Outro brand opacity ───────────────────────────────────────────────────
  const outroOpacity = interpolate(frame, [280, 295], [0, 1], {
    easing: Easing.out(Easing.cubic),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // ── Final fade to black ───────────────────────────────────────────────────
  const fadeOut = interpolate(frame, [293, 300], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // ── Step callout config ───────────────────────────────────────────────────
  const callouts: Array<{
    from: number; duration: number; step: number; title: string; subtitle: string;
  }> = [
    { from: 85,  duration: 55, step: 1, title: "切换到期权产品",  subtitle: "点击上方标签页切换模式" },
    { from: 148, duration: 65, step: 2, title: "填入交易参数",    subtitle: "输入标的价格、期权金等" },
    { from: 228, duration: 52, step: 3, title: "一键计算期望值",  subtitle: "点击按钮获取智能分析" },
    { from: 268, duration: 35, step: 4, title: "查看分析结果",    subtitle: "正数代表正期望，绿色胜率" },
  ];

  return (
    <AbsoluteFill style={{ background: "#050714", overflow: "hidden" }}>

      {/* ── Layer 0: Ambient background ── */}
      <GlowBlobs frame={frame} />
      <HUDGrid frame={frame} opacity={0.8} />
      <ParticleField frame={frame} />

      {/* ── Layer 1: Screenshot ── */}
      {showSS && (
        <ScreenshotViewer
          frame={frame}
          layers={[fromLayer, toLayer] as any}
          crossfadeStart={cfStart}
          crossfadeDuration={14}
          enterFrame={40}
          fps={fps}
        />
      )}

      {/* ── Layer 2: Results reveal effects ── */}
      {frame >= 268 && (
        <>
          {/* Scan reveal over results area */}
          <Sequence from={268} durationInFrames={32}>
            <ScanReveal frame={frame - 268} duration={28} y={FRAME_TOP} height={1000} />
          </Sequence>

          {/* Glow highlight on results section */}
          <div style={{
            position: "absolute",
            top: FRAME_TOP + 40,
            left: 60, right: 60,
            height: 700,
            border: "2px solid #10b98166",
            borderRadius: 24,
            boxShadow: `0 0 ${40 * resultsPulse}px #10b98144, 0 0 ${80 * resultsPulse}px #10b98122`,
            opacity: Math.min(1, (frame - 268) / 20),
            pointerEvents: "none",
          }} />
        </>
      )}

      {/* ── Layer 3: Click bursts ── */}
      {clickFrames.map((cf) => (
        <ClickBurst
          key={cf}
          frame={frame - cf}
          x={cursorKeyframes.find(k => k.frame === cf)?.x ?? 0}
          y={cursorKeyframes.find(k => k.frame === cf)?.y ?? 0}
          color={cf === 255 ? "#38bdf8" : "#6366f1"}
        />
      ))}

      {/* ── Layer 4: Animated cursor ── */}
      <AnimatedCursor
        frame={frame}
        fps={fps}
        keyframes={cursorKeyframes}
        clickFrames={clickFrames}
        visible={cursorVisible}
      />

      {/* ── Layer 5: HUD top bar ── */}
      <div style={{
        position: "absolute",
        top: 0, left: 0, right: 0,
        height: FRAME_TOP,
        opacity: hudOpacity,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(to bottom, #050714 60%, transparent)",
        gap: 16,
        zIndex: 10,
      }}>
        {/* Logo dot */}
        <div style={{
          width: 14, height: 14, borderRadius: "50%",
          background: "linear-gradient(135deg, #6366f1, #38bdf8)",
          boxShadow: "0 0 12px #6366f1",
        }} />
        <span style={{
          color: "#f1f5f9",
          fontSize: 32,
          fontWeight: 700,
          fontFamily: "sans-serif",
          letterSpacing: "0.08em",
        }}>
          EV Calculator
        </span>
        {/* URL pill */}
        <div style={{
          background: "rgba(99,102,241,0.15)",
          border: "1px solid rgba(99,102,241,0.3)",
          borderRadius: 999,
          padding: "4px 18px",
          color: "#818cf8",
          fontSize: 20,
          fontFamily: "monospace",
        }}>
          justyn.spailab.com
        </div>
      </div>

      {/* ── Layer 6: Opening title (frames 0-65) ── */}
      {frame < 65 && (
        <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", flexDirection: "column", gap: 24 }}>
          {/* Big glowing title */}
          <div style={{
            transform: `scale(${titleScale})`,
            opacity: titleOpacity * titleExitOpacity,
          }}>
            {/* Glow ring */}
            <div style={{
              position: "absolute",
              inset: -40,
              borderRadius: "50%",
              background: "radial-gradient(circle, #6366f144 0%, transparent 70%)",
            }} />
            <div style={{
              fontSize: 96,
              fontWeight: 900,
              fontFamily: "sans-serif",
              textAlign: "center",
              lineHeight: 1,
              background: "linear-gradient(135deg, #fff 0%, #818cf8 50%, #38bdf8 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              position: "relative",
            }}>
              EV
            </div>
            <div style={{
              fontSize: 44,
              fontWeight: 700,
              fontFamily: "sans-serif",
              color: "#94a3b8",
              textAlign: "center",
              letterSpacing: "0.2em",
              marginTop: 8,
              position: "relative",
            }}>
              CALCULATOR
            </div>
          </div>

          {/* Subtitle */}
          <div style={{
            opacity: subtitleOpacity,
            color: "#64748b",
            fontSize: 28,
            fontFamily: "sans-serif",
            letterSpacing: "0.12em",
          }}>
            期权交易 · 智能分析 · 期望值计算
          </div>

          {/* Decorative horizontal line */}
          <div style={{
            width: interpolate(frame, [8, 35], [0, 400], { extrapolateRight: "clamp" }),
            height: 1,
            background: "linear-gradient(to right, transparent, #6366f1, transparent)",
            opacity: subtitleOpacity,
          }} />
        </AbsoluteFill>
      )}

      {/* ── Layer 7: Step callouts ── */}
      {callouts.map(({ from, duration, step, title, subtitle }) => (
        <Sequence key={step} from={from} durationInFrames={duration}>
          <StepCallout
            frame={frame - from}
            fps={fps}
            step={step}
            title={title}
            subtitle={subtitle}
            totalDuration={duration}
          />
        </Sequence>
      ))}

      {/* ── Layer 8: Outro brand card ── */}
      {frame >= 278 && (
        <div style={{
          position: "absolute",
          bottom: 80,
          left: 60, right: 60,
          opacity: outroOpacity,
          background: "rgba(6,10,28,0.92)",
          backdropFilter: "blur(24px)",
          border: "1px solid rgba(99,102,241,0.35)",
          borderRadius: 28,
          padding: "32px 40px",
          textAlign: "center",
          boxShadow: "0 8px 60px rgba(99,102,241,0.25)",
        }}>
          <div style={{
            fontSize: 28,
            color: "#94a3b8",
            fontFamily: "sans-serif",
            marginBottom: 8,
          }}>立即使用</div>
          <div style={{
            fontSize: 36,
            fontWeight: 700,
            color: "#f1f5f9",
            fontFamily: "monospace",
          }}>justyn.spailab.com</div>
          <div style={{
            marginTop: 12,
            fontSize: 22,
            color: "#6366f1",
            fontFamily: "sans-serif",
          }}>期权交易期望值计算器</div>
        </div>
      )}

      {/* ── Fade to black ── */}
      <div style={{
        position: "absolute",
        inset: 0,
        background: "#000",
        opacity: fadeOut,
        pointerEvents: "none",
      }} />
    </AbsoluteFill>
  );
};
