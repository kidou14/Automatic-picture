#!/usr/bin/env node
/**
 * screenshot-server.js — OneClick screenshot server with Style Recipe Engine
 *
 * Endpoints:
 *   GET  /health
 *   GET  /api/preview?url=<url>
 *   POST /api/oneclick-capture         — full pipeline: capture → recipe → job
 *   GET  /api/capture-jobs/:jobId
 *   POST /api/render-exports
 *   GET  /assets/iphone-mockup.png
 */

const http = require("http");
const fs = require("fs");
const os = require("os");
const path = require("path");
const crypto = require("crypto");
const { URL } = require("url");

loadLocalEnv();

const PORT = Number.parseInt(process.env.PORT || "4318", 10);
const ANTHROPIC_API_URL = process.env.ANTHROPIC_API_URL || "https://api.anthropic.com/v1/messages";
const ANTHROPIC_API_KEY = String(process.env.ANTHROPIC_API_KEY || "").trim();
const ANTHROPIC_MODEL = String(process.env.ANTHROPIC_MODEL || "claude-sonnet-4-20250514").trim();
const OPENAI_API_KEY = String(process.env.OPENAI_API_KEY || "").trim();
const DASHSCOPE_API_KEY = String(process.env.DASHSCOPE_API_KEY || "").trim();
const MOBILE_VIEWPORT = { width: 390, height: 844 };
const DEVICE_SCALE = 3;
const USER_AGENT =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
const CAPTURE_WAIT_MS = Number.parseInt(process.env.CAPTURE_WAIT_MS || "1200", 10);
const APP_LOGO_PAGE_TIMEOUT_MS = Number.parseInt(process.env.APP_LOGO_PAGE_TIMEOUT_MS || "8000", 10);
const APP_LOGO_AI_TIMEOUT_MS = Number.parseInt(process.env.APP_LOGO_AI_TIMEOUT_MS || "15000", 10);
const DALLE_LOGO_AI_TIMEOUT_MS = Number.parseInt(process.env.DALLE_LOGO_AI_TIMEOUT_MS || "50000", 10);
const CACHE_TTL_MS = 1000 * 60 * 5;
const JOB_TTL_MS = 1000 * 60 * 30;
const EXPORT_OUTPUT_DIR = String(
  process.env.EXPORT_OUTPUT_DIR ||
    path.join(os.homedir(), "Downloads", "appstore-auto-screenshots-oneclick")
).trim();
const PHONE_MOCKUP_PATH = path.resolve(
  __dirname, "..", "..", "app-store-screenshots-main", "skills", "app-store-screenshots", "mockup.png"
);
const SYSTEM_BROWSER_CANDIDATES = [
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
];

let browserPromise = null;
const responseCache = new Map();
const inflightRequests = new Map();
const captureJobs = new Map();

// ─── Env loader ─────────────────────────────────────────────────────────────

function loadLocalEnv() {
  const candidates = [
    path.resolve(process.cwd(), ".env.local"),
    path.resolve(__dirname, "..", ".env.local"),
    path.resolve(__dirname, "..", "..", ".env.local"),
  ];
  for (const filePath of candidates) {
    if (!fs.existsSync(filePath)) continue;
    const source = fs.readFileSync(filePath, "utf8");
    source.split(/\r?\n/).forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) return;
      const sep = trimmed.indexOf("=");
      if (sep <= 0) return;
      const key = trimmed.slice(0, sep).trim();
      if (!key || process.env[key]) return;
      let value = trimmed.slice(sep + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      process.env[key] = value;
    });
    return;
  }
}

// ─── HTTP helpers ────────────────────────────────────────────────────────────

function setCorsHeaders(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function sendJson(res, statusCode, payload) {
  setCorsHeaders(res);
  res.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

function sendStaticFile(res, filePath, contentType) {
  if (!fs.existsSync(filePath)) {
    sendJson(res, 404, { error: "Asset not found" });
    return;
  }
  setCorsHeaders(res);
  const isHtml = contentType.includes("text/html");
  res.writeHead(200, {
    "Content-Type": contentType,
    "Cache-Control": "no-cache",
  });
  fs.createReadStream(filePath).pipe(res);
}

function readRequestBody(req, maxBytes = 1_000_000) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > maxBytes) { reject(new Error("Request body too large")); req.destroy(); }
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

// ─── File helpers ─────────────────────────────────────────────────────────────

function ensureDirectory(dir) { fs.mkdirSync(dir, { recursive: true }); return dir; }

function sanitizeFilename(value, fallback = "export.png") {
  const safe = String(value || "").trim().replace(/[/\\?%*:|"<>]/g, "-").replace(/\s+/g, " ").trim();
  return safe || fallback;
}

function buildUniqueFilePath(targetDir, filename) {
  const parsed = path.parse(sanitizeFilename(filename));
  const ext = parsed.ext || ".png";
  const baseName = parsed.name || "export";
  let attempt = 0;
  while (true) {
    const candidateName = attempt === 0 ? `${baseName}${ext}` : `${baseName}-${attempt + 1}${ext}`;
    const candidatePath = path.join(targetDir, candidateName);
    if (!fs.existsSync(candidatePath)) return { filename: candidateName, filePath: candidatePath };
    attempt++;
  }
}

function buildUniqueDirectory(baseDir, requestedName) {
  const safeName = sanitizeFilename(requestedName, "export-batch").replace(/\.[a-z0-9]+$/i, "");
  let attempt = 0;
  while (true) {
    const candidateName = attempt === 0 ? safeName : `${safeName}-${attempt + 1}`;
    const candidatePath = path.join(baseDir, candidateName);
    if (!fs.existsSync(candidatePath)) { fs.mkdirSync(candidatePath, { recursive: true }); return candidatePath; }
    attempt++;
  }
}

function decodeImageDataUrl(imageDataUrl) {
  const match = String(imageDataUrl || "").trim().match(/^data:image\/png;base64,(.+)$/);
  if (!match) throw new Error("Only PNG data URLs are supported");
  return Buffer.from(match[1], "base64");
}

// ─── Job helpers ──────────────────────────────────────────────────────────────

function createJobId() {
  return `job_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function pushJobEvent(job, type, message) {
  job.events.push({ type, message, ts: Date.now() });
  if (job.events.length > 300) job.events.shift();
  job.updatedAt = new Date().toISOString();
}

function serializeJob(job) {
  return {
    id: job.id,
    status: job.status,
    total: job.total,
    completed: job.completed,
    events: job.events,
    screenshots: job.screenshots,
    recipe: job.recipe || null,
    error: job.error || null,
    updatedAt: job.updatedAt,
  };
}

function cleanupExpiredJobs() {
  const now = Date.now();
  for (const [id, job] of captureJobs) {
    if (job.expiresAt && job.expiresAt < now) captureJobs.delete(id);
  }
}

// ─── Style Recipe Engine ──────────────────────────────────────────────────────

/**
 * Convert HSL to hex color string.
 * h: 0-360, s: 0-100, l: 0-100
 */
function hslToHex(h, s, l) {
  s /= 100; l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

/** Parse hex to {r,g,b} */
function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) }
    : { r: 0, g: 0, b: 0 };
}

/** Compute relative luminance */
function luminance({ r, g, b }) {
  const toLinear = (c) => { const v = c / 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

/** Check if a color is "dark" (luminance < 0.35) */
function isDark(hex) { return luminance(hexToRgb(hex)) < 0.35; }

/** Convert hex color to HSL hue (0–359), returns null if achromatic */
function hexToHue(hex) {
  const { r, g, b } = hexToRgb(hex);
  const rn = r / 255, gn = g / 255, bn = b / 255;
  const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn);
  if (max - min < 0.08) return null; // too gray/achromatic
  let h;
  if (max === rn) h = ((gn - bn) / (max - min) + 6) % 6 * 60;
  else if (max === gn) h = ((bn - rn) / (max - min) + 2) * 60;
  else h = ((rn - gn) / (max - min) + 4) * 60;
  return Math.round(h);
}

/** Seeded pseudo-random number generator (mulberry32) */
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

const MOOD_NAMES = [
  "Arctic Dawn", "Neon Pulse", "Terracotta", "Midnight Bloom", "Solar Flare",
  "Sage Breeze", "Deep Ocean", "Amber Haze", "Cosmic Dust", "Mint Forest",
  "Crimson Dusk", "Lavender Mist", "Golden Hour", "Obsidian", "Coral Reef",
  "Autumn Ember", "Electric Jade", "Rose Quartz", "Steel Blue", "Citrus Pop",
  "Plum Twilight", "Desert Sand", "Aqua Neon", "Bronze Age", "Pearl White",
  "Volcanic", "Tundra", "Papaya Fizz", "Night Garden", "Glacier",
];

const FONT_PAIRINGS = [
  // 中文经典：思源黑体（Noto Sans SC），现代人文黑体，OFL开源商用
  { lang: "zh", font: '"Noto Sans SC", "Source Han Sans SC", sans-serif', weight: 700, tracking: "-0.02em", fontsUrl: "https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@700&display=swap" },
  // 中文个性：思源宋体（Noto Serif SC），衬线重量感，OFL开源商用
  { lang: "zh", font: '"Noto Serif SC", "Source Han Serif SC", serif', weight: 900, tracking: "0em", fontsUrl: "https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@900&display=swap" },
  // 英文经典：Inter，现代无衬线，OFL开源商用
  { lang: "en", font: '"Inter", system-ui, sans-serif', weight: 900, tracking: "-0.03em", fontsUrl: "https://fonts.googleapis.com/css2?family=Inter:wght@900&display=swap" },
  // 英文个性：Playfair Display，高对比度衬线体，OFL开源商用
  { lang: "en", font: '"Playfair Display", "Georgia", serif', weight: 700, tracking: "-0.02em", fontsUrl: "https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&display=swap" },
];

const SVG_DECORATION_TEMPLATES = [
  {
    type: "blob-organic",
    viewBox: "0 0 200 200",
    path: "M47.3,-61.1C59.3,-52.3,65.8,-36.1,70.2,-19.3C74.6,-2.5,76.9,14.9,70.8,29.5C64.7,44.1,50.3,55.9,34.5,63.1C18.7,70.3,1.5,72.9,-15.2,69.9C-31.9,66.9,-48.1,58.3,-58.6,45C-69.1,31.7,-73.9,13.7,-72,-3.5C-70.1,-20.7,-61.5,-37.1,-49.2,-46C-36.9,-54.9,-20.9,-56.3,-2.7,-53.2C15.5,-50.1,35.3,-69.9,47.3,-61.1Z",
  },
  {
    type: "blob-soft",
    viewBox: "0 0 200 200",
    path: "M39.4,-50.2C51.5,-42.8,62.5,-32.4,66.2,-19.5C69.9,-6.6,66.4,8.8,59.5,21.8C52.7,34.8,42.5,45.4,30.3,52.5C18.1,59.6,3.9,63.2,-11.5,63.1C-26.9,63,-43.5,59.2,-53.5,49.2C-63.5,39.2,-67,23,-67.9,6.5C-68.8,-10,-67.2,-26.8,-59.1,-39.4C-51,-52,-36.4,-60.4,-22.2,-65.2C-8,-70,5.8,-71.2,17.7,-66.9C29.6,-62.6,27.3,-57.6,39.4,-50.2Z",
  },
  {
    type: "blob-spiky",
    viewBox: "0 0 200 200",
    path: "M55.1,-65.3C69.5,-56.1,78,-38.4,79.8,-20.5C81.6,-2.7,76.7,15.4,68.2,31.4C59.7,47.4,47.6,61.3,32.8,68.1C18,74.9,0.5,74.6,-17.5,70.8C-35.5,67,-54,59.7,-64.9,46.4C-75.8,33.1,-79,13.8,-76.3,-3.8C-73.6,-21.4,-65,-37.3,-53,-48.9C-41,-60.5,-25.6,-67.8,-9.1,-69.3C7.4,-70.8,40.7,-74.5,55.1,-65.3Z",
  },
  {
    type: "circle-solid",
    viewBox: "0 0 200 200",
    path: "M100,20 A80,80 0 1,1 99.9,20 Z",
  },
  {
    type: "hexagon",
    viewBox: "0 0 200 200",
    path: "M100,10 L182,55 L182,145 L100,190 L18,145 L18,55 Z",
  },
  {
    type: "triangle-soft",
    viewBox: "0 0 200 200",
    path: "M100,15 C110,15 185,170 185,175 C185,185 15,185 15,175 C15,170 90,15 100,15 Z",
  },
  {
    type: "diamond",
    viewBox: "0 0 200 200",
    path: "M100,10 L185,100 L100,190 L15,100 Z",
  },
  {
    type: "ring",
    viewBox: "0 0 200 200",
    // Will render as SVG circle stroke instead of path
    isRing: true,
  },
  {
    type: "dots-grid",
    viewBox: "0 0 200 200",
    // Will render as pattern of small circles
    isDots: true,
  },
  {
    type: "cross-lines",
    viewBox: "0 0 200 200",
    // Will render as crossing lines pattern
    isCrossLines: true,
  },
  {
    type: "diagonal-lines",
    // Will render as 45-degree diagonal stripe pattern (dark-bold style)
    isDiagonalLines: true,
  },
  {
    type: "street-lines",
    // Will render as S-curve lines with accent chevron icons (street-drop style)
    isStreetLines: true,
  },
  {
    type: "noise-grain",
    // Will render as SVG feTurbulence film grain overlay (mix-blend-mode: overlay)
    isNoiseGrain: true,
  },
  {
    type: "center-pulse",
    // Will render as concentric rings expanding from bottom-center (radar/signal feel)
    isCenterPulse: true,
  },
  {
    type: "scanlines",
    // Will render as CSS repeating-linear-gradient horizontal scan stripes
    isScanlines: true,
  },
];

const POSITIONS = ["top-right", "bottom-left", "top-left", "bottom-right", "center-left", "center-right"];

const LAYOUTS_ALL = ["hero", "right", "left", "duo", "trust", "center", "bottom-right", "bottom-left"];

/**
 * Generate a unique Style Recipe from scratch using algorithmic color theory.
 * Each call with a different seed produces a completely different visual identity.
 */
function generateStyleRecipe(seed, brandHue = null) {
  const rng = createRng(seed || Math.floor(Math.random() * 0xFFFFFFFF));

  const pick = (arr) => arr[Math.floor(rng() * arr.length)];
  const rand = (min, max) => min + rng() * (max - min);
  const randInt = (min, max) => Math.floor(rand(min, max));

  // ─── Color harmony ──────────────────────────────────────────────────────────
  // If a brand hue is provided, bias baseHue toward it (±20° creative variance)
  const baseHue = brandHue !== null
    ? Math.round((brandHue + (rng() * 40 - 20) + 360) % 360)
    : randInt(0, 360);
  const harmony = pick(["complementary", "triadic", "analogous", "split-complementary", "monochromatic"]);
  // When brandHue is set, exclude modes that completely override the hue with hardcoded warm/earthy ranges
  const colorModeCandidates = brandHue !== null
    ? ["light", "dark", "dark", "cool-dark", "neon-dark"]
    : ["light", "light", "dark", "dark", "warm-light", "cool-dark", "earthy", "neon-dark"];
  const colorMode = pick(colorModeCandidates);

  let bgHue = baseHue;
  let accentHue = baseHue;
  let accent2Hue = baseHue;

  switch (harmony) {
    case "complementary":
      accentHue = (baseHue + 180) % 360;
      accent2Hue = (baseHue + 200) % 360;
      break;
    case "triadic":
      accentHue = (baseHue + 120) % 360;
      accent2Hue = (baseHue + 240) % 360;
      break;
    case "analogous":
      accentHue = (baseHue + 30) % 360;
      accent2Hue = (baseHue + 60) % 360;
      break;
    case "split-complementary":
      accentHue = (baseHue + 150) % 360;
      accent2Hue = (baseHue + 210) % 360;
      break;
    case "monochromatic":
      accentHue = baseHue;
      accent2Hue = baseHue;
      break;
  }

  // Mode-based lightness/saturation rules
  let bgL, bgS, accentS, accentL, textHex, bgGradientShift;
  switch (colorMode) {
    case "light":  // Paper: ultra-minimal near-monochrome, ink-on-paper clarity
      bgL = randInt(95, 98); bgS = randInt(0, 6);
      accentS = randInt(0, 15); accentL = randInt(8, 18);
      textHex = hslToHex(baseHue, randInt(5, 15), randInt(8, 14));
      bgGradientShift = randInt(-3, 3);
      break;
    case "dark":  // Midnight: near-pure black with maximum-saturation jewel accents
      bgL = randInt(4, 10); bgS = randInt(5, 15);
      accentS = randInt(82, 100); accentL = randInt(60, 72);
      textHex = hslToHex(baseHue, randInt(5, 12), randInt(90, 97));
      bgGradientShift = randInt(-8, 8);
      break;
    case "warm-light":  // Sunset: warm orange sky bleeding into pink/magenta horizon
      bgHue = randInt(15, 28);
      accentHue = (bgHue + randInt(35, 55)) % 360;
      accent2Hue = (bgHue + randInt(55, 85)) % 360;
      bgL = randInt(82, 90); bgS = randInt(45, 65);
      accentS = randInt(65, 88); accentL = randInt(48, 62);
      textHex = hslToHex(randInt(18, 32), randInt(45, 62), randInt(18, 28));  // rich warm brown
      bgGradientShift = randInt(-45, -28);  // orange → pink/magenta
      break;
    case "cool-dark":  // Deep Sea: ocean abyss with bioluminescent cyan accents
      bgHue = randInt(208, 225);
      accentHue = randInt(170, 195);
      accent2Hue = randInt(185, 210);
      bgL = randInt(8, 16); bgS = randInt(35, 55);
      accentS = randInt(75, 95); accentL = randInt(55, 70);
      textHex = hslToHex(accentHue, randInt(72, 88), randInt(65, 78));  // tech blue headline
      bgGradientShift = randInt(-25, -10);
      break;
    case "earthy":  // Forest: lush green canopy, deep earth accents
      bgHue = randInt(80, 115);
      accentHue = randInt(100, 135);
      accent2Hue = randInt(65, 95);
      bgL = randInt(91, 96); bgS = randInt(18, 35);
      accentS = randInt(50, 72); accentL = randInt(28, 45);
      textHex = hslToHex(randInt(22, 35), randInt(22, 38), randInt(10, 18));
      bgGradientShift = randInt(10, 22);
      break;
    case "neon-dark":  // Matrix: near-black with bioluminescent green glow, not harsh
      bgHue = randInt(138, 162);           // dark background with subtle green-teal undertone
      accentHue = randInt(118, 148);       // fluorescent green accent (yellow-green to pure green)
      accent2Hue = randInt(148, 178);      // cyan-green secondary for depth
      bgL = randInt(3, 8); bgS = randInt(18, 32);   // near-black, low saturation keeps it from looking green-washed
      accentS = randInt(88, 100); accentL = randInt(62, 72);  // full neon pop
      textHex = hslToHex(accentHue, randInt(88, 100), randInt(65, 75));  // fluorescent green headline
      bgGradientShift = randInt(-8, 8);
      break;
    default:
      bgL = randInt(90, 96); bgS = randInt(10, 25);
      accentS = randInt(55, 80); accentL = randInt(42, 58);
      textHex = hslToHex(baseHue, 20, 12);
      bgGradientShift = 0;
  }

  const bgHex = hslToHex(bgHue, bgS, bgL);
  const bgEndHex = hslToHex((bgHue + bgGradientShift + 360) % 360, bgS + randInt(3, 10), bgL - randInt(3, 8));
  const accentHex = hslToHex(accentHue, accentS, accentL);
  const accent2Hex = hslToHex(accent2Hue, Math.max(30, accentS - randInt(5, 20)), accentL + randInt(-8, 15));

  const dark = isDark(bgHex);
  const textRgb = hexToRgb(textHex);
  const accentRgb = hexToRgb(accentHex);
  const accent2Rgb = hexToRgb(accent2Hex);

  const palette = {
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
    chip: dark
      ? `rgba(${accentRgb.r},${accentRgb.g},${accentRgb.b},${(0.12 + rng() * 0.08).toFixed(2)})`
      : `rgba(255,255,255,${(0.38 + rng() * 0.14).toFixed(2)})`,
    glow: `rgba(${accent2Rgb.r},${accent2Rgb.g},${accent2Rgb.b},${(0.14 + rng() * 0.12).toFixed(2)})`,
    shadow: dark
      ? `rgba(0,0,0,${(0.4 + rng() * 0.2).toFixed(2)})`
      : `rgba(${Math.floor(textRgb.r * 0.6)},${Math.floor(textRgb.g * 0.6)},${Math.floor(textRgb.b * 0.6)},${(0.15 + rng() * 0.1).toFixed(2)})`,
  };

  // ─── Per-mode signature overrides ───────────────────────────────────────────
  if (colorMode === "light") {
    // Paper: white cards with clear definition, dark-ink chips
    palette.card = `rgba(255,255,255,${(0.55 + rng() * 0.20).toFixed(2)})`;
    palette.chip = `rgba(${textRgb.r},${textRgb.g},${textRgb.b},${(0.07 + rng() * 0.06).toFixed(2)})`;
  } else if (colorMode === "neon-dark") {
    // Matrix green: strong glow + chip highlight for neon presence
    palette.glow = `rgba(${accentRgb.r},${accentRgb.g},${accentRgb.b},${(0.32 + rng() * 0.16).toFixed(2)})`;
    palette.card = `rgba(${accentRgb.r},${accentRgb.g},${accentRgb.b},${(0.08 + rng() * 0.06).toFixed(2)})`;
    palette.chip = `rgba(${accentRgb.r},${accentRgb.g},${accentRgb.b},${(0.22 + rng() * 0.10).toFixed(2)})`;
  } else if (colorMode === "earthy") {
    // Forest: green-tinted frosted cards
    const bgRgb = hexToRgb(bgHex);
    palette.card = `rgba(${bgRgb.r},${bgRgb.g},${bgRgb.b},${(0.42 + rng() * 0.18).toFixed(2)})`;
  }

  // ─── Typography ─────────────────────────────────────────────────────────────
  const fontPairing = pick(FONT_PAIRINGS);
  const typography = {
    font: fontPairing.font,
    fontsUrl: fontPairing.fontsUrl || null,
    headlineWeight: fontPairing.weight,
    headlineTracking: fontPairing.tracking,
    headlineSize: parseFloat((0.112 + rng() * 0.024).toFixed(3)),
    subtitleWeight: 400,
    subtitleSize: parseFloat((0.041 + rng() * 0.009).toFixed(3)),
  };

  // ─── SVG Decorations ────────────────────────────────────────────────────────
  const usedPositions = new Set();
  const numDecorations = randInt(2, 4);
  const decorations = [];

  for (let i = 0; i < numDecorations; i++) {
    const template = SVG_DECORATION_TEMPLATES[randInt(0, SVG_DECORATION_TEMPLATES.length)];
    const availablePositions = POSITIONS.filter((p) => !usedPositions.has(p));
    if (!availablePositions.length) break;
    const position = pick(availablePositions);
    usedPositions.add(position);

    const useAccent2 = rng() > 0.5;
    const baseRgb = useAccent2 ? accent2Rgb : accentRgb;
    const opacity = parseFloat((0.15 + rng() * 0.22).toFixed(2));

    decorations.push({
      type: template.type,
      viewBox: template.viewBox || "0 0 200 200",
      path: template.path || null,
      isRing: template.isRing || false,
      isDots: template.isDots || false,
      isCrossLines: template.isCrossLines || false,
      isDiagonalLines: template.isDiagonalLines || false,
      isStreetLines: template.isStreetLines || false,
      position,
      color: `rgba(${baseRgb.r},${baseRgb.g},${baseRgb.b},${opacity})`,
      scale: parseFloat((0.8 + rng() * 1.2).toFixed(2)),
      rotation: randInt(0, 360),
      size: pick(["sm", "md", "lg", "xl"]),
    });
  }

  // ─── Layout sequence ────────────────────────────────────────────────────────
  // Axis system: pick one visual axis first; all 6 slides follow that axis.
  // This ensures the first slide sets the tone and the rest stay coherent.
  const axis = pick(["center", "top-corner", "bottom-corner", "flip"]);
  let layouts;

  if (axis === "center") {
    // Text is always horizontally centered — hero / trust / duo / center family
    const seqs = [
      ["hero",  "trust",  "duo",    "center", "trust",  "hero"  ],
      ["hero",  "duo",    "center", "trust",  "hero",   "duo"   ],
      ["trust", "hero",   "duo",    "trust",  "center", "hero"  ],
    ];
    layouts = seqs[randInt(0, seqs.length - 1)];
  } else if (axis === "top-corner") {
    // Text always in a top corner; phone on the opposite bottom side
    layouts = rng() < 0.5
      ? ["right", "left",  "right", "left",  "right", "left" ]
      : ["left",  "right", "left",  "right", "left",  "right"];
  } else if (axis === "bottom-corner") {
    // Text always in a bottom corner; phone anchored at the top
    layouts = rng() < 0.5
      ? ["bottom-right", "bottom-left",  "bottom-right", "bottom-left",  "bottom-right", "bottom-left" ]
      : ["bottom-left",  "bottom-right", "bottom-left",  "bottom-right", "bottom-left",  "bottom-right"];
  } else {
    // Flip: top-corner and bottom-corner alternate — rhythmic inversion across slides
    layouts = rng() < 0.5
      ? ["right",        "bottom-right", "left",         "bottom-left",  "right",        "bottom-left"]
      : ["bottom-right", "right",        "bottom-left",  "left",         "bottom-right", "right"       ];
  }

  // ─── Mood name ──────────────────────────────────────────────────────────────
  const mood = MOOD_NAMES[randInt(0, MOOD_NAMES.length)];

  // Ghost wireframes: neon phone outlines flanking the main mockup (electric-neon style)
  const ghostFrames = (colorMode === 'neon-dark' || colorMode === 'cool-dark') && rng() < 0.55;
  // Glass reflection: mirror platform below phone (clean-light style)
  const glassReflection = (colorMode === 'light' || colorMode === 'warm-light') && rng() < 0.55;

  return { mood, harmony, colorMode, palette, typography, decorations, layouts, seed, ghostFrames, glassReflection, heroTiltDir: pick(['left', 'right']) };
}

// ─── AI copy generation ───────────────────────────────────────────────────────

async function generateCopyWithClaude(job, recipe, lang = "en") {
  if (!ANTHROPIC_API_KEY) return null;

  const screenshots = job.screenshots.slice(0, 6);
  const slideCount = Math.min(screenshots.length, 6);

  const imageContent = screenshots.map((s) => ({
    type: "image",
    source: {
      type: "base64",
      media_type: "image/jpeg",
      data: s.copyImageDataUrl.replace(/^data:image\/jpeg;base64,/, ""),
    },
  }));

  const isZh = lang === "zh";
  const langHeader = isZh
    ? "IMPORTANT: You MUST write ALL text (headline, subtitle) in Simplified Chinese (简体中文). Do NOT use any English words."
    : "Write all copy in English.";
  const exampleSlide = isZh
    ? `{ "index": 0, "layout": "hero", "headline": "交易变简单", "subtitle": "专注真正重要的事" }`
    : `{ "index": 0, "layout": "hero", "headline": "Calculate gains\\nBeat the market", "subtitle": "Built for how you work" }`;

  const prompt = `${langHeader}

You are an expert App Store copywriter. Your goal is to write marketing copy — not documentation.

App: ${job.appNameHint || "Unknown App"}
Description: ${job.descriptionHint || "A mobile app"}
Language: ${isZh ? "Simplified Chinese — every word must be Chinese" : "English"}
Visual mood: "${recipe.mood}"

I will show you ${screenshots.length} real screenshot(s) of the app. Write marketing copy for ${slideCount} App Store screenshot slides.

CRITICAL — SINGLE PHRASE RULE: Every text field must be ONE continuous phrase with ZERO punctuation and ZERO clause separators. No commas ,，、 no periods .。 no colons :： no ellipsis … no dashes — no semicolons ;；. Writing two ideas connected by a comma is the #1 forbidden mistake.

RULES:
- ${isZh ? "全部使用简体中文，禁止出现英文单词" : "Write in English only"}
- Each slide sells ONE idea only
- Headline line breaks: use \\n only when the total character count exceeds 5. Short headlines (≤5 chars for Chinese, ≤10 chars for English) must be written as a single line with NO \\n. Never use more than one \\n.
- Never write feature lists or buzzwords
- Match the mood: "${recipe.mood}"
${isZh ? `- Headline: 5–10 Chinese characters total. If ≤5 chars write as one line (no \\n). If 6–10 chars split into 2 lines with one \\n, each line 3–6 chars. No punctuation.
- Subtitle: ≤12 Chinese characters total. No punctuation. ONE phrase expressing a single thought — never "A，B" or "A、B" structure.
- FORBIDDEN subtitle patterns (two clauses = always wrong):
    "专业工具助力决策、开启新时代"  ← two clauses with 、
    "智能分析交易，提升表现"        ← two clauses with ，
    "记录成长，超越自我"            ← two clauses with ，
- CORRECT subtitle patterns (single thought = always right):
    "专注真正重要的事"
    "让数据替你说话"
    "每次交易都算数"` : `- Headline: each line must be ≤10 characters including spaces. No punctuation.
- Subtitle: ≤20 characters total. No punctuation. ONE direct phrase — never "A, B" structure.
- FORBIDDEN: "Track your trades, boost your gains" ← two clauses with comma
- FORBIDDEN: "Work Smarter Not Harder" ← too many characters per line
- CORRECT: "Do more daily" / "Built for focus"`}

Return ONLY valid JSON, no markdown, no explanation:
{
  "slides": [
    ${exampleSlide},
    ...
  ]
}

Layouts in order: ${recipe.layouts.slice(0, slideCount).join(", ")}`;

  const messages = [
    {
      role: "user",
      content: [
        ...imageContent,
        { type: "text", text: prompt },
      ],
    },
  ];

  const response = await fetch(ANTHROPIC_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: 2048,
      messages,
    }),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => "");
    throw new Error(`Claude API error ${response.status}: ${errText.slice(0, 200)}`);
  }

  const data = await response.json();
  const text = data.content?.[0]?.text || "";

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("Claude returned no valid JSON");

  const parsed = JSON.parse(jsonMatch[0]);
  // If Claude included a clause separator, keep only the first clause; then strip remaining punctuation
  const CLAUSE_RE = /[，,、]/;
  const PUNCT_RE  = /[，,、。.：:；;！!？?…—–]/g;
  const firstClause = (s) => typeof s === "string" ? s.split(CLAUSE_RE)[0].trim() : s;
  const stripPunct  = (s) => typeof s === "string" ? s.replace(PUNCT_RE, "").trim() : s;
  const clean = (s) => stripPunct(firstClause(s));
  const slides = (parsed.slides || []).map((slide) => ({
    ...slide,
    headline: typeof slide.headline === "string"
      ? slide.headline.split("\n").map(clean).join("\n")
      : slide.headline,
    subtitle: clean(slide.subtitle),
  }));
  return slides;
}

function buildFallbackCopy(screenshots, recipe, lang = "en") {
  const layouts = recipe.layouts.slice(0, screenshots.length);
  const headlines = {
    en: [
      ["The Smarter Way", "To Get It Done"],
      ["Everything You Need", "Right Here"],
      ["Designed for", "Real Life"],
      ["Stay on Top", "of It All"],
      ["Your New", "Favorite App"],
      ["Less Noise", "More Focus"],
    ],
    zh: [
      ["更智能的方式", "轻松完成"],
      ["一切所需", "就在这里"],
      ["专为", "真实生活设计"],
      ["掌控", "每一天"],
      ["你的全新", "得力应用"],
      ["专注所需", "远离噪音"],
    ],
  };
  const hl = headlines[lang] || headlines.en;
  const subtitle = lang === "zh"
    ? "专注真正重要的事"
    : "Built for how you work.";

  return layouts.map((layout, i) => ({
    index: i,
    layout,
    headline: (hl[i] || (lang === "zh" ? ["专为你", "打造"] : ["Built for", "You"])).join("\n"),
    subtitle,
  }));
}

// ─── Playwright helpers ───────────────────────────────────────────────────────

async function getBrowser() {
  if (!browserPromise) {
    let chromium;
    try { ({ chromium } = require("playwright")); }
    catch { throw new Error("Playwright not installed. Run: npm install -D playwright && npx playwright install chromium"); }

    const executablePath = SYSTEM_BROWSER_CANDIDATES.find((c) => fs.existsSync(c));
    browserPromise = chromium.launch({
      headless: true,
      executablePath,
      channel: executablePath ? undefined : "chromium",
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
      ],
    });
  }
  return browserPromise;
}

function createTimeoutController(timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return {
    signal: controller.signal,
    clear() { clearTimeout(timer); },
  };
}

async function navigateWithFallback(page, targetUrl, timeout = 60000) {
  try {
    await page.goto(targetUrl, { waitUntil: "networkidle", timeout });
  } catch {
    try { await page.goto(targetUrl, { waitUntil: "load", timeout }); }
    catch { try { await page.goto(targetUrl, { waitUntil: "domcontentloaded", timeout }); }
      catch { await page.goto(targetUrl, { waitUntil: "commit", timeout }); } }
  }
}

async function waitForRenderAssets(page) {
  await page.evaluate(async () => {
    if (document.fonts && document.fonts.ready) await document.fonts.ready.catch(() => {});
    const images = Array.from(document.images || []);
    await Promise.all(images.map(async (img) => {
      if (!img.complete) {
        await new Promise((resolve) => {
          img.addEventListener("load", resolve, { once: true });
          img.addEventListener("error", resolve, { once: true });
        });
      }
      if (typeof img.decode === "function") {
        await img.decode().catch(() => {});
      }
    }));
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
}

// ─── Visual duplicate detection ──────────────────────────────────────────────
// Decompresses PNG IDAT data with built-in zlib and samples actual pixel
// values (R,G,B) from a grid of points across the image.  Comparing
// compressed bytes directly is unreliable because DEFLATE is context-
// dependent — a single different pixel cascades into many changed bytes.
const zlib = require("zlib");

function samplePngPixels(buf) {
  // Validate PNG signature
  if (buf.length < 8 || buf.readUInt32BE(0) !== 0x89504e47) return null;
  let pos = 8;
  let width = 0, height = 0, colorType = 0, bitDepth = 0;
  const idatParts = [];
  while (pos + 12 <= buf.length) {
    const len  = buf.readUInt32BE(pos);
    const type = buf.slice(pos + 4, pos + 8).toString("ascii");
    const data = buf.slice(pos + 8, pos + 8 + len);
    if (type === "IHDR") {
      width     = data.readUInt32BE(0);
      height    = data.readUInt32BE(4);
      bitDepth  = data[8];
      colorType = data[9];
    } else if (type === "IDAT") {
      idatParts.push(data);
    } else if (type === "IEND") {
      break;
    }
    pos += 12 + len;
  }
  if (!width || !height || !idatParts.length) return null;
  let raw;
  try { raw = zlib.inflateSync(Buffer.concat(idatParts)); }
  catch { return null; }
  // bytes per pixel: RGB=3, RGBA=4, Grey=1, GreyA=2
  const ch = colorType === 2 ? 3 : colorType === 6 ? 4 : colorType === 0 ? 1 : 3;
  const bpp    = Math.ceil((bitDepth / 8) * ch);
  const stride = 1 + width * bpp; // leading filter byte per row
  // Sample a 20×15 grid of pixels (300 points) spread across the image
  const COLS = 20, ROWS = 15;
  const samples = [];
  for (let r = 0; r < ROWS; r++) {
    const row = Math.floor(r * height / ROWS);
    const rowBase = row * stride + 1; // +1 skips filter byte
    for (let c = 0; c < COLS; c++) {
      const col = Math.floor(c * width / COLS);
      const off = rowBase + col * bpp;
      if (off + Math.min(ch, 3) - 1 < raw.length) {
        samples.push(raw[off], raw[off + 1] ?? 0, raw[off + 2] ?? 0);
      }
    }
  }
  return { width, height, samples };
}

function looksLikeDuplicate(bufA, bufB) {
  const a = samplePngPixels(bufA);
  const b = samplePngPixels(bufB);
  if (!a || !b) return false;
  if (a.width !== b.width || a.height !== b.height) return false;
  if (a.samples.length !== b.samples.length || a.samples.length === 0) return false;

  // Block-based comparison: divide the 20×15 sample grid into 4×3 super-blocks.
  // If ANY block's average channel delta exceeds the threshold, the images are
  // considered different — even if the rest of the page (e.g. a fixed navbar)
  // is identical. This prevents identical headers from masking content changes.
  const COLS = 20, ROWS = 15;
  const BLOCK_COLS = 4, BLOCK_ROWS = 3;
  const BLOCK_DIFF_THRESHOLD = 22; // per-channel avg delta to flag a block as "different"
  for (let br = 0; br < BLOCK_ROWS; br++) {
    for (let bc = 0; bc < BLOCK_COLS; bc++) {
      let blockDiff = 0, blockCount = 0;
      const rStart = Math.floor(br * ROWS / BLOCK_ROWS);
      const rEnd   = Math.floor((br + 1) * ROWS / BLOCK_ROWS);
      const cStart = Math.floor(bc * COLS / BLOCK_COLS);
      const cEnd   = Math.floor((bc + 1) * COLS / BLOCK_COLS);
      for (let r = rStart; r < rEnd; r++) {
        for (let c = cStart; c < cEnd; c++) {
          const idx = (r * COLS + c) * 3;
          blockDiff += Math.abs(a.samples[idx]     - b.samples[idx]);
          blockDiff += Math.abs(a.samples[idx + 1] - b.samples[idx + 1]);
          blockDiff += Math.abs(a.samples[idx + 2] - b.samples[idx + 2]);
          blockCount += 3;
        }
      }
      // This block is visually different → pages are not duplicates
      if (blockCount > 0 && (blockDiff / blockCount) > BLOCK_DIFF_THRESHOLD) return false;
    }
  }

  // All blocks are similar → duplicate
  return true;
}

// ─── Route discovery helpers ──────────────────────────────────────────────────

function normalizeUrlForDedupe(rawUrl) {
  const parsed = new URL(rawUrl);
  if (parsed.pathname !== "/") {
    parsed.pathname = parsed.pathname.replace(/\/+$/, "") || "/";
  }
  parsed.hash = "";
  return parsed.href;
}

function buildTargetLabel(targetUrl, fallbackIndex) {
  try {
    const parsed = new URL(targetUrl);
    const tail = parsed.pathname.split("/").filter(Boolean).pop() || "home";
    return tail.replace(/\.[a-z0-9]+$/i, "") || `page-${fallbackIndex}`;
  } catch {
    return `page-${fallbackIndex}`;
  }
}

async function collectSameOriginLinks(page, currentUrl, origin) {
  const links = await page.$$eval("a[href]", (anchors) =>
    anchors.map((a) => a.getAttribute("href") || "").filter(Boolean)
  ).catch(() => []);

  const results = [];
  const seen = new Set();
  for (const href of links) {
    const trimmed = href.trim();
    if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith("javascript:") ||
        trimmed.startsWith("mailto:") || trimmed.startsWith("tel:")) continue;
    try {
      const absolute = new URL(trimmed, currentUrl);
      if (!["http:", "https:"].includes(absolute.protocol)) continue;
      if (absolute.origin !== origin) continue;
      absolute.hash = "";
      const normalized = normalizeUrlForDedupe(absolute.href);
      if (seen.has(normalized)) continue;
      seen.add(normalized);
      results.push(normalized);
    } catch { /* ignore malformed */ }
  }
  return results;
}

async function discoverCaptureTargets(job, page) {
  const MAX = 6;
  const startUrl = normalizeUrlForDedupe(job.url);
  const origin = new URL(startUrl).origin;
  const rootUrl = normalizeUrlForDedupe(origin + "/");

  // Always seed root/home first so captures follow the page hierarchy
  // (home → sub-pages). Add startUrl second in case it's not linked from root.
  const initialUrls = startUrl === rootUrl ? [startUrl] : [rootUrl, startUrl];
  const queue = initialUrls.map((url) => ({ url, depth: 0 }));
  const queued = new Set(initialUrls);
  const visited = new Set();
  const targets = [];

  const visitedFinalUrls = new Set();

  while (queue.length && targets.length < MAX) {
    const current = queue.shift();
    if (!current || visited.has(current.url)) continue;
    visited.add(current.url);

    try {
      await page.goto(current.url, { waitUntil: "domcontentloaded", timeout: 30000 });
      await page.waitForTimeout(400);

      // Skip if this URL redirected to a page we've already seen
      const finalUrl = normalizeUrlForDedupe(page.url());
      if (visitedFinalUrls.has(finalUrl)) continue;
      visitedFinalUrls.add(finalUrl);

      targets.push({ targetUrl: current.url, label: buildTargetLabel(current.url, targets.length + 1) });

      if (current.depth >= 2 || targets.length >= MAX) continue;
      const links = await collectSameOriginLinks(page, current.url, origin);
      for (const link of links) {
        if (!visited.has(link) && !queued.has(link)) {
          queued.add(link);
          queue.push({ url: link, depth: current.depth + 1 });
        }
      }
    } catch { /* skip failed pages, keep discovered so far */ }
  }

  return targets;
}

// ─── One-click capture pipeline ───────────────────────────────────────────────

async function runOneclickPipeline(job) {
  const browser = await getBrowser();
  const context = await browser.newContext({
    viewport: MOBILE_VIEWPORT,
    deviceScaleFactor: DEVICE_SCALE,
    userAgent: USER_AGENT,
    colorScheme: "no-preference",
  });
  const page = await context.newPage();

  try {
    // Step 1: Discover & capture screenshots
    let targets;
    if (job.routes.length) {
      const manualUrls = [job.url, ...job.routes.map((r) =>
        new URL(r.startsWith("/") ? r : `/${r}`, job.url).href
      )];
      const deduped = [...new Set(manualUrls.map(normalizeUrlForDedupe))].slice(0, 6);
      targets = deduped.map((u, i) => ({ targetUrl: u, label: buildTargetLabel(u, i + 1) }));
      pushJobEvent(job, "ok", `已根据手动路由整理出 ${targets.length} 个页面`);
    } else {
      pushJobEvent(job, "run", "正在自动发现同域页面…");
      try {
        targets = await discoverCaptureTargets(job, page);
        pushJobEvent(job, "ok", `自动发现 ${targets.length} 个不同页面`);
      } catch (err) {
        targets = [{ targetUrl: job.url, label: buildTargetLabel(job.url, 1) }];
        pushJobEvent(job, "dim", `页面发现失败，回退到单页截图：${err.message}`);
      }
    }

    job.total = targets.length;
    const capturedFinalUrls = new Set();
    const capturedContentHashes = new Set();
    const capturedPngBuffers = []; // kept for approximate visual comparison

    for (let i = 0; i < targets.length; i++) {
      const { targetUrl, label } = targets[i];
      pushJobEvent(job, "run", `截图 ${String(i + 1).padStart(2, "0")}-${label}: ${targetUrl}`);
      await navigateWithFallback(page, targetUrl);
      await page.waitForTimeout(CAPTURE_WAIT_MS);

      // Deduplicate by final URL after redirects
      const finalUrl = normalizeUrlForDedupe(page.url());
      if (capturedFinalUrls.has(finalUrl)) {
        pushJobEvent(job, "dim", `截图 ${String(i + 1).padStart(2, "0")} 跳过（URL 相同：${finalUrl}）`);
        continue;
      }
      capturedFinalUrls.add(finalUrl);

      const [pngBuffer, jpegBuffer] = await Promise.all([
        page.screenshot({ type: "png", fullPage: false }),
        page.screenshot({ type: "jpeg", quality: 55, scale: "css", fullPage: false }),
      ]);

      // Exact duplicate check (same pixels, byte-for-byte)
      const contentHash = crypto.createHash("sha256").update(pngBuffer).digest("hex");
      if (capturedContentHashes.has(contentHash)) {
        pushJobEvent(job, "dim", `截图 ${String(i + 1).padStart(2, "0")} 跳过（画面完全相同）`);
        continue;
      }

      // Approximate visual duplicate check (same page with minor dynamic differences)
      if (capturedPngBuffers.some((prev) => looksLikeDuplicate(prev, pngBuffer))) {
        pushJobEvent(job, "dim", `截图 ${String(i + 1).padStart(2, "0")} 跳过（画面高度相似，视为重复）`);
        continue;
      }

      capturedContentHashes.add(contentHash);
      capturedPngBuffers.push(pngBuffer);

      job.screenshots.push({
        index: job.screenshots.length,
        requestUrl: targetUrl,
        finalUrl,
        imageDataUrl: `data:image/png;base64,${pngBuffer.toString("base64")}`,
        copyImageDataUrl: `data:image/jpeg;base64,${jpegBuffer.toString("base64")}`,
      });
      job.completed = job.screenshots.length;
      pushJobEvent(job, "ok", `截图 ${String(job.screenshots.length).padStart(2, "0")} 完成 (1170×2532px)`);
    }

    // Step 2: Generate style recipe
    pushJobEvent(job, "run", "正在生成视觉配方…");
    const seed = Date.now() ^ Math.floor(Math.random() * 0xFFFFFF);
    job.recipe = generateStyleRecipe(seed, job.brandHue);
    pushJobEvent(job, "ok", `视觉配方已生成：${job.recipe.mood} · ${job.recipe.harmony} · ${job.recipe.colorMode}`);

    // Step 3: Generate copy for each selected language
    const copies = {};
    for (const lang of job.languages) {
      const langLabel = lang === "zh" ? "中文" : "English";
      if (ANTHROPIC_API_KEY) {
        pushJobEvent(job, "run", `AI 正在生成文案（${langLabel}）…`);
        try {
          copies[lang] = await generateCopyWithClaude(job, job.recipe, lang);
          pushJobEvent(job, "ok", `${langLabel}文案已生成，共 ${copies[lang].length} 张`);
        } catch (err) {
          copies[lang] = buildFallbackCopy(job.screenshots, job.recipe, lang);
          pushJobEvent(job, "dim", `${langLabel} AI 文案失败，使用模板：${err.message}`);
        }
      } else {
        copies[lang] = buildFallbackCopy(job.screenshots, job.recipe, lang);
        pushJobEvent(job, "dim", `未配置 ANTHROPIC_API_KEY，使用${langLabel}模板文案`);
      }
    }
    job.recipe.copies = copies;
    // Keep backwards-compatible .copy pointing to first language
    job.recipe.copy = copies[job.languages[0]] || [];

    job.status = "completed";
    pushJobEvent(job, "ok", `✦ 配方完成！共 ${job.screenshots.length} 张截图 × ${job.languages.length} 种语言`);
  } catch (err) {
    job.status = "failed";
    job.error = err.message;
    pushJobEvent(job, "error", `流程失败：${err.message}`);
  } finally {
    job.updatedAt = new Date().toISOString();
    job.expiresAt = Date.now() + JOB_TTL_MS;
    await page.close().catch(() => {});
    await context.close().catch(() => {});
  }
}

// ─── Render export (HTML → PNG via Playwright) ────────────────────────────────

async function renderExportFilesToDisk(payload) {
  const files = Array.isArray(payload && payload.files) ? payload.files.filter(Boolean) : [];
  if (!files.length) throw new Error("No files to export");

  const browser = await getBrowser();
  const baseDir = ensureDirectory(EXPORT_OUTPUT_DIR);
  const saveDir = files.length === 1 && !payload.folderName
    ? baseDir
    : buildUniqueDirectory(baseDir, payload.folderName || `export-${Date.now()}`);

  const savedFiles = [];
  for (const file of files) {
    const buffer = await renderExportFileBuffer(browser, file);
    const requestedName = sanitizeFilename(file.filename, `export-${savedFiles.length + 1}.png`);
    const { filename, filePath } = buildUniqueFilePath(saveDir, requestedName);
    fs.writeFileSync(filePath, buffer);
    savedFiles.push({ filename, path: filePath, bytes: buffer.length });
  }

  // Save raw text files (e.g. app-logo.svg) directly without rendering
  const rawFiles = Array.isArray(payload.rawFiles) ? payload.rawFiles.filter(Boolean) : [];
  console.log(`[export] rawFiles received: ${rawFiles.length}`, rawFiles.map(r => `${r.filename}(${String(r.content||"").length}bytes)`));
  for (const raw of rawFiles) {
    const content = String(raw.content || "").trim();
    if (!content) continue;
    const requestedName = sanitizeFilename(raw.filename, `raw-${savedFiles.length + 1}.svg`);
    const { filename, filePath } = buildUniqueFilePath(saveDir, requestedName);
    // Support base64-encoded binary files (e.g. data:image/png;base64,...)
    const b64Match = content.match(/^data:[^;]+;base64,(.+)$/s);
    if (b64Match) {
      fs.writeFileSync(filePath, Buffer.from(b64Match[1], "base64"));
    } else {
      fs.writeFileSync(filePath, content, "utf8");
    }
    console.log(`[export] saved raw file: ${filePath}`);
    savedFiles.push({ filename, path: filePath, bytes: Buffer.byteLength(content) });
  }

  return { count: savedFiles.length, directory: saveDir, files: savedFiles };
}

async function renderExportFileBuffer(browser, file) {
  const width = Math.max(1, Number.parseInt(file.width, 10) || 0);
  const height = Math.max(1, Number.parseInt(file.height, 10) || 0);
  const rawMarkup = String(file.markup || "").trim();
  const styles = String(file.styles || "");
  if (!rawMarkup) throw new Error("Empty export content");

  // Extract <style> tags from markup and hoist them into <head> so that
  // @import font rules load with the correct priority and block rendering.
  // Leaving them inside a body div causes Playwright to race the font load
  // against the first paint, which can result in the background gradient
  // not being applied (exported PNG appears white instead of dark).
  const headStyles = [];
  const markup = rawMarkup.replace(/<style[^>]*>([\s\S]*?)<\/style>/gi, (_, content) => {
    headStyles.push(content);
    return "";
  });

  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, colorScheme: "no-preference" });
  const page = await context.newPage();

  try {
    await page.setContent(
      `<!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <style>
            html, body { margin: 0; padding: 0; background: transparent; }
            #capture-root { width: ${width}px; height: ${height}px; overflow: hidden; }
            ${styles}
          </style>
          ${headStyles.map(s => `<style>${s}</style>`).join("\n")}
        </head>
        <body><div id="capture-root">${markup}</div></body>
      </html>`,
      { waitUntil: "load" }
    );
    await waitForRenderAssets(page);

    // Refit text to prevent overflow with actual rendered fonts
    await page.evaluate(() => {
      document.querySelectorAll("[data-refit]").forEach((el) => {
        const parent = el.parentElement;
        if (!parent) return;
        const maxW = parent.getBoundingClientRect().width;
        if (!maxW) return;
        let size = parseFloat(getComputedStyle(el).fontSize);
        let iterations = 0;
        while (el.scrollWidth > maxW + 2 && size > 12 && iterations < 40) {
          size -= 0.5;
          el.style.fontSize = `${size}px`;
          iterations++;
        }
      });
    });

    // Double-call: first warms fonts/images, second produces clean output
    await page.screenshot({ type: "png", clip: { x: 0, y: 0, width, height } });
    return await page.screenshot({ type: "png", clip: { x: 0, y: 0, width, height } });
  } finally {
    await page.close().catch(() => {});
    await context.close().catch(() => {});
  }
}

// ─── Export files from data URL ───────────────────────────────────────────────

function exportFilesToDisk(payload) {
  const files = Array.isArray(payload && payload.files) ? payload.files.filter(Boolean) : [];
  if (!files.length) throw new Error("No files to export");

  const baseDir = ensureDirectory(EXPORT_OUTPUT_DIR);
  const saveDir = files.length === 1 && !payload.folderName
    ? baseDir
    : buildUniqueDirectory(baseDir, payload.folderName || `export-${Date.now()}`);

  const savedFiles = files.map((file, i) => {
    const buffer = decodeImageDataUrl(file.imageDataUrl);
    const requestedName = sanitizeFilename(file.filename, `export-${i + 1}.png`);
    const { filename, filePath } = buildUniqueFilePath(saveDir, requestedName);
    fs.writeFileSync(filePath, buffer);
    return { filename, path: filePath, bytes: buffer.length };
  });

  return { count: savedFiles.length, directory: saveDir, files: savedFiles };
}

// ─── Preview endpoint ─────────────────────────────────────────────────────────

async function capturePreview(targetUrl) {
  const browser = await getBrowser();
  const context = await browser.newContext({
    viewport: MOBILE_VIEWPORT,
    deviceScaleFactor: DEVICE_SCALE,
    userAgent: USER_AGENT,
  });
  const page = await context.newPage();
  try {
    await navigateWithFallback(page, targetUrl);
    await page.waitForTimeout(CAPTURE_WAIT_MS);
    const [title, finalUrl, pngBuffer] = await Promise.all([
      page.title().catch(() => ""),
      Promise.resolve(page.url()),
      page.screenshot({ type: "png", fullPage: false }),
    ]);
    return {
      title,
      finalUrl,
      viewport: MOBILE_VIEWPORT,
      imageDataUrl: `data:image/png;base64,${pngBuffer.toString("base64")}`,
      capturedAt: new Date().toISOString(),
    };
  } finally {
    await page.close().catch(() => {});
    await context.close().catch(() => {});
  }
}

function normalizeUrl(raw) {
  const str = String(raw || "").trim();
  if (!str) throw new Error("URL is required");
  if (!/^https?:\/\//i.test(str)) return `http://${str}`;
  return str;
}

// ─── AI app name suggestion ───────────────────────────────────────────────────

async function suggestAppName(targetUrl) {
  if (!ANTHROPIC_API_KEY) return null;
  const browser = await getBrowser();
  const context = await browser.newContext({
    viewport: MOBILE_VIEWPORT,
    deviceScaleFactor: 1,
    userAgent: USER_AGENT,
  });
  const page = await context.newPage();
  try {
    await navigateWithFallback(page, targetUrl);
    await page.waitForTimeout(Math.min(CAPTURE_WAIT_MS, 1200));
    const [title, bodyText] = await Promise.all([
      page.title().catch(() => ""),
      page.evaluate(() => {
        const el = document.body;
        return el ? el.innerText.replace(/\s+/g, " ").slice(0, 800) : "";
      }).catch(() => ""),
    ]);

    const prompt = `你是一位擅长为移动应用命名的专家。根据以下应用信息，给这个App取一个4个汉字以内的中文名称。

要求：
- 最多4个汉字，可以是2~4字
- 用词年轻、积极向上，紧密关联app的真实功能特性
- 不使用负面、违规、不合时宜的词汇
- 只输出名称本身，不要任何解释或标点

App URL: ${targetUrl}
页面标题: ${title || "(无)"}
页面内容摘要: ${bodyText || "(无)"}

请直接输出App名称（2-4个汉字）：`;

    const response = await fetch(ANTHROPIC_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: ANTHROPIC_MODEL,
        max_tokens: 20,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) return null;
    const data = await response.json();
    const raw = (data?.content?.[0]?.text || "").trim();
    const match = raw.match(/[\u4e00-\u9fa5]{2,4}/);
    return match ? match[0] : null;
  } finally {
    await page.close().catch(() => {});
    await context.close().catch(() => {});
  }
}

// ─── AI logo SVG generation ───────────────────────────────────────────────────

async function suggestAppLogo(targetUrl) {
  if (!ANTHROPIC_API_KEY) return null;
  const browser = await getBrowser();
  const context = await browser.newContext({
    viewport: MOBILE_VIEWPORT,
    deviceScaleFactor: 1,
    userAgent: USER_AGENT,
  });
  const page = await context.newPage();
  let title = "";
  let bodyText = "";
  let pageColors = [];
  try {
    await navigateWithFallback(page, targetUrl, APP_LOGO_PAGE_TIMEOUT_MS);
    await page.waitForTimeout(Math.min(CAPTURE_WAIT_MS, 1200));
    [title, bodyText, pageColors] = await Promise.all([
      page.title().catch(() => ""),
      page.evaluate(() => {
        const el = document.body;
        return el ? el.innerText.replace(/\s+/g, " ").slice(0, 800) : "";
      }).catch(() => ""),
      page.evaluate(() => {
        // Extract dominant brand colors from key page elements
        const selectors = [
          "header", "nav", "[class*='header']", "[class*='nav']",
          "button", "[class*='btn']", "[class*='button']",
          "a", "[class*='primary']", "[class*='brand']", "[class*='logo']",
          "h1", "h2", ".hero", "[class*='hero']",
        ];
        const colorCounts = {};
        const parseRgb = (str) => {
          const m = str.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
          return m ? [+m[1], +m[2], +m[3]] : null;
        };
        const toHex = ([r, g, b]) =>
          "#" + [r, g, b].map(v => v.toString(16).padStart(2, "0")).join("");
        const isNeutral = ([r, g, b]) => {
          const max = Math.max(r, g, b), min = Math.min(r, g, b);
          const brightness = (max + min) / 2;
          const saturation = max === min ? 0 : (max - min) / (255 - Math.abs(2 * brightness - 255));
          // Skip near-white, near-black, near-gray, transparent
          return brightness > 230 || brightness < 15 || saturation < 0.12;
        };
        const seen = new Set();
        for (const sel of selectors) {
          const els = Array.from(document.querySelectorAll(sel)).slice(0, 5);
          for (const el of els) {
            const style = window.getComputedStyle(el);
            for (const prop of ["backgroundColor", "color", "borderColor"]) {
              const rgb = parseRgb(style[prop] || "");
              if (!rgb || isNeutral(rgb)) continue;
              const hex = toHex(rgb);
              if (seen.has(hex)) { colorCounts[hex] = (colorCounts[hex] || 0) + 1; }
              else { seen.add(hex); colorCounts[hex] = 1; }
            }
          }
        }
        // Return top 5 most-frequent brand colors
        return Object.entries(colorCounts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([hex]) => hex);
      }).catch(() => []),
    ]);
  } finally {
    await page.close().catch(() => {});
    await context.close().catch(() => {});
  }

  const COLOR_SCHEMES = [
    // bg: [from, to], icon: [primary, secondary, optional-accent]
    { bg: ["#0F0C29", "#302B63"], icon: ["#FFD700", "#FFC200"],          accent: "#FFF8DC" }, // midnight navy + gold
    { bg: ["#134E4A", "#0D3B31"], icon: ["#6EE7B7", "#34D399"],          accent: "#D1FAE5" }, // deep teal + mint
    { bg: ["#4C1D95", "#6D28D9"], icon: ["#DDD6FE", "#A78BFA"],          accent: "#EDE9FE" }, // deep purple + lavender
    { bg: ["#164E63", "#155E75"], icon: ["#A5F3FC", "#67E8F9"],          accent: "#ECFEFF" }, // deep cyan + light cyan
    { bg: ["#1F2937", "#111827"], icon: ["#E5E7EB", "#9CA3AF"],          accent: "#F9FAFB" }, // charcoal + silver
    { bg: ["#14532D", "#166534"], icon: ["#BBF7D0", "#86EFAC"],          accent: "#F0FDF4" }, // forest green + pale green
    { bg: ["#78350F", "#92400E"], icon: ["#FDE68A", "#FCD34D"],          accent: "#FFFBEB" }, // dark amber + golden yellow
    { bg: ["#1E3A5F", "#1e40af"], icon: ["#BAE6FD", "#7DD3FC"],          accent: "#E0F2FE" }, // navy + steel blue
    { bg: ["#0F172A", "#1E293B"], icon: ["#38BDF8", "#0EA5E9"],          accent: "#7DD3FC" }, // near-black + sky blue
    { bg: ["#2D1B69", "#4C1D95"], icon: ["#C4B5FD", "#8B5CF6"],          accent: "#EDE9FE" }, // dark violet + soft purple
    { bg: ["#064E3B", "#065F46"], icon: ["#FCD34D", "#F59E0B"],          accent: "#FEF9C3" }, // deep emerald + yellow
    { bg: ["#1C1917", "#292524"], icon: ["#D4A76A", "#C8963E"],          accent: "#FEF3C7" }, // near-black + warm bronze
    { bg: ["#0C4A6E", "#075985"], icon: ["#E0F2FE", "#BAE6FD"],          accent: "#FFFFFF"  }, // ocean blue + pale sky
    { bg: ["#312E81", "#4338CA"], icon: ["#FDE68A", "#F59E0B"],          accent: "#FFFBEB" }, // indigo + amber
    { bg: ["#27272A", "#3F3F46"], icon: ["#A3E635", "#84CC16"],          accent: "#ECFCCB" }, // dark zinc + lime
  ];
  // Derive a light/bright variant of a brand color for use as icon foreground
  const deriveLightVariant = (hex) => {
    const { r, g, b } = hexToRgb(hex);
    // Lighten by blending toward white
    const blend = (c) => Math.round(c + (255 - c) * 0.55);
    return `#${[blend(r), blend(g), blend(b)].map(v => v.toString(16).padStart(2, "0")).join("")}`;
  };

  // Use page brand colors if available, otherwise fall back to random scheme
  let scheme;
  let colorNote = "";
  if (pageColors.length >= 1) {
    const primary = pageColors[0];
    const secondary = pageColors[1] || pageColors[0];
    // Icon colors: lightened variants of brand colors, keeping the same hue family
    const iconPrimary = pageColors[2] || deriveLightVariant(primary);
    const iconSecondary = pageColors[3] || deriveLightVariant(secondary);
    const accent = pageColors[4] || "#FFFFFF";
    scheme = { bg: [primary, secondary], icon: [iconPrimary, iconSecondary], accent };
    colorNote = `\nColor note: The entire palette (background AND icon shapes) is derived from the app's own brand colors. Keep all shapes within this color family — do NOT introduce unrelated colors like yellow, orange, or red.`;
  } else {
    scheme = COLOR_SCHEMES[Math.floor(Math.random() * COLOR_SCHEMES.length)];
    colorNote = "";
  }

  // Force creative divergence on each generation
  const INSPIRATION_DIRECTIONS = ["geometric", "organic", "abstract", "typographic", "metaphorical", "symbolic", "illustrative", "minimalist-bold"];
  const AVOID_CONCEPTS = ["calculator", "grid of squares", "spreadsheet", "pie chart", "bar chart", "generic phone", "gear cog"];
  const inspirationDirection = INSPIRATION_DIRECTIONS[Math.floor(Math.random() * INSPIRATION_DIRECTIONS.length)];

  const prompt = `You are a world-class brand identity designer creating a premium iOS app icon. Your goal is a unique, memorable icon that captures this app's BRAND ESSENCE — not its tool category.

App URL: ${targetUrl}
Page title: ${title || "(none)"}
Page content: ${bodyText || "(none)"}

STEP 1 — Creative brief:
- Think about what makes this brand DISTINCTIVE, not just what it does functionally
- Today's creative direction: **${inspirationDirection}** — your concept must lean into this style
- FORBIDDEN concepts (overused, avoid entirely): ${AVOID_CONCEPTS.join(", ")}
- Choose a concept that would be surprising yet immediately recognizable for this brand
- Write your concept as: CONCEPT: <specific concept in English>

STEP 2 — Generate the SVG with these rules:
- viewBox="0 0 100 100", no width/height attributes on <svg>
- Put all <defs> (gradients) inside a <defs> block at the top of the SVG
- Background: <rect width="100" height="100" rx="0" fill="url(#bg)"/> using a linearGradient from ${scheme.bg[0]} to ${scheme.bg[1]} (top-left → bottom-right)
- Icon symbol: centered in the 100×100 space, occupying 65–75% of the area
  - Use 2–3 harmonious colors from this palette: primary ${scheme.icon[0]}, secondary ${scheme.icon[1]}, optional accent ${scheme.accent}
  - You may apply a linearGradient to icon shapes too for a more natural feel
  - Different parts of the icon can use different colors from the palette
- Design should feel modern, confident, and polished — not overly simple
- NO shadows (no filter, no drop-shadow)
- NO stroke on the background rect
- NO rounded corners on the background rect (rx="0")${colorNote}

Output format (exactly):
CONCEPT: <icon concept in English>
SVG: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">...</svg>`;

  const timeout = createTimeoutController(APP_LOGO_AI_TIMEOUT_MS);
  try {
    const response = await fetch(ANTHROPIC_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      signal: timeout.signal,
      body: JSON.stringify({
        model: ANTHROPIC_MODEL,
        max_tokens: 2000,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) return null;
    const data = await response.json();
    const raw = (data?.content?.[0]?.text || "").trim();

    const conceptMatch = raw.match(/CONCEPT:\s*(.+)/i);
    // Handle plain SVG: <svg...> and markdown-wrapped SVG: ```xml\n<svg...>\n```
    const svgMatch =
      raw.match(/SVG:\s*(?:```(?:svg|xml|html)?\s*\n?)?(<svg[\s\S]*?<\/svg>)/i) ||
      raw.match(/(<svg[\s\S]*?<\/svg>)/i);

    // Force sharp corners on background rect regardless of what Claude generated
    let svgOutput = svgMatch ? svgMatch[1].trim() : null;
    if (svgOutput) {
      svgOutput = svgOutput.replace(
        /(<rect\b[^>]*\bwidth=["']100["'][^>]*\bheight=["']100["'][^>]*?)\srx=["'][^"']*["']/gi,
        '$1 rx="0"'
      ).replace(
        /(<rect\b[^>]*\bheight=["']100["'][^>]*\bwidth=["']100["'][^>]*?)\srx=["'][^"']*["']/gi,
        '$1 rx="0"'
      );
    }

    // Compute dominant brand hue from extracted page colors
    const brandHue = pageColors.reduce((found, hex) => {
      if (found !== null) return found;
      return hexToHue(hex);
    }, null);

    return {
      concept: conceptMatch ? conceptMatch[1].trim() : "",
      svg: svgOutput,
      brandHue,
    };
  } catch (error) {
    if (error && error.name === "AbortError") return null;
    throw error;
  } finally {
    timeout.clear();
  }
}

// ─── DALL-E logo image generation ────────────────────────────────────────────

async function suggestAppLogoDalle(targetUrl) {
  if (!OPENAI_API_KEY) return null;
  const browser = await getBrowser();
  const context = await browser.newContext({
    viewport: MOBILE_VIEWPORT,
    deviceScaleFactor: 1,
    userAgent: USER_AGENT,
  });
  const page = await context.newPage();
  let title = "";
  let bodyText = "";
  let pageColors = [];
  try {
    await navigateWithFallback(page, targetUrl, APP_LOGO_PAGE_TIMEOUT_MS);
    await page.waitForTimeout(Math.min(CAPTURE_WAIT_MS, 1200));
    [title, bodyText, pageColors] = await Promise.all([
      page.title().catch(() => ""),
      page.evaluate(() => {
        const el = document.body;
        return el ? el.innerText.replace(/\s+/g, " ").slice(0, 400) : "";
      }).catch(() => ""),
      page.evaluate(() => {
        const selectors = [
          "header", "nav", "[class*='header']", "[class*='nav']",
          "button", "[class*='btn']", "[class*='button']",
          "[class*='primary']", "[class*='brand']", "[class*='logo']",
          "h1", ".hero", "[class*='hero']",
        ];
        const colorCounts = {};
        const parseRgb = (str) => {
          const m = str.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
          return m ? [+m[1], +m[2], +m[3]] : null;
        };
        const toHex = ([r, g, b]) =>
          "#" + [r, g, b].map(v => v.toString(16).padStart(2, "0")).join("");
        const isNeutral = ([r, g, b]) => {
          const max = Math.max(r, g, b), min = Math.min(r, g, b);
          const brightness = (max + min) / 2;
          const saturation = max === min ? 0 : (max - min) / (255 - Math.abs(2 * brightness - 255));
          return brightness > 230 || brightness < 15 || saturation < 0.12;
        };
        const seen = new Set();
        for (const sel of selectors) {
          const els = Array.from(document.querySelectorAll(sel)).slice(0, 5);
          for (const el of els) {
            const style = window.getComputedStyle(el);
            for (const prop of ["backgroundColor", "color", "borderColor"]) {
              const rgb = parseRgb(style[prop] || "");
              if (!rgb || isNeutral(rgb)) continue;
              const hex = toHex(rgb);
              if (seen.has(hex)) { colorCounts[hex] = (colorCounts[hex] || 0) + 1; }
              else { seen.add(hex); colorCounts[hex] = 1; }
            }
          }
        }
        return Object.entries(colorCounts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(([hex]) => hex);
      }).catch(() => []),
    ]);
  } finally {
    await page.close().catch(() => {});
    await context.close().catch(() => {});
  }

  const appName = title || new URL(targetUrl).hostname.replace(/^www\./, "");
  const colorHint = pageColors.length > 0
    ? ` Use these brand colors prominently: ${pageColors.join(", ")}.`
    : "";
  const descHint = bodyText ? ` The app is about: ${bodyText.slice(0, 200)}.` : "";

  const dallePrompt = `A single square app icon graphic for "${appName}".${descHint} The icon is a flat 1:1 square filled entirely with a solid or gradient background color. In the center, a bold minimal symbol or illustration representing the app's purpose, occupying about 60% of the canvas.${colorHint} No text, no letters, no words, no device frame, no phone mockup, no UI elements, no app store listing, no screenshot, no card, no shadow border. Just the raw square icon artwork itself, filling the entire image.`;

  const timeout = createTimeoutController(DALLE_LOGO_AI_TIMEOUT_MS);
  try {
    const response = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
      },
      signal: timeout.signal,
      body: JSON.stringify({
        model: "dall-e-3",
        prompt: dallePrompt,
        n: 1,
        size: "1024x1024",
        response_format: "b64_json",
      }),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      console.error("[dalle-logo] API error:", errText);
      return null;
    }

    const data = await response.json();
    const b64 = data?.data?.[0]?.b64_json;
    if (!b64) return null;

    const brandHue = pageColors.reduce((found, hex) => {
      if (found !== null) return found;
      return hexToHue(hex);
    }, null);

    return {
      concept: appName,
      imageDataUrl: `data:image/png;base64,${b64}`,
      brandHue,
    };
  } catch (error) {
    if (error && error.name === "AbortError") return null;
    throw error;
  } finally {
    timeout.clear();
  }
}

// ─── Qwen Image (DashScope) logo generation ───────────────────────────────────

async function suggestAppLogoQwen(targetUrl) {
  if (!DASHSCOPE_API_KEY) return null;
  const browser = await getBrowser();
  const context = await browser.newContext({
    viewport: MOBILE_VIEWPORT,
    deviceScaleFactor: 1,
    userAgent: USER_AGENT,
  });
  const page = await context.newPage();
  let title = "";
  let bodyText = "";
  let pageColors = [];
  try {
    await navigateWithFallback(page, targetUrl, APP_LOGO_PAGE_TIMEOUT_MS);
    await page.waitForTimeout(Math.min(CAPTURE_WAIT_MS, 1200));
    [title, bodyText, pageColors] = await Promise.all([
      page.title().catch(() => ""),
      page.evaluate(() => {
        const el = document.body;
        return el ? el.innerText.replace(/\s+/g, " ").slice(0, 400) : "";
      }).catch(() => ""),
      page.evaluate(() => {
        const selectors = [
          "header", "nav", "[class*='header']", "[class*='nav']",
          "button", "[class*='btn']", "[class*='button']",
          "[class*='primary']", "[class*='brand']", "[class*='logo']",
          "h1", ".hero", "[class*='hero']",
        ];
        const colorCounts = {};
        const parseRgb = (str) => {
          const m = str.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
          return m ? [+m[1], +m[2], +m[3]] : null;
        };
        const toHex = ([r, g, b]) =>
          "#" + [r, g, b].map(v => v.toString(16).padStart(2, "0")).join("");
        const isNeutral = ([r, g, b]) => {
          const max = Math.max(r, g, b), min = Math.min(r, g, b);
          const brightness = (max + min) / 2;
          const saturation = max === min ? 0 : (max - min) / (255 - Math.abs(2 * brightness - 255));
          return brightness > 230 || brightness < 15 || saturation < 0.12;
        };
        const seen = new Set();
        for (const sel of selectors) {
          const els = Array.from(document.querySelectorAll(sel)).slice(0, 5);
          for (const el of els) {
            const style = window.getComputedStyle(el);
            for (const prop of ["backgroundColor", "color", "borderColor"]) {
              const rgb = parseRgb(style[prop] || "");
              if (!rgb || isNeutral(rgb)) continue;
              const hex = toHex(rgb);
              if (seen.has(hex)) { colorCounts[hex] = (colorCounts[hex] || 0) + 1; }
              else { seen.add(hex); colorCounts[hex] = 1; }
            }
          }
        }
        return Object.entries(colorCounts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(([hex]) => hex);
      }).catch(() => []),
    ]);
  } finally {
    await page.close().catch(() => {});
    await context.close().catch(() => {});
  }

  const appName = title || new URL(targetUrl).hostname.replace(/^www\./, "");
  const colorHint = pageColors.length > 0
    ? `背景色调参考品牌色：${pageColors.join("、")}，`
    : "";
  const descHint = bodyText ? `应用功能描述：${bodyText.slice(0, 200)}。` : "";

  const QWEN_STYLES = [
    "3D质感渲染，光泽高光，细腻材质感，类似苹果官方应用图标的立体效果",
    "流光渐变色，丝滑光泽，玻璃质感，色彩从深到浅过渡自然，Dribbble热门风格",
    "毛玻璃磨砂质感，半透明叠层，柔和光晕，现代iOS设计风格",
    "精致插画风，细腻线条，柔和色块，Dribbble获赞插画图标风格",
    "霓虹发光效果，深色背景，图标元素带有柔和外发光，赛博朋克与苹果设计结合",
    "粘土3D风格，圆润可爱，鲜艳饱和色，Dribbble流行的claymorphism风格",
  ];
  const style = QWEN_STYLES[Math.floor(Math.random() * QWEN_STYLES.length)];

  const prompt = `请生成一个精致的Apple App Store应用图标，正方形构图，无任何圆角裁切。

应用名称：${appName}
${descHint}
设计风格：${style}
${colorHint}

要求：
- 主体图标元素简洁有力、充满吸引力，精准体现应用的核心功能或品牌感
- 图标主体元素居中，占画面60%~70%，背景为纯色或正方形渐变色，干净不杂乱
- 整体质感精致，达到Dribbble高赞作品或苹果官方图标的水准
- 禁止出现任何文字、字母、数字
- 禁止出现手机边框、截图、卡片、UI界面等元素
- 只输出图标本身，不要任何外框或装饰边`;

  // Use DashScope multimodal-generation endpoint (synchronous)
  const timeout = createTimeoutController(DALLE_LOGO_AI_TIMEOUT_MS);
  try {
    const response = await fetch("https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${DASHSCOPE_API_KEY}`,
      },
      signal: timeout.signal,
      body: JSON.stringify({
        model: "qwen-image-2.0",
        input: {
          messages: [
            { role: "user", content: [{ text: prompt }] }
          ],
        },
        parameters: { size: "512*512" },
      }),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      console.error("[qwen-logo] API error:", response.status, errText);
      return null;
    }

    const data = await response.json();
    // Response: output.choices[0].message.content[0].image (URL)
    const imageUrl = data?.output?.choices?.[0]?.message?.content?.[0]?.image;
    if (!imageUrl) {
      console.error("[qwen-logo] no image url in response:", JSON.stringify(data).slice(0, 300));
      return null;
    }

    // Download image and convert to base64 for consistent handling
    const imgRes = await fetch(imageUrl);
    const buffer = Buffer.from(await imgRes.arrayBuffer());

    const brandHue = pageColors.reduce((found, hex) => {
      if (found !== null) return found;
      return hexToHue(hex);
    }, null);
    return {
      concept: appName,
      imageDataUrl: `data:image/png;base64,${buffer.toString("base64")}`,
      brandHue,
    };
  } catch (error) {
    if (error && error.name === "AbortError") return null;
    throw error;
  } finally {
    timeout.clear();
  }
}

// ─── HTTP Server ──────────────────────────────────────────────────────────────

const server = http.createServer(async (req, res) => {
  if (!req.url) { sendJson(res, 400, { error: "Missing URL" }); return; }

  if (req.method === "OPTIONS") {
    setCorsHeaders(res); res.writeHead(204); res.end(); return;
  }

  const requestUrl = new URL(req.url, `http://127.0.0.1:${PORT}`);

  if (req.method === "GET" && requestUrl.pathname === "/health") {
    sendJson(res, 200, { ok: true }); return;
  }

  // Serve preview.html at root and /preview.html
  if (req.method === "GET" && (requestUrl.pathname === "/" || requestUrl.pathname === "/preview.html")) {
    sendStaticFile(res, path.resolve(__dirname, "..", "preview.html"), "text/html; charset=utf-8"); return;
  }

  // Serve design-gallery.html (visual element preview for development)
  if (req.method === "GET" && requestUrl.pathname === "/design-gallery.html") {
    sendStaticFile(res, path.resolve(__dirname, "..", "design-gallery.html"), "text/html; charset=utf-8"); return;
  }

  // Serve render-engine.js (shared rendering functions for preview + gallery)
  if (req.method === "GET" && requestUrl.pathname === "/render-engine.js") {
    sendStaticFile(res, path.resolve(__dirname, "..", "render-engine.js"), "application/javascript; charset=utf-8"); return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/assets/iphone-mockup.png") {
    sendStaticFile(res, PHONE_MOCKUP_PATH, "image/png"); return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/api/preview") {
    try {
      const targetUrl = normalizeUrl(requestUrl.searchParams.get("url"));
      sendJson(res, 200, await capturePreview(targetUrl));
    } catch (err) {
      sendJson(res, 500, { error: err.message });
    }
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/api/suggest-app-name") {
    try {
      const targetUrl = normalizeUrl(requestUrl.searchParams.get("url"));
      const name = await suggestAppName(targetUrl);
      sendJson(res, 200, { name });
    } catch (err) {
      sendJson(res, 500, { error: err.message });
    }
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/api/suggest-app-logo") {
    try {
      const targetUrl = normalizeUrl(requestUrl.searchParams.get("url"));
      const result = await suggestAppLogo(targetUrl);
      sendJson(res, 200, result || { svg: null, concept: "" });
    } catch (err) {
      sendJson(res, 500, { error: err.message });
    }
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/api/suggest-app-logo-dalle") {
    try {
      const targetUrl = normalizeUrl(requestUrl.searchParams.get("url"));
      const result = await suggestAppLogoDalle(targetUrl);
      sendJson(res, 200, result || { imageDataUrl: null, concept: "" });
    } catch (err) {
      sendJson(res, 500, { error: err.message });
    }
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/api/suggest-app-logo-qwen") {
    try {
      const targetUrl = normalizeUrl(requestUrl.searchParams.get("url"));
      const result = await suggestAppLogoQwen(targetUrl);
      sendJson(res, 200, result || { imageDataUrl: null, concept: "" });
    } catch (err) {
      sendJson(res, 500, { error: err.message });
    }
    return;
  }

  if (req.method === "POST" && requestUrl.pathname === "/api/oneclick-capture") {
    try {
      const body = await readRequestBody(req);
      const payload = body ? JSON.parse(body) : {};
      const url = normalizeUrl(payload.url);
      const routes = Array.isArray(payload.routes) ? payload.routes.filter(Boolean) : [];
      const rawLangs = Array.isArray(payload.languages) ? payload.languages : ["en"];
      const languages = rawLangs.filter((l) => ["zh", "en"].includes(l));
      if (!languages.length) languages.push("en");

      const job = {
        id: createJobId(),
        status: "running",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        expiresAt: Date.now() + JOB_TTL_MS,
        total: 0,
        completed: 0,
        url,
        routes,
        languages,
        appNameHint: String(payload.appName || "").trim(),
        descriptionHint: String(payload.description || "").trim(),
        brandHue: Number.isFinite(payload.brandHue) ? payload.brandHue : null,
        screenshots: [],
        recipe: null,
        events: [],
        error: null,
      };

      captureJobs.set(job.id, job);
      pushJobEvent(job, "ok", `✦ OneClick 启动：${url}`);

      // Run async, don't await
      runOneclickPipeline(job).catch((err) => {
        job.status = "failed";
        job.error = err.message;
        pushJobEvent(job, "error", err.message);
      });

      sendJson(res, 201, { jobId: job.id, status: job.status });
    } catch (err) {
      sendJson(res, 400, { error: err.message });
    }
    return;
  }

  if (req.method === "GET" && requestUrl.pathname.startsWith("/api/capture-jobs/")) {
    const jobId = requestUrl.pathname.split("/").pop();
    const job = jobId ? captureJobs.get(jobId) : null;
    if (!job) { sendJson(res, 404, { error: "Job not found" }); return; }
    sendJson(res, 200, serializeJob(job)); return;
  }

  if (req.method === "POST" && requestUrl.pathname === "/api/render-exports") {
    try {
      const body = await readRequestBody(req, 250 * 1024 * 1024);
      const payload = body ? JSON.parse(body) : {};
      sendJson(res, 201, await renderExportFilesToDisk(payload));
    } catch (err) {
      sendJson(res, 400, { error: err.message });
    }
    return;
  }

  if (req.method === "POST" && requestUrl.pathname === "/api/export-files") {
    try {
      const body = await readRequestBody(req, 250 * 1024 * 1024);
      const payload = body ? JSON.parse(body) : {};
      sendJson(res, 201, exportFilesToDisk(payload));
    } catch (err) {
      sendJson(res, 400, { error: err.message });
    }
    return;
  }

  sendJson(res, 404, { error: "Not found" });
});

server.listen(PORT, "127.0.0.1", () => {
  cleanupExpiredJobs();
  console.log(`✦ OneClick screenshot server running at http://127.0.0.1:${PORT}`);
  console.log(`  ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY ? "✅ configured" : "⚠️  not set (fallback copy will be used)"}`);
  console.log(`  Export directory: ${EXPORT_OUTPUT_DIR}`);
});

setInterval(cleanupExpiredJobs, 1000 * 60 * 5).unref();

async function shutdown() {
  server.close();
  if (browserPromise) {
    const browser = await browserPromise.catch(() => null);
    if (browser) await browser.close().catch(() => {});
  }
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
