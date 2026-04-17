// CommonJS — color palette + BannerConfig generation
// Palette generation: Claude AI (primary) → algorithmic fallback

'use strict';

const Anthropic = require('@anthropic-ai/sdk');

// ── Primitives ────────────────────────────────────────────────────────────────

function hslToHex(h, s, l) {
  s /= 100; l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    const channel = Math.max(0, Math.min(255, Math.round(255 * color)));
    return channel.toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) }
    : { r: 0, g: 0, b: 0 };
}

function luminance({ r, g, b }) {
  const toLinear = (c) => { const v = c / 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

function isDark(hex) { return luminance(hexToRgb(hex)) < 0.35; }

function contrastRatio(hex1, hex2) {
  const l1 = luminance(hexToRgb(hex1));
  const l2 = luminance(hexToRgb(hex2));
  const lighter = Math.max(l1, l2);
  const darker  = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

function createRng(seed) {
  let s = seed >>> 0;
  return () => {
    s += 0x6D2B79F5;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashSeed(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h || 1;
}

// ── Style vocabulary for AI prompts ──────────────────────────────────────────
// 20 design aesthetics; RNG picks 2 per seed → deterministic style hint

const STYLE_POOL = [
  'midnight luxury',
  'neon cyberpunk',
  'soft aurora borealis',
  'golden hour warmth',
  'deep ocean abyss',
  'frosted glass minimal',
  'ember glow dark',
  'arctic ice blue',
  'tropical vivid pop',
  'dark editorial fashion',
  'pastel dreamscape',
  'electric violet futurism',
  'rich jewel tones',
  'monochrome ink',
  'sunset gradient warm',
  'forest earthy organic',
  'rose gold premium',
  'galaxy cosmic dark',
  'clean tech white',
  'retro synthwave',
];

// ── Derive rgba tokens from hex values ───────────────────────────────────────
// Called after AI returns the 5 core hex colours

function buildRgbaTokens(palette, rng) {
  const dark     = isDark(palette.bg);
  const textRgb  = hexToRgb(palette.text);
  const accentRgb = hexToRgb(palette.accent);
  const bgRgb    = hexToRgb(palette.bg);

  palette.muted = dark
    ? `rgba(${textRgb.r},${textRgb.g},${textRgb.b},0.65)`
    : `rgba(${textRgb.r},${textRgb.g},${textRgb.b},0.68)`;

  palette.card = dark
    ? `rgba(255,255,255,${(0.06 + rng() * 0.06).toFixed(2)})`
    : `rgba(255,255,255,${(0.22 + rng() * 0.14).toFixed(2)})`;

  palette.shadow = dark
    ? `rgba(0,0,0,${(0.4 + rng() * 0.2).toFixed(2)})`
    : `rgba(${Math.floor(textRgb.r * 0.6)},${Math.floor(textRgb.g * 0.6)},${Math.floor(textRgb.b * 0.6)},${(0.15 + rng() * 0.1).toFixed(2)})`;

  // Per-aesthetic overrides
  const bgIsDark = isDark(palette.bg);
  if (!bgIsDark && contrastRatio(palette.text, palette.bg) < 3) {
    // Light bg with low contrast accent → use neon-style card tint
    palette.card = `rgba(${accentRgb.r},${accentRgb.g},${accentRgb.b},${(0.10 + rng() * 0.06).toFixed(2)})`;
  }
  if (bgIsDark && isDark(palette.accent)) {
    // Very dark accent on dark bg → brighten card
    palette.card = `rgba(255,255,255,${(0.10 + rng() * 0.06).toFixed(2)})`;
  }

  // Earthy / warm bg: use bg-tinted card
  const bgHue = hexToRgb(palette.bg);
  if (bgHue.r > bgHue.b + 20 && !bgIsDark) {
    palette.card = `rgba(${bgRgb.r},${bgRgb.g},${bgRgb.b},${(0.42 + rng() * 0.18).toFixed(2)})`;
  }

  return palette;
}

// ── Palette validation ────────────────────────────────────────────────────────

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

function isValidPalette(obj) {
  if (!obj || typeof obj !== 'object') return false;
  for (const key of ['bg', 'bgEnd', 'accent', 'accent2', 'text']) {
    if (!HEX_RE.test(obj[key])) return false;
  }
  return true;
}

// ── In-memory palette cache (seed → Palette) ──────────────────────────────────

const paletteCache = new Map();

// ── AI palette generation ─────────────────────────────────────────────────────

let anthropicClient = null;
function getClient() {
  if (!anthropicClient) {
    const key = process.env.ANTHROPIC_API_KEY;
    if (!key) return null;
    anthropicClient = new Anthropic({ apiKey: key });
  }
  return anthropicClient;
}

async function generatePaletteWithAI(seed, title) {
  // Cache hit
  if (paletteCache.has(seed)) return paletteCache.get(seed);

  const client = getClient();
  if (!client) {
    console.warn('[colorGen] ANTHROPIC_API_KEY not set — using algorithmic palette');
    return null;
  }

  // Pick 2 style words deterministically from seed
  const rng   = createRng(hashSeed(seed));
  const pick  = (arr) => arr[Math.floor(rng() * arr.length)];
  const style = `${pick(STYLE_POOL)} meets ${pick(STYLE_POOL)}`;

  const systemPrompt = `You are a world-class advertising creative director specialising in App Store banner design.
Your task: generate a 5-colour palette for a mobile app promotional poster.

Rules:
- Return ONLY a JSON object, no markdown, no explanation.
- Exactly these 5 keys: bg, bgEnd, accent, accent2, text
- All values must be lowercase hex strings like "#1a2b3c"
- bg/bgEnd are the background gradient start and end colours
- accent is the primary highlight/glow colour (vibrant, eye-catching)
- accent2 is a secondary complementary highlight
- text is the headline text colour (must have contrast ratio ≥ 4.5 against bg)
- The palette should feel premium, intentional, and gallery-quality`;

  const userPrompt = `Design aesthetic: "${style}"
App title hint: "${title}"

Generate a stunning palette that embodies this aesthetic perfectly.`;

  try {
    const response = await client.messages.create({
      model:      'claude-haiku-4-5-20251001',
      max_tokens: 200,
      system:     systemPrompt,
      messages:   [{ role: 'user', content: userPrompt }],
    });

    const raw = response.content[0].text.trim();
    // Strip accidental markdown fences
    const jsonStr = raw.replace(/^```[a-z]*\n?/i, '').replace(/\n?```$/i, '').trim();
    const parsed  = JSON.parse(jsonStr);

    if (!isValidPalette(parsed)) {
      console.warn('[colorGen] AI returned invalid palette, falling back:', parsed);
      return null;
    }

    // Ensure minimum text contrast
    if (contrastRatio(parsed.text, parsed.bg) < 3.5) {
      parsed.text = isDark(parsed.bg) ? '#f0f0f0' : '#111111';
    }

    // Build full palette with rgba tokens
    const fullRng = createRng(hashSeed(seed + '-rgba'));
    const palette = buildRgbaTokens({ ...parsed }, fullRng);

    console.log(`[colorGen] AI palette for "${style}" → bg:${palette.bg} accent:${palette.accent}`);

    paletteCache.set(seed, palette);
    return palette;
  } catch (err) {
    console.warn('[colorGen] AI palette call failed, falling back:', err.message);
    return null;
  }
}

// ── Algorithmic fallback palette ──────────────────────────────────────────────

function generatePaletteFallback(rng) {
  const pick = (arr) => arr[Math.floor(rng() * arr.length)];
  const rand = (min, max) => min + rng() * (max - min);
  const randInt = (min, max) => Math.floor(rand(min, max));

  const baseHue = randInt(0, 360);
  const harmony = pick(['complementary', 'triadic', 'analogous', 'split-complementary', 'monochromatic']);
  const colorMode = pick(['light', 'light', 'dark', 'dark', 'warm-light', 'cool-dark', 'earthy', 'neon-dark']);

  let bgHue = baseHue, accentHue = baseHue, accent2Hue = baseHue;

  switch (harmony) {
    case 'complementary':        accentHue = (baseHue + 180) % 360; accent2Hue = (baseHue + 200) % 360; break;
    case 'triadic':              accentHue = (baseHue + 120) % 360; accent2Hue = (baseHue + 240) % 360; break;
    case 'analogous':            accentHue = (baseHue + 30)  % 360; accent2Hue = (baseHue + 60)  % 360; break;
    case 'split-complementary':  accentHue = (baseHue + 150) % 360; accent2Hue = (baseHue + 210) % 360; break;
    case 'monochromatic': break;
  }

  let bgL, bgS, accentS, accentL, textHex, bgGradientShift;

  switch (colorMode) {
    case 'light':
      bgL = randInt(95, 98); bgS = randInt(0, 6);
      accentS = randInt(0, 15); accentL = randInt(8, 18);
      textHex = hslToHex(baseHue, randInt(5, 15), randInt(8, 14));
      bgGradientShift = randInt(-3, 3); break;
    case 'dark':
      bgL = randInt(4, 10); bgS = randInt(5, 15);
      accentS = randInt(82, 100); accentL = randInt(60, 72);
      textHex = hslToHex(baseHue, randInt(5, 12), randInt(90, 97));
      bgGradientShift = randInt(-8, 8); break;
    case 'warm-light':
      bgHue = randInt(15, 28); accentHue = (bgHue + randInt(35, 55)) % 360; accent2Hue = (bgHue + randInt(55, 85)) % 360;
      bgL = randInt(82, 90); bgS = randInt(45, 65);
      accentS = randInt(65, 88); accentL = randInt(48, 62);
      textHex = hslToHex(randInt(18, 32), randInt(45, 62), randInt(18, 28));
      bgGradientShift = randInt(-45, -28); break;
    case 'cool-dark':
      bgHue = randInt(208, 225); accentHue = randInt(170, 195); accent2Hue = randInt(185, 210);
      bgL = randInt(8, 16); bgS = randInt(35, 55);
      accentS = randInt(75, 95); accentL = randInt(55, 70);
      textHex = hslToHex(accentHue, randInt(72, 88), randInt(65, 78));
      bgGradientShift = randInt(-25, -10); break;
    case 'earthy':
      bgHue = randInt(80, 115); accentHue = randInt(100, 135); accent2Hue = randInt(65, 95);
      bgL = randInt(91, 96); bgS = randInt(18, 35);
      accentS = randInt(50, 72); accentL = randInt(28, 45);
      textHex = hslToHex(randInt(22, 35), randInt(22, 38), randInt(10, 18));
      bgGradientShift = randInt(10, 22); break;
    case 'neon-dark':
      bgHue = randInt(138, 162); accentHue = randInt(118, 148); accent2Hue = randInt(148, 178);
      bgL = randInt(3, 8); bgS = randInt(18, 32);
      accentS = randInt(88, 100); accentL = randInt(62, 72);
      textHex = hslToHex(accentHue, randInt(88, 100), randInt(65, 75));
      bgGradientShift = randInt(-8, 8); break;
    default:
      bgL = randInt(90, 96); bgS = randInt(10, 25);
      accentS = randInt(55, 80); accentL = randInt(42, 58);
      textHex = hslToHex(baseHue, 20, 12); bgGradientShift = 0;
  }

  const bgHex      = hslToHex(bgHue, bgS, bgL);
  const bgEndHex   = hslToHex((bgHue + bgGradientShift + 360) % 360, bgS + randInt(3, 10), bgL - randInt(3, 8));
  const accentHex  = hslToHex(accentHue, accentS, accentL);
  const accent2Hex = hslToHex(accent2Hue, Math.max(30, accentS - randInt(5, 20)), accentL + randInt(-8, 15));
  const dark       = isDark(bgHex);
  const textRgb    = hexToRgb(textHex);
  const accentRgb  = hexToRgb(accentHex);

  const palette = {
    bg: bgHex, bgEnd: bgEndHex, accent: accentHex, accent2: accent2Hex, text: textHex,
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

  if (colorMode === 'light') {
    palette.card = `rgba(255,255,255,${(0.55 + rng() * 0.20).toFixed(2)})`;
  } else if (colorMode === 'neon-dark') {
    palette.card = `rgba(${accentRgb.r},${accentRgb.g},${accentRgb.b},${(0.08 + rng() * 0.06).toFixed(2)})`;
  } else if (colorMode === 'earthy') {
    const bgRgb = hexToRgb(bgHex);
    palette.card = `rgba(${bgRgb.r},${bgRgb.g},${bgRgb.b},${(0.42 + rng() * 0.18).toFixed(2)})`;
  }

  return palette;
}

// ── Config generation ─────────────────────────────────────────────────────────

const DIMENSION_OPTIONS = {
  background: ['gradient', 'blocks', 'aurora', 'balatro', 'ballpit', 'beams',
               'dotField', 'dotGrid', 'waves', 'silk', 'threads', 'lineWaves', 'rippleGrid', 'galaxy'],
  textEffect: ['splitText', 'blurText', 'circularText', 'textType', 'shuffleText', 'gradientText', 'shinyText'],
  decoration: ['circles', 'lines', 'glowRing', 'circularText'],
  entrance:   ['fadeSlideUp', 'scaleIn', 'floatIn', 'blurIn'],
  layout:     ['titleTop', 'titleBottom'],
};

/**
 * @param {{ seed: string, imageUrl: string, mockupUrl: string, title?: string, dimensions?: object }} opts
 * @returns {Promise<BannerConfig>}
 */
async function generateBannerConfig({ seed, imageUrl, mockupUrl, title = '全新体验', dimensions }) {
  const rng  = createRng(hashSeed(seed));
  const pick = (arr) => arr[Math.floor(rng() * arr.length)];

  // Try AI palette first; fall back to algorithmic if unavailable / failed
  let palette = await generatePaletteWithAI(seed, title);
  if (!palette) {
    palette = generatePaletteFallback(rng);
  }

  const resolvedDimensions = {
    background: dimensions?.background || pick(DIMENSION_OPTIONS.background),
    textEffect: dimensions?.textEffect || pick(DIMENSION_OPTIONS.textEffect),
    decoration: dimensions?.decoration || pick(DIMENSION_OPTIONS.decoration),
    entrance:   dimensions?.entrance   || pick(DIMENSION_OPTIONS.entrance),
    layout:     dimensions?.layout     || pick(DIMENSION_OPTIONS.layout),
  };

  return {
    imageUrl,
    mockupUrl,
    title,
    dimensions: resolvedDimensions,
    palette,
    width: 1080,
    height: 1920,
    seed,
  };
}

module.exports = { generateBannerConfig };
