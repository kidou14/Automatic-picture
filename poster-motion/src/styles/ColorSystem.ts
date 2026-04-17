import { Palette } from '../types/BannerConfig';

// ── Primitive color utilities ────────────────────────────────────────────────
// Ported from Auto-banner-OneClick/scripts/screenshot-server.js lines 198-510

export function hslToHex(h: number, s: number, l: number): string {
  s /= 100; l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) }
    : { r: 0, g: 0, b: 0 };
}

function luminance({ r, g, b }: { r: number; g: number; b: number }): number {
  const toLinear = (c: number) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

export function isDark(hex: string): boolean {
  return luminance(hexToRgb(hex)) < 0.35;
}

/** Mulberry32 seeded PRNG */
export function createRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s += 0x6D2B79F5;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** FNV-1a hash — converts string seed to a uint32 */
function hashSeed(seed: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h || 1;
}

// ── Palette generation ───────────────────────────────────────────────────────

/**
 * Generate a Palette from a string seed using HSL color-harmony theory.
 * Deterministic: same seed → same palette.
 */
export function generatePalette(seed: string): Palette {
  const rng = createRng(hashSeed(seed));
  const pick = <T>(arr: T[]): T => arr[Math.floor(rng() * arr.length)];
  const rand = (min: number, max: number) => min + rng() * (max - min);
  const randInt = (min: number, max: number) => Math.floor(rand(min, max));

  // ── Color harmony ────────────────────────────────────────────────────────
  const baseHue = randInt(0, 360);
  const harmony = pick(['complementary', 'triadic', 'analogous', 'split-complementary', 'monochromatic']);
  const colorMode = pick(['light', 'light', 'dark', 'dark', 'warm-light', 'cool-dark', 'earthy', 'neon-dark']);

  let bgHue = baseHue;
  let accentHue = baseHue;
  let accent2Hue = baseHue;

  switch (harmony) {
    case 'complementary':
      accentHue = (baseHue + 180) % 360;
      accent2Hue = (baseHue + 200) % 360;
      break;
    case 'triadic':
      accentHue = (baseHue + 120) % 360;
      accent2Hue = (baseHue + 240) % 360;
      break;
    case 'analogous':
      accentHue = (baseHue + 30) % 360;
      accent2Hue = (baseHue + 60) % 360;
      break;
    case 'split-complementary':
      accentHue = (baseHue + 150) % 360;
      accent2Hue = (baseHue + 210) % 360;
      break;
    case 'monochromatic':
      accentHue = baseHue;
      accent2Hue = baseHue;
      break;
  }

  let bgL: number, bgS: number, accentS: number, accentL: number, textHex: string, bgGradientShift: number;

  switch (colorMode) {
    case 'light':
      bgL = randInt(95, 98); bgS = randInt(0, 6);
      accentS = randInt(0, 15); accentL = randInt(8, 18);
      textHex = hslToHex(baseHue, randInt(5, 15), randInt(8, 14));
      bgGradientShift = randInt(-3, 3);
      break;
    case 'dark':
      bgL = randInt(4, 10); bgS = randInt(5, 15);
      accentS = randInt(82, 100); accentL = randInt(60, 72);
      textHex = hslToHex(baseHue, randInt(5, 12), randInt(90, 97));
      bgGradientShift = randInt(-8, 8);
      break;
    case 'warm-light':
      bgHue = randInt(15, 28);
      accentHue = (bgHue + randInt(35, 55)) % 360;
      accent2Hue = (bgHue + randInt(55, 85)) % 360;
      bgL = randInt(82, 90); bgS = randInt(45, 65);
      accentS = randInt(65, 88); accentL = randInt(48, 62);
      textHex = hslToHex(randInt(18, 32), randInt(45, 62), randInt(18, 28));
      bgGradientShift = randInt(-45, -28);
      break;
    case 'cool-dark':
      bgHue = randInt(208, 225);
      accentHue = randInt(170, 195);
      accent2Hue = randInt(185, 210);
      bgL = randInt(8, 16); bgS = randInt(35, 55);
      accentS = randInt(75, 95); accentL = randInt(55, 70);
      textHex = hslToHex(accentHue, randInt(72, 88), randInt(65, 78));
      bgGradientShift = randInt(-25, -10);
      break;
    case 'earthy':
      bgHue = randInt(80, 115);
      accentHue = randInt(100, 135);
      accent2Hue = randInt(65, 95);
      bgL = randInt(91, 96); bgS = randInt(18, 35);
      accentS = randInt(50, 72); accentL = randInt(28, 45);
      textHex = hslToHex(randInt(22, 35), randInt(22, 38), randInt(10, 18));
      bgGradientShift = randInt(10, 22);
      break;
    case 'neon-dark':
      bgHue = randInt(138, 162);
      accentHue = randInt(118, 148);
      accent2Hue = randInt(148, 178);
      bgL = randInt(3, 8); bgS = randInt(18, 32);
      accentS = randInt(88, 100); accentL = randInt(62, 72);
      textHex = hslToHex(accentHue, randInt(88, 100), randInt(65, 75));
      bgGradientShift = randInt(-8, 8);
      break;
    default:
      bgL = randInt(90, 96); bgS = randInt(10, 25);
      accentS = randInt(55, 80); accentL = randInt(42, 58);
      textHex = hslToHex(baseHue, 20, 12);
      bgGradientShift = 0;
  }

  const bgHex = hslToHex(bgHue, bgS, bgL);
  const bgEndHex = hslToHex(
    (bgHue + bgGradientShift + 360) % 360,
    bgS + randInt(3, 10),
    bgL - randInt(3, 8),
  );
  const accentHex = hslToHex(accentHue, accentS, accentL);
  const accent2Hex = hslToHex(accent2Hue, Math.max(30, accentS - randInt(5, 20)), accentL + randInt(-8, 15));

  const dark = isDark(bgHex);
  const textRgb = hexToRgb(textHex);
  const accentRgb = hexToRgb(accentHex);
  const accent2Rgb = hexToRgb(accent2Hex);

  const palette: Palette = {
    bg: bgHex,
    bgEnd: bgEndHex,
    accent: accentHex,
    accent2: accent2Hex,
    text: textHex,
    muted: dark
      ? `rgba(${textRgb.r},${textRgb.g},${textRgb.b},0.65)`
      : `rgba(${textRgb.r},${textRgb.g},${textRgb.b},0.68)`,
    card: dark
      ? `rgba(255,255,255,${(0.06 + rng() * 0.06).toFixed(2)})`
      : `rgba(255,255,255,${(0.22 + rng() * 0.14).toFixed(2)})`,
    shadow: dark
      ? `rgba(0,0,0,${(0.4 + rng() * 0.2).toFixed(2)})`
      : `rgba(${Math.floor(textRgb.r * 0.6)},${Math.floor(textRgb.g * 0.6)},${Math.floor(textRgb.b * 0.6)},${(0.15 + rng() * 0.1).toFixed(2)})`,
  };

  // Per-mode overrides
  if (colorMode === 'light') {
    palette.card = `rgba(255,255,255,${(0.55 + rng() * 0.20).toFixed(2)})`;
  } else if (colorMode === 'neon-dark') {
    palette.card = `rgba(${accentRgb.r},${accentRgb.g},${accentRgb.b},${(0.08 + rng() * 0.06).toFixed(2)})`;
  } else if (colorMode === 'earthy') {
    const bgRgb = hexToRgb(bgHex);
    palette.card = `rgba(${bgRgb.r},${bgRgb.g},${bgRgb.b},${(0.42 + rng() * 0.18).toFixed(2)})`;
  }

  // Suppress unused vars — accent2Rgb used in potential future glow
  void accent2Rgb;

  return palette;
}
