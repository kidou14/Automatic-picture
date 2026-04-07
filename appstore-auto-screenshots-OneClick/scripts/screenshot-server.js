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
const MOBILE_VIEWPORT = { width: 390, height: 844 };
const DEVICE_SCALE = 3;
const USER_AGENT =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
const CAPTURE_WAIT_MS = Number.parseInt(process.env.CAPTURE_WAIT_MS || "1200", 10);
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
  { font: '"SF Pro Display", "Inter", -apple-system, sans-serif', weight: 800, tracking: "-0.03em" },
  { font: '"Playfair Display", "Georgia", serif', weight: 700, tracking: "-0.02em" },
  { font: '"Space Grotesk", "Trebuchet MS", sans-serif', weight: 700, tracking: "-0.025em" },
  { font: '"Iowan Old Style", "Palatino Linotype", "Book Antiqua", serif', weight: 700, tracking: "-0.01em" },
  { font: '"Avenir Next Condensed", "Gill Sans", "Trebuchet MS", sans-serif', weight: 800, tracking: "-0.02em" },
  { font: '"DM Serif Display", "Times New Roman", serif', weight: 400, tracking: "0em" },
  { font: '"Sora", "Segoe UI", sans-serif', weight: 800, tracking: "-0.035em" },
  { font: '"Didot", "Bodoni MT", "Times New Roman", serif', weight: 700, tracking: "0.01em" },
  { font: '"Raleway", "Century Gothic", sans-serif', weight: 800, tracking: "-0.02em" },
  { font: '"Cormorant Garamond", "Garamond", "Georgia", serif', weight: 600, tracking: "0.01em" },
  { font: '"Outfit", "Nunito", sans-serif', weight: 800, tracking: "-0.025em" },
  { font: '"Fraunces", "Georgia", serif', weight: 700, tracking: "-0.01em" },
  { font: '"Cabinet Grotesk", "Helvetica Neue", sans-serif', weight: 800, tracking: "-0.04em" },
  { font: '"Libre Baskerville", "Baskerville", serif', weight: 700, tracking: "-0.01em" },
  { font: '"Plus Jakarta Sans", "system-ui", sans-serif', weight: 800, tracking: "-0.03em" },
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
];

const POSITIONS = ["top-right", "bottom-left", "top-left", "bottom-right", "center-left", "center-right"];

const LAYOUTS_ALL = ["hero", "right", "left", "duo", "trust", "center", "bottom-right", "bottom-left"];

/**
 * Generate a unique Style Recipe from scratch using algorithmic color theory.
 * Each call with a different seed produces a completely different visual identity.
 */
function generateStyleRecipe(seed) {
  const rng = createRng(seed || Math.floor(Math.random() * 0xFFFFFFFF));

  const pick = (arr) => arr[Math.floor(rng() * arr.length)];
  const rand = (min, max) => min + rng() * (max - min);
  const randInt = (min, max) => Math.floor(rand(min, max));

  // ─── Color harmony ──────────────────────────────────────────────────────────
  const baseHue = randInt(0, 360);
  const harmony = pick(["complementary", "triadic", "analogous", "split-complementary", "monochromatic"]);
  const colorMode = pick(["light", "light", "dark", "dark", "warm-light", "cool-dark", "earthy", "neon-dark", "pastel"]);

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
    case "light":
      bgL = randInt(92, 97); bgS = randInt(10, 30);
      accentS = randInt(55, 85); accentL = randInt(40, 55);
      textHex = hslToHex(baseHue, randInt(15, 30), randInt(10, 18));
      bgGradientShift = randInt(-10, 10);
      break;
    case "dark":
      bgL = randInt(8, 15); bgS = randInt(15, 35);
      accentS = randInt(65, 90); accentL = randInt(55, 70);
      textHex = hslToHex(baseHue, randInt(5, 15), randInt(88, 96));
      bgGradientShift = randInt(-15, 15);
      break;
    case "warm-light":
      bgHue = randInt(20, 45);
      bgL = randInt(90, 96); bgS = randInt(20, 45);
      accentS = randInt(50, 75); accentL = randInt(42, 58);
      textHex = hslToHex(randInt(15, 35), randInt(20, 35), randInt(10, 20));
      bgGradientShift = randInt(5, 20);
      break;
    case "cool-dark":
      bgHue = randInt(200, 260);
      bgL = randInt(7, 14); bgS = randInt(20, 40);
      accentS = randInt(70, 95); accentL = randInt(55, 72);
      textHex = hslToHex(bgHue, randInt(5, 15), randInt(88, 96));
      bgGradientShift = randInt(-20, -5);
      break;
    case "earthy":
      bgHue = randInt(25, 50);
      bgL = randInt(88, 94); bgS = randInt(15, 35);
      accentS = randInt(40, 65); accentL = randInt(38, 55);
      textHex = hslToHex(randInt(20, 40), randInt(20, 35), randInt(10, 18));
      bgGradientShift = randInt(8, 18);
      break;
    case "neon-dark":
      bgHue = randInt(220, 280);
      bgL = randInt(5, 12); bgS = randInt(25, 50);
      accentS = randInt(85, 100); accentL = randInt(55, 70);
      textHex = "#f0f4ff";
      bgGradientShift = randInt(-10, 10);
      break;
    case "pastel":
      bgL = randInt(93, 97); bgS = randInt(15, 30);
      accentS = randInt(35, 55); accentL = randInt(55, 70);
      textHex = hslToHex(baseHue, randInt(15, 25), randInt(15, 22));
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

  // ─── Typography ─────────────────────────────────────────────────────────────
  const fontPairing = pick(FONT_PAIRINGS);
  const typography = {
    font: fontPairing.font,
    headlineWeight: fontPairing.weight,
    headlineTracking: fontPairing.tracking,
    headlineSize: parseFloat((0.086 + rng() * 0.018).toFixed(3)),
    subtitleWeight: 400,
    subtitleSize: parseFloat((0.035 + rng() * 0.008).toFixed(3)),
    kickerSize: parseFloat((0.026 + rng() * 0.006).toFixed(3)),
    kickerTracking: parseFloat((0.06 + rng() * 0.08).toFixed(2)) + "em",
    kickerWeight: pick([500, 600, 700]),
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
  const glassReflection = (colorMode === 'light' || colorMode === 'pastel' || colorMode === 'warm-light') && rng() < 0.55;

  return { mood, harmony, colorMode, palette, typography, decorations, layouts, seed, ghostFrames, glassReflection };
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
    ? "IMPORTANT: You MUST write ALL text (kicker, headline, subtitle) in Simplified Chinese (简体中文). Do NOT use any English words."
    : "Write all copy in English.";
  const exampleSlide = isZh
    ? `{ "index": 0, "layout": "hero", "kicker": "产品亮点", "headline": "更智能\\n更轻松", "subtitle": "专注真正重要的事" }`
    : `{ "index": 0, "layout": "hero", "kicker": "Smart & Simple", "headline": "Work Smarter\\nNot Harder", "subtitle": "Built for how you work." }`;

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
- Use \\n to break headlines across exactly 2 lines
- Never write feature lists or buzzwords
- Match the mood: "${recipe.mood}"
${isZh ? `- Headline: each line must be ≤6 Chinese characters (≤6字/行). No punctuation.
- Subtitle: ≤10 Chinese characters total. No punctuation. ONE phrase expressing a single thought — never "A，B" or "A、B" structure.
- Kicker: ≤6 Chinese characters. No punctuation.
- FORBIDDEN subtitle patterns (two clauses = always wrong):
    "专业工具助力决策、开启新时代"  ← two clauses with 、
    "智能分析交易，提升表现"        ← two clauses with ，
    "记录成长，超越自我"            ← two clauses with ，
- CORRECT subtitle patterns (single thought = always right):
    "专注真正重要的事"
    "让数据替你说话"
    "每次交易都算数"` : `- Headline: each line must be ≤20 characters including spaces. No punctuation.
- Subtitle: ≤25 characters total. No punctuation. ONE direct phrase — never "A, B" structure.
- Kicker: ≤20 characters. No punctuation.
- FORBIDDEN: "Track your trades, boost your gains" ← two clauses with comma
- CORRECT: "Trade with more confidence"`}

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
    kicker:   clean(slide.kicker),
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
  const kickers = lang === "zh"
    ? ["产品介绍", "功能 01", "功能 02", "功能 03", "功能 04", "功能 05"]
    : ["Introducing", "Feature 01", "Feature 02", "Feature 03", "Feature 04", "Feature 05"];
  const subtitle = lang === "zh"
    ? "专注真正重要的事"
    : "Built for how you work.";

  return layouts.map((layout, i) => ({
    index: i,
    layout,
    kicker: kickers[i] || (lang === "zh" ? `功能 ${String(i).padStart(2, "0")}` : `Feature ${String(i).padStart(2, "0")}`),
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

async function navigateWithFallback(page, targetUrl) {
  try {
    await page.goto(targetUrl, { waitUntil: "networkidle", timeout: 60000 });
  } catch {
    try { await page.goto(targetUrl, { waitUntil: "load", timeout: 60000 }); }
    catch { try { await page.goto(targetUrl, { waitUntil: "domcontentloaded", timeout: 60000 }); }
      catch { await page.goto(targetUrl, { waitUntil: "commit", timeout: 60000 }); } }
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
  let totalDiff = 0;
  for (let i = 0; i < a.samples.length; i++) {
    totalDiff += Math.abs(a.samples[i] - b.samples[i]);
  }
  // Average channel delta < 20 / 255 (~8%) → treat as same visual content
  return (totalDiff / a.samples.length) < 20;
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
    job.recipe = generateStyleRecipe(seed);
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

  return { count: savedFiles.length, directory: saveDir, files: savedFiles };
}

async function renderExportFileBuffer(browser, file) {
  const width = Math.max(1, Number.parseInt(file.width, 10) || 0);
  const height = Math.max(1, Number.parseInt(file.height, 10) || 0);
  const markup = String(file.markup || "").trim();
  const styles = String(file.styles || "");
  if (!markup) throw new Error("Empty export content");

  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 });
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
