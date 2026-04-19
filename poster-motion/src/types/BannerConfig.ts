import React from 'react';

// ─── Color palette ────────────────────────────────────────────────────────────

export interface Palette {
  bg: string;       // background base color
  bgEnd: string;    // gradient end color
  accent: string;   // primary accent
  accent2: string;  // secondary accent
  text: string;     // headline text color
  muted: string;    // secondary text (rgba)
  card: string;     // card / glass overlay (rgba)
  shadow: string;   // shadow color (rgba)
}

// ─── Dimension keys ───────────────────────────────────────────────────────────

export interface BannerDimensions {
  background: string;  // 'gradient' | 'blocks' | ...
  textEffect: string;  // 'static' | 'fade' | ...
  entrance: string;    // 'fadeSlideUp' | 'scaleIn' | ...
  layout: string;      // 'titleTop' | 'titleBottom' | ...
}

// ─── Adjustable parameters (per-dimension overrides) ─────────────────────────

export interface BannerParams {
  /** Mockup / phone frame controls */
  mockup?: {
    scale?: number;
    [key: string]: number | undefined;
  };
  /** Text effect controls (used by Stage 2 text components) */
  text?: {
    fontSize?: number;
    letterSpacing?: number;
    speed?: number;
    [key: string]: number | undefined;
  };
  /** Background effect controls (used by Stage 3 bg components) */
  bg?: {
    [key: string]: number | undefined;
  };
  /** Global controls that map to top-level BannerConfig fields */
  global?: {
    textScale?: number;
    [key: string]: number | undefined;
  };
}

// ─── Main config ─────────────────────────────────────────────────────────────

export interface BannerConfig {
  /** HTTP URL of the uploaded image (served locally by Express) */
  imageUrl: string;
  /** HTTP URL of the phone mockup frame PNG */
  mockupUrl: string;
  /** Headline text */
  title: string;
  /** One selected option per dimension */
  dimensions: BannerDimensions;
  /** Generated color palette */
  palette: Palette;
  /** Canvas width in px (App Store 5.5") */
  width: number;
  /** Canvas height in px */
  height: number;
  /** Reproducible seed string */
  seed: string;
  /** Optional uniform text scale multiplier (default 1.0) */
  textScale?: number;
  /** Per-dimension parameter overrides (sliders, knobs, etc.) */
  params?: BannerParams;
}

// ─── Dimension component props ────────────────────────────────────────────────

export interface DimensionProps {
  frame: number;
  fps: number;
  palette: Palette;
  config: BannerConfig;
}

/** Entrance components wrap children and apply an animated container */
export interface EntranceDimensionProps extends DimensionProps {
  children: React.ReactNode;
}
