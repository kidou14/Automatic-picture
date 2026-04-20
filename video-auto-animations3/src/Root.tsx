import React from "react";
import { Composition } from "remotion";
import { MockupPromo, MockupPromoProps } from "./compositions/MockupPromo";

const DEFAULT_SCRIPT = {
  product_name: "Your Product",
  tagline: "See what it can do",
  accent_color: "#6366f1",
  screen_video_url: "",
  style_seed: "preview",
  scenes: [
    { type: "intro" as const, duration: 120, title: "Your Product", subtitle: "See what it can do", video_start_ms: 0 },
    { type: "outro" as const, duration: 100, cta: "Try Your Product" },
  ],
};

export const Root: React.FC = () => {
  return (
    <>
      <Composition
        id="MockupPromo"
        component={MockupPromo}
        durationInFrames={220}
        fps={60}
        width={1080}
        height={1920}
        defaultProps={{ script: DEFAULT_SCRIPT } as MockupPromoProps}
        calculateMetadata={async ({ props }) => {
          const total = (props.script?.scenes ?? []).reduce(
            (acc: number, s: { duration: number }) => acc + s.duration,
            0
          );
          return { durationInFrames: total || 220 };
        }}
      />
    </>
  );
};
