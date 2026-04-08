import React from "react";
import { Composition } from "remotion";
import { SignalPlusLoading } from "./compositions/SignalPlusLoading";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      {/* SignalPlus Lottie-style loading animation — 3s seamless loop, 400×400 */}
      <Composition
        id="SignalPlusLoading"
        component={SignalPlusLoading}
        durationInFrames={90}
        fps={30}
        width={400}
        height={400}
      />
    </>
  );
};
