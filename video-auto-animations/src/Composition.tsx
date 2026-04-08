import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";

interface MyCompositionProps {
  titleText: string;
  titleColor: string;
}

export const MyComposition: React.FC<MyCompositionProps> = ({ titleText, titleColor }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const opacity = interpolate(frame, [0, 30], [0, 1], { extrapolateRight: "clamp" });

  const scale = spring({
    frame,
    fps,
    config: { damping: 200, stiffness: 200, mass: 0.5 },
  });

  return (
    <AbsoluteFill
      style={{
        background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <div
        style={{
          opacity,
          transform: `scale(${scale})`,
          color: titleColor,
          fontSize: 80,
          fontWeight: 800,
          fontFamily: "sans-serif",
          textAlign: "center",
          padding: "0 60px",
          lineHeight: 1.2,
        }}
      >
        {titleText}
      </div>
    </AbsoluteFill>
  );
};
