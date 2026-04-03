#!/usr/bin/env node
/**
 * screenshot-server.js — Local Playwright screenshot API for preview.html
 *
 * Usage:
 *   node scripts/screenshot-server.js
 *
 * Endpoints:
 *   GET /health
 *   GET /api/preview?url=<encoded-url>
 *   POST /api/capture-jobs
 *   GET /api/capture-jobs/:jobId
 */

const http = require("http");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { URL } = require("url");

loadLocalEnv();

const PORT = Number.parseInt(process.env.PORT || "4317", 10);
const ANTHROPIC_API_URL = process.env.ANTHROPIC_API_URL || "https://api.anthropic.com/v1/messages";
const ANTHROPIC_API_KEY = String(process.env.ANTHROPIC_API_KEY || "").trim();
const ANTHROPIC_MODEL = String(process.env.ANTHROPIC_MODEL || "claude-sonnet-4-20250514").trim();
const OPENAI_API_URL = process.env.OPENAI_API_URL || "https://api.openai.com/v1/responses";
const OPENAI_API_KEY = String(process.env.OPENAI_API_KEY || "").trim();
const OPENAI_MODEL = String(process.env.OPENAI_MODEL || "gpt-4.1-mini").trim();
const MOBILE_VIEWPORT = { width: 390, height: 844 };
const DESKTOP_VIEWPORT = { width: 1440, height: 900 };
const DEVICE_SCALE = 3;
const USER_AGENT =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
const CAPTURE_WAIT_MS = Number.parseInt(process.env.CAPTURE_WAIT_MS || "1200", 10);
const CACHE_TTL_MS = 1000 * 60 * 5;
const JOB_TTL_MS = 1000 * 60 * 30;
const MAX_JOB_EVENTS = 200;
const EXPORT_OUTPUT_DIR = String(process.env.EXPORT_OUTPUT_DIR || path.join(os.homedir(), "Downloads", "appstore-auto-screenshots")).trim();
const PHONE_MOCKUP_PATH = path.resolve(
  __dirname,
  "..",
  "..",
  "app-store-screenshots-main",
  "skills",
  "app-store-screenshots",
  "mockup.png"
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

function loadLocalEnv() {
  const candidates = [
    path.resolve(process.cwd(), ".env.local"),
    path.resolve(__dirname, "..", "..", ".env.local"),
    path.resolve(__dirname, "..", ".env.local"),
  ];

  for (const filePath of candidates) {
    if (!fs.existsSync(filePath)) {
      continue;
    }

    const source = fs.readFileSync(filePath, "utf8");
    source.split(/\r?\n/).forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) {
        return;
      }

      const separatorIndex = trimmed.indexOf("=");
      if (separatorIndex <= 0) {
        return;
      }

      const key = trimmed.slice(0, separatorIndex).trim();
      if (!key || process.env[key]) {
        return;
      }

      let value = trimmed.slice(separatorIndex + 1).trim();
      if (
        (value.startsWith("\"") && value.endsWith("\"")) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }

      process.env[key] = value;
    });

    return;
  }
}

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
  res.writeHead(200, {
    "Content-Type": contentType,
    "Cache-Control": "public, max-age=86400",
  });
  fs.createReadStream(filePath).pipe(res);
}

function readRequestBody(req, maxBytes = 1_000_000) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > maxBytes) {
        reject(new Error("Request body too large"));
        req.destroy();
      }
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

function ensureDirectory(targetDir) {
  fs.mkdirSync(targetDir, { recursive: true });
  return targetDir;
}

function sanitizeFilename(value, fallback = "export.png") {
  const normalized = String(value || "").trim().replace(/[/\\?%*:|"<>]/g, "-");
  const safe = normalized.replace(/\s+/g, " ").trim();
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
    if (!fs.existsSync(candidatePath)) {
      return { filename: candidateName, filePath: candidatePath };
    }
    attempt += 1;
  }
}

function buildUniqueDirectory(baseDir, requestedName) {
  const safeName = sanitizeFilename(requestedName, "export-batch").replace(/\.[a-z0-9]+$/i, "");
  let attempt = 0;

  while (true) {
    const candidateName = attempt === 0 ? safeName : `${safeName}-${attempt + 1}`;
    const candidatePath = path.join(baseDir, candidateName);
    if (!fs.existsSync(candidatePath)) {
      fs.mkdirSync(candidatePath, { recursive: true });
      return candidatePath;
    }
    attempt += 1;
  }
}

function decodeImageDataUrl(imageDataUrl) {
  const value = String(imageDataUrl || "").trim();
  const match = value.match(/^data:image\/png;base64,(.+)$/);
  if (!match) {
    throw new Error("只支持 PNG data URL 导出");
  }
  return Buffer.from(match[1], "base64");
}

function exportFilesToDisk(payload) {
  const files = Array.isArray(payload && payload.files) ? payload.files.filter(Boolean) : [];
  if (!files.length) {
    throw new Error("没有可导出的 PNG 文件");
  }

  const baseDir = ensureDirectory(EXPORT_OUTPUT_DIR);
  const saveDir = files.length === 1 && !payload.folderName
    ? baseDir
    : buildUniqueDirectory(baseDir, payload.folderName || `export-${Date.now()}`);

  const savedFiles = files.map((file, index) => {
    const buffer = decodeImageDataUrl(file.imageDataUrl);
    const requestedName = sanitizeFilename(file.filename, `export-${index + 1}.png`);
    const { filename, filePath } = buildUniqueFilePath(saveDir, requestedName);
    fs.writeFileSync(filePath, buffer);

    return {
      filename,
      path: filePath,
      bytes: buffer.length,
    };
  });

  return {
    count: savedFiles.length,
    directory: saveDir,
    files: savedFiles,
  };
}

async function waitForRenderAssets(page) {
  await page.evaluate(async () => {
    if (document.fonts && document.fonts.ready) {
      await document.fonts.ready.catch(() => {});
    }

    const images = Array.from(document.images || []);
    await Promise.all(images.map((image) => {
      if (image.complete) {
        return Promise.resolve();
      }

      return new Promise((resolve) => {
        image.addEventListener("load", resolve, { once: true });
        image.addEventListener("error", resolve, { once: true });
      });
    }));
  });
}

async function renderExportFileBuffer(browser, file) {
  const width = Math.max(1, Number.parseInt(file.width, 10) || 0);
  const height = Math.max(1, Number.parseInt(file.height, 10) || 0);
  const markup = String(file.markup || "").trim();
  const styles = String(file.styles || "");

  if (!markup) {
    throw new Error("导出内容为空");
  }

  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();

  try {
    await page.setContent(
      `<!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <style>
            html, body {
              margin: 0;
              padding: 0;
              background: transparent;
            }
            #capture-root {
              width: ${width}px;
              height: ${height}px;
              overflow: hidden;
            }
            ${styles}
          </style>
        </head>
        <body>
          <div id="capture-root">${markup}</div>
        </body>
      </html>`,
      { waitUntil: "load" }
    );
    await waitForRenderAssets(page);
    await page.waitForTimeout(80);
    return await page.locator("#capture-root").screenshot({ type: "png" });
  } finally {
    await page.close().catch(() => {});
    await context.close().catch(() => {});
  }
}

async function renderExportFilesToDisk(payload) {
  const files = Array.isArray(payload && payload.files) ? payload.files.filter(Boolean) : [];
  if (!files.length) {
    throw new Error("没有可导出的截图内容");
  }

  const browser = await getBrowser();
  const baseDir = ensureDirectory(EXPORT_OUTPUT_DIR);
  const saveDir = files.length === 1 && !payload.folderName
    ? baseDir
    : buildUniqueDirectory(baseDir, payload.folderName || `export-${Date.now()}`);

  const savedFiles = [];
  for (let index = 0; index < files.length; index += 1) {
    const file = files[index];
    const buffer = await renderExportFileBuffer(browser, file);
    const requestedName = sanitizeFilename(file.filename, `export-${index + 1}.png`);
    const { filename, filePath } = buildUniqueFilePath(saveDir, requestedName);
    fs.writeFileSync(filePath, buffer);
    savedFiles.push({
      filename,
      path: filePath,
      bytes: buffer.length,
    });
  }

  return {
    count: savedFiles.length,
    directory: saveDir,
    files: savedFiles,
  };
}

function createJobId() {
  return `job_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function cleanupExpiredJobs() {
  const now = Date.now();
  for (const [jobId, job] of captureJobs.entries()) {
    if (job.expiresAt <= now) {
      captureJobs.delete(jobId);
    }
  }
}

function serializeJob(job) {
  return {
    id: job.id,
    status: job.status,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    expiresAt: job.expiresAt,
    total: job.total,
    completed: job.completed,
    url: job.url,
    requestedMode: job.requestedMode,
    requestSignature: job.requestSignature,
    captureMode: job.captureMode || null,
    routes: job.routes,
    slideCount: job.slideCount,
    screenshots: job.screenshots,
    copyPlan: job.copyPlan || null,
    copySource: job.copySource || null,
    events: job.events,
    error: job.error || null,
  };
}

function pushJobEvent(job, level, message) {
  job.events.push({
    id: `${job.id}_${job.events.length + 1}`,
    level,
    message,
    timestamp: new Date().toISOString(),
  });

  if (job.events.length > MAX_JOB_EVENTS) {
    job.events.shift();
  }

  job.updatedAt = new Date().toISOString();
  job.expiresAt = Date.now() + JOB_TTL_MS;
}

function formatCaptureError(error, targetUrl) {
  const message = error && error.message ? error.message : String(error || "Capture failed");

  if (message.includes("ERR_CONNECTION_REFUSED")) {
    return `目标地址无法连接，请先启动本地站点或改成可访问的线上 URL：${targetUrl}`;
  }

  if (message.includes("ERR_NAME_NOT_RESOLVED")) {
    return `目标域名无法解析，请检查 URL 是否正确：${targetUrl}`;
  }

  if (message.includes("Navigation timeout")) {
    return `页面加载超时，请确认目标地址能在 60 秒内打开：${targetUrl}`;
  }

  return message;
}

function buildRequestSignature(payload) {
  return JSON.stringify({
    url: payload.url,
    routes: payload.routes || [],
    slideCount: payload.slideCount || 6,
    styleId: payload.styleId || "",
    styleLabel: payload.styleLabel || "",
    appNameHint: payload.appNameHint || "",
    descriptionHint: payload.descriptionHint || "",
  });
}

function normalizeUrlForDedupe(rawUrl) {
  const parsed = new URL(rawUrl);
  if (parsed.pathname !== "/") {
    parsed.pathname = parsed.pathname.replace(/\/+$/, "") || "/";
  }
  parsed.hash = "";
  return parsed.href;
}

function toRelativeRoute(targetUrl, origin) {
  try {
    const parsed = new URL(targetUrl);
    const originUrl = new URL(origin);
    if (parsed.origin !== originUrl.origin) {
      return parsed.href;
    }
    return `${parsed.pathname || "/"}${parsed.search || ""}` || "/";
  } catch (error) {
    return targetUrl;
  }
}

function buildTargetLabel(targetUrl, fallbackIndex) {
  try {
    const parsed = new URL(targetUrl);
    const tail = parsed.pathname.split("/").filter(Boolean).pop() || "home";
    return tail.replace(/\.[a-z0-9]+$/i, "") || `page-${fallbackIndex}`;
  } catch (error) {
    return `page-${fallbackIndex}`;
  }
}

async function collectSameOriginLinks(page, currentUrl, origin) {
  const links = await page.$$eval("a[href]", (anchors) =>
    anchors
      .map((anchor) => anchor.getAttribute("href") || "")
      .filter(Boolean)
  ).catch(() => []);

  const results = [];
  const seen = new Set();
  links.forEach((href) => {
    const trimmed = String(href || "").trim();
    if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith("javascript:") || trimmed.startsWith("mailto:") || trimmed.startsWith("tel:")) {
      return;
    }

    try {
      const absolute = new URL(trimmed, currentUrl);
      if (!["http:", "https:"].includes(absolute.protocol)) {
        return;
      }
      if (absolute.origin !== origin) {
        return;
      }

      absolute.hash = "";
      const normalized = normalizeUrlForDedupe(absolute.href);
      if (seen.has(normalized)) {
        return;
      }
      seen.add(normalized);
      results.push(normalized);
    } catch (error) {
      // Ignore malformed hrefs.
    }
  });

  return results;
}

async function discoverCaptureTargets(job, page) {
  const maxCount = Math.max(1, job.slideCount || 5);
  const startUrl = normalizeUrlForDedupe(job.url);
  const origin = new URL(startUrl).origin;
  const queue = [{ url: startUrl, depth: 0 }];
  const queued = new Set([startUrl]);
  const visited = new Set();
  const targets = [];

  while (queue.length && targets.length < maxCount) {
    const current = queue.shift();
    if (!current || visited.has(current.url)) {
      continue;
    }

    visited.add(current.url);
    targets.push({
      route: toRelativeRoute(current.url, origin),
      label: buildTargetLabel(current.url, targets.length + 1),
      targetUrl: current.url,
    });

    if (current.depth >= 2 || targets.length >= maxCount) {
      continue;
    }

    try {
      await page.goto(current.url, { waitUntil: "domcontentloaded", timeout: 30000 });
      await page.waitForTimeout(400);
      const links = await collectSameOriginLinks(page, current.url, origin);
      links.forEach((link) => {
        if (targets.length + queue.length >= maxCount) {
          return;
        }
        if (!visited.has(link) && !queued.has(link)) {
          queued.add(link);
          queue.push({ url: link, depth: current.depth + 1 });
        }
      });
    } catch (error) {
      // Skip discovery failures for individual pages and keep already found pages.
    }
  }

  return targets;
}

function stripDataUrlPrefix(value) {
  return String(value || "").replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, "");
}

function getDataUrlMediaType(value, fallback = "image/png") {
  const match = String(value || "").match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,/);
  return match ? match[1] : fallback;
}

function squeezeText(value, maxLength) {
  const compact = String(value || "").replace(/\s+/g, " ").trim();
  if (!compact) {
    return "";
  }
  return compact.length > maxLength ? compact.slice(0, maxLength) : compact;
}

function hasNonLatin1(value) {
  return Array.from(String(value || "")).some((char) => char.charCodeAt(0) > 255);
}

function validateAnthropicConfig() {
  if (!ANTHROPIC_API_KEY) {
    throw new Error("未配置 ANTHROPIC_API_KEY");
  }

  if (hasNonLatin1(ANTHROPIC_API_KEY)) {
    throw new Error("ANTHROPIC_API_KEY 含有中文或非 ASCII/Latin-1 字符，请确认你填入的是真实 API Key，而不是“你的_key”这类占位文本");
  }

  if (hasNonLatin1(ANTHROPIC_API_URL)) {
    throw new Error("ANTHROPIC_API_URL 含有非 ASCII/Latin-1 字符，请检查配置");
  }
}

function validateOpenAIConfig() {
  if (!OPENAI_API_KEY) {
    throw new Error("未配置 OPENAI_API_KEY");
  }

  if (hasNonLatin1(OPENAI_API_KEY)) {
    throw new Error("OPENAI_API_KEY 含有中文或非 ASCII/Latin-1 字符，请确认你填入的是真实 API Key，而不是“你的_key”这类占位文本");
  }

  if (hasNonLatin1(OPENAI_API_URL)) {
    throw new Error("OPENAI_API_URL 含有非 ASCII/Latin-1 字符，请检查配置");
  }
}

function extractJsonObject(text) {
  const source = String(text || "").trim();
  const fenced = source.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1].trim() : source;

  try {
    return JSON.parse(candidate);
  } catch (_) {
    const start = candidate.indexOf("{");
    if (start < 0) throw new Error("No JSON object found in AI response");
    // Walk backwards from the end to find the largest valid JSON prefix
    for (let end = candidate.length - 1; end > start; end--) {
      if (candidate[end] !== "}") continue;
      try {
        return JSON.parse(candidate.slice(start, end + 1));
      } catch (_) {
        // keep scanning backwards
      }
    }
    throw new Error("Could not extract valid JSON from AI response");
  }
}

function deriveAppNameFromUrl(targetUrl) {
  try {
    const parsed = new URL(targetUrl);
    const host = parsed.hostname.replace(/^www\./, "");
    const firstPart = host.split(".").find(Boolean) || host;
    return firstPart
      .split(/[-_]/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
  } catch (error) {
    return "应用";
  }
}

function buildCopyBlueprints(job) {
  const routes = (job.screenshots || []).map((shot) => shot.route || shot.requestUrl).filter(Boolean);
  const effectiveCount = Math.max(1, Math.min(job.slideCount || 6, routes.length || job.slideCount || 6));
  const base = [
    { key: "hero", title: "主卖点", purpose: "突出核心价值", route: routes[0] || "/" },
    { key: "core", title: "核心路径", purpose: "突出主要流程", route: routes[1] || routes[0] || "/" },
    { key: "feature", title: "功能亮点", purpose: "强调差异能力", route: routes[2] || routes[1] || routes[0] || "/" },
    { key: "trust", title: "真实体验", purpose: "传达可信完成度", route: routes[3] || routes[2] || routes[0] || "/" },
    { key: "more", title: "更多场景", purpose: "承接延展价值", route: routes[4] || routes[3] || routes[0] || "/" },
  ];

  if (effectiveCount <= base.length) {
    return base.slice(0, effectiveCount);
  }

  const extras = Array.from({ length: effectiveCount - base.length }, (_, index) => ({
    key: `extra-${index + 1}`,
    title: `补充卖点 ${index + 1}`,
    purpose: "补充一个具体场景或用户收益",
    route: routes[index % routes.length] || "/",
  }));

  return [...base, ...extras];
}

function sanitizeFloatCards(rawCards) {
  if (!Array.isArray(rawCards) || !rawCards.length) return null;
  const result = rawCards
    .filter((c) => c && ["stat", "badge", "chart"].includes(c.type))
    .slice(0, 3)
    .map((c) => {
      if (c.type === "stat")   return { type: "stat",  value: squeezeText(String(c.value || ""), 8) || "↑ -", label: squeezeText(String(c.label || ""), 5) };
      if (c.type === "badge")  return { type: "badge", text: squeezeText(String(c.text || c.value || c.label || ""), 6) || "-" };
      if (c.type === "chart")  return { type: "chart", label: squeezeText(String(c.label || c.text || ""), 6) || "趋势 ↑" };
      return null;
    })
    .filter(Boolean);
  return result.length ? result : null;
}

const FLOAT_CARD_FALLBACKS = {
  hero:    [{ type: "badge", text: "核心亮点" }],
  core:    [{ type: "badge", text: "流程优化" }],
  feature: [{ type: "badge", text: "差异化" }],
  trust:   [{ type: "badge", text: "已验证" }],
  more:    [{ type: "badge", text: "更多功能" }],
};

function generateFallbackFloatCards(blueprintKey, headline) {
  if (FLOAT_CARD_FALLBACKS[blueprintKey]) {
    return FLOAT_CARD_FALLBACKS[blueprintKey];
  }
  const text = squeezeText(String(headline || blueprintKey || "亮点"), 6);
  return [{ type: "badge", text: text || "亮点" }];
}

function sanitizeCopyPlan(rawPlan, job) {
  const blueprints = buildCopyBlueprints(job);
  const slidesByKey = new Map(
    Array.isArray(rawPlan && rawPlan.slides)
      ? rawPlan.slides
          .filter(Boolean)
          .map((slide, index) => [String(slide.key || blueprints[index]?.key || index), slide])
      : []
  );

  const appName = squeezeText(
    rawPlan && rawPlan.appName
      ? rawPlan.appName
      : job.appNameHint || job.screenshots[0]?.title || deriveAppNameFromUrl(job.url),
    24
  ) || "应用";

  return {
    appName,
    slides: blueprints.map((blueprint, index) => {
      const source = slidesByKey.get(blueprint.key) || (Array.isArray(rawPlan && rawPlan.slides) ? rawPlan.slides[index] : null) || {};
      const headline = squeezeText(
        source.headline || source.titleLG || blueprint.title.replace(/\s*\/\s*/g, ""),
        7
      ) || squeezeText(blueprint.title.replace(/\s*\/\s*/g, ""), 7) || "核心亮点";
      const subheadline = squeezeText(
        source.subheadline || source.titleSM || source.subtitle || blueprint.purpose,
        12
      ) || squeezeText(blueprint.purpose, 12) || "解决关键痛点";
      return {
        key: blueprint.key,
        title: blueprint.title,
        headline,
        subheadline,
        highlight: typeof source.highlight === 'string' ? source.highlight.trim().slice(0, 4) : '',
        floatCards: sanitizeFloatCards(source.floatCards) ||
          (job.styleId === "electric-neon" ? generateFallbackFloatCards(blueprint.key, headline) : null),
      };
    }),
  };
}

function buildCopyPrompt(job, blueprints) {
  const isFloatStyle = job.styleId === "electric-neon";
  const screenshotSummary = (job.screenshots || []).slice(0, blueprints.length).map((shot, i) => {
    const route = shot.route || shot.requestUrl || "/";
    const title = shot.title || "";
    return `  slide ${i + 1} (key=${blueprints[i]?.key || i}): route=${route}${title ? ` title="${title}"` : ""}`;
  }).join("\n");

  return [
    "You are writing Apple App Store screenshot copy in Simplified Chinese.",
    "Analyze EACH screenshot individually. Every slide's content must reflect what is ACTUALLY VISIBLE in its own screenshot.",
    "Return JSON only with this shape:",
    JSON.stringify({
      appName: "应用名",
      slides: blueprints.map((item, i) => ({
        key: item.key,
        headline: "最多7个字",
        subheadline: "最多12个字",
        highlight: "1-3字",
        floatCards: i % 2 === 0
          ? [{ type: "stat", value: "该页具体数字", label: "该页对应说明" }, { type: "badge", text: "该页特有标签" }]
          : [{ type: "chart", label: "该页趋势词" }, { type: "badge", text: "该页功能名" }],
      })),
    }, null, 2),
    "Rules:",
    "- Use screenshots as the primary source of truth.",
    "- Use appNameHint/descriptionHint only as weak hints.",
    "- Use stylePrompt/styleKeywords as art-direction hints for tone only.",
    "- No placeholder wording like 未填写, URL驱动, 多页面, 自动生成.",
    "- Only output four fields per slide: headline, subheadline, highlight, floatCards.",
    "- headline must be 7 Chinese characters or fewer.",
    "- Avoid making every headline a 4-character slogan; vary headline length naturally across the set, usually between 4 and 7 Chinese characters.",
    "- headline should express the single most important feature or value of that page.",
    "- subheadline must be 12 Chinese characters or fewer.",
    "- subheadline should explain the user pain solved or the benefit unlocked.",
    "- Both lines must fit one horizontal line.",
    "- highlight: pick 1-3 key Chinese characters from the headline to visually emphasize. Every slide must have a non-empty highlight. Never use empty string.",
    "- Prefer concrete user benefit over feature jargon.",
    "- Use youthful, energetic, emotionally engaging language.",
    "- Keep copy compact because long copy will break layout.",
    isFloatStyle
      ? "CRITICAL — floatCards (electric-neon style): These cards are rendered as visible floating overlay chips on the final image. They MUST be present for EVERY slide — never omit this field or return an empty array. They MUST be unique per slide and reflect the SPECIFIC data, metrics, or features visible in that slide's screenshot. Never repeat the same card content across slides."
      : "floatCards: These are secondary data chips rendered on the visual. Include them for every slide and make them specific to each slide.",
    "floatCards rules:",
    "- floatCards is a REQUIRED field for every slide. Never omit it. Always return at least 1 card.",
    "- EACH slide's floatCards must be derived from what is visible or strongly implied in THAT slide's own screenshot — not shared generic values.",
    "- No two slides should have identical floatCard content.",
    "- Return 1 to 2 floatCards per slide.",
    "- type 'stat': specific numeric metric (value ≤8 chars, e.g.'↑24.5%','98分','3x快'). Also provide label ≤5 chars.",
    "- type 'badge': short status or feature name (text ≤6 chars, e.g.'实时信号','已验证','多头').",
    "- type 'chart': trend/time-series context (label ≤6 chars, e.g.'7日↑','胜率走势'). No value needed.",
    "- Read numbers, labels, chart titles, and UI text directly from the screenshot. Do not invent data.",
    "- If a screenshot shows no numeric data, infer the page's primary feature name as a badge card.",
    `Slide-to-screenshot mapping:\n${screenshotSummary}`,
    `styleId: ${job.styleId || "(empty)"}`,
    `styleLabel: ${job.styleLabel || "(empty)"}`,
    `styleKeywords: ${Array.isArray(job.styleKeywords) && job.styleKeywords.length ? job.styleKeywords.join(", ") : "(empty)"}`,
    `stylePrompt: ${job.stylePrompt || "(empty)"}`,
    `appNameHint: ${job.appNameHint || "(empty)"}`,
    `descriptionHint: ${job.descriptionHint || "(empty)"}`,
    `targetUrl: ${job.url}`,
    `slideBlueprints: ${JSON.stringify(blueprints)}`,
  ].join("\n");
}

function buildScreenshotInputsForAnthropic(job, blueprints) {
  const screenshotsForCopy = job.screenshots.slice(0, blueprints.length);
  return screenshotsForCopy.flatMap((shot, index) => {
    const claudeImageDataUrl = shot.copyImageDataUrl || shot.imageDataUrl;
    const textBlock = {
      type: "text",
      text: `Screenshot ${index + 1}: route=${shot.route || "/"} title=${shot.title || ""} finalUrl=${shot.finalUrl || shot.requestUrl}`,
    };
    const imageBlock = {
      type: "image",
      source: {
        type: "base64",
        media_type: getDataUrlMediaType(claudeImageDataUrl),
        data: stripDataUrlPrefix(claudeImageDataUrl),
      },
    };
    return [textBlock, imageBlock];
  });
}

function buildTextOnlyInputsForAnthropic(job, blueprints) {
  const screenshotsForCopy = job.screenshots.slice(0, blueprints.length);
  const summaryLines = screenshotsForCopy.map((shot, index) => [
    `Screenshot ${index + 1}:`,
    `route=${shot.route || "/"}`,
    `title=${shot.title || ""}`,
    `finalUrl=${shot.finalUrl || shot.requestUrl || ""}`,
  ].join(" "));

  return [
    {
      type: "text",
      text: [
        "Screenshot metadata summary:",
        ...summaryLines,
      ].join("\n"),
    },
  ];
}

function isAnthropicImageTransportError(error) {
  if (!error) {
    return false;
  }

  const message = String(error.message || error || "").toLowerCase();
  const cause = error.cause;
  const causeMessage = String(
    (cause && (cause.code || cause.message)) || "",
  ).toLowerCase();

  return (
    message.includes("fetch failed") ||
    message.includes("econnreset") ||
    causeMessage.includes("econnreset")
  );
}

function buildScreenshotInputsForOpenAI(job, blueprints) {
  const screenshotsForCopy = job.screenshots.slice(0, blueprints.length);
  return screenshotsForCopy.flatMap((shot, index) => {
    const imageDataUrl = shot.copyImageDataUrl || shot.imageDataUrl;
    return [
      {
        type: "input_text",
        text: `Screenshot ${index + 1}: route=${shot.route || "/"} title=${shot.title || ""} finalUrl=${shot.finalUrl || shot.requestUrl}`,
      },
      {
        type: "input_image",
        image_url: imageDataUrl,
        detail: "low",
      },
    ];
  });
}

function buildTextOnlyInputsForOpenAI(job, blueprints, prompt) {
  return [
    {
      role: "user",
      content: [
        { type: "input_text", text: prompt },
        ...buildTextOnlyInputsForAnthropic(job, blueprints).map((item) => ({
          type: "input_text",
          text: item.text,
        })),
      ],
    },
  ];
}

function extractOpenAIOutputText(payload) {
  if (payload && typeof payload.output_text === "string" && payload.output_text.trim()) {
    return payload.output_text;
  }

  if (!payload || !Array.isArray(payload.output)) {
    return "";
  }

  return payload.output
    .flatMap((item) => {
      if (!item || item.type !== "message" || !Array.isArray(item.content)) {
        return [];
      }
      return item.content
        .filter((contentItem) => contentItem && contentItem.type === "output_text" && contentItem.text)
        .map((contentItem) => contentItem.text);
    })
    .join("\n");
}

async function generateCopyPlanViaAnthropic(job, blueprints, prompt) {
  validateAnthropicConfig();
  const requestAnthropic = async (content, modeLabel) => {
    const response = await fetch(ANTHROPIC_API_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: ANTHROPIC_MODEL,
        max_tokens: 4096,
        temperature: 0.4,
        messages: [
          {
            role: "user",
            content,
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      throw new Error(`Claude 文案生成失败 ${response.status}${errorText ? `: ${errorText.slice(0, 300)}` : ""}`);
    }

    const payload = await response.json();
    const text = Array.isArray(payload.content)
      ? payload.content.map((item) => item && item.text ? item.text : "").join("\n")
      : "";

    console.log("[AI raw response]", text.slice(0, 3000));
    const parsed = extractJsonObject(text);
    console.log("[AI parsed floatCards sample]", JSON.stringify(parsed?.slides?.map(s => ({ key: s.key, floatCards: s.floatCards }))));

    return {
      provider: modeLabel,
      plan: sanitizeCopyPlan(parsed, job),
    };
  };

  try {
    return await requestAnthropic(
      [
        { type: "text", text: prompt },
        ...buildScreenshotInputsForAnthropic(job, blueprints),
      ],
      "anthropic",
    );
  } catch (error) {
    if (!isAnthropicImageTransportError(error)) {
      throw error;
    }
  }

  return await requestAnthropic(
    [
      { type: "text", text: prompt },
      ...buildTextOnlyInputsForAnthropic(job, blueprints),
    ],
    "anthropic-text",
  );
}

async function generateCopyPlanViaOpenAI(job, blueprints, prompt) {
  validateOpenAIConfig();
  const requestOpenAI = async (input, modeLabel) => {
    const response = await fetch(OPENAI_API_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        temperature: 0.4,
        max_output_tokens: 4096,
        input,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      throw new Error(`OpenAI 文案生成失败 ${response.status}${errorText ? `: ${errorText.slice(0, 300)}` : ""}`);
    }

    const payload = await response.json();
    const text = extractOpenAIOutputText(payload);

    console.log("[AI raw response]", text.slice(0, 3000));
    const parsed = extractJsonObject(text);
    console.log("[AI parsed floatCards sample]", JSON.stringify(parsed?.slides?.map(s => ({ key: s.key, floatCards: s.floatCards }))));

    return {
      provider: modeLabel,
      plan: sanitizeCopyPlan(parsed, job),
    };
  };

  try {
    return await requestOpenAI(
      [
        {
          role: "user",
          content: [
            { type: "input_text", text: prompt },
            ...buildScreenshotInputsForOpenAI(job, blueprints),
          ],
        },
      ],
      "openai",
    );
  } catch (error) {
    // Retry in text-only mode if the multimodal request is rejected upstream.
  }

  return await requestOpenAI(
    buildTextOnlyInputsForOpenAI(job, blueprints, prompt),
    "openai-text",
  );
}

async function generateCopyPlanWithAi(job) {
  const blueprints = buildCopyBlueprints(job);
  const prompt = buildCopyPrompt(job, blueprints);
  const errors = [];

  if (OPENAI_API_KEY) {
    try {
      return await generateCopyPlanViaOpenAI(job, blueprints, prompt);
    } catch (error) {
      errors.push(error.message || String(error));
    }
  }

  if (ANTHROPIC_API_KEY) {
    try {
      return await generateCopyPlanViaAnthropic(job, blueprints, prompt);
    } catch (error) {
      errors.push(error.message || String(error));
    }
  }

  if (!ANTHROPIC_API_KEY && !OPENAI_API_KEY) {
    return null;
  }

  throw new Error(errors.join(" | "));
}

function normalizeTargetUrl(rawUrl) {
  const trimmed = String(rawUrl || "").trim();
  if (!trimmed) {
    throw new Error("Missing url parameter");
  }

  const parsed = new URL(/^[a-z]+:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
  const isLocal = ["localhost", "127.0.0.1", "0.0.0.0"].includes(parsed.hostname);
  if (parsed.protocol === "http:" && !isLocal) {
    parsed.protocol = "https:";
  }
  return parsed.href;
}

function normalizeCaptureMode(rawMode) {
  const value = String(rawMode || "auto").trim().toLowerCase();
  return ["auto", "mobile", "web-fit", "web-crop"].includes(value) ? value : "auto";
}

function isLocalHost(hostname) {
  return ["localhost", "127.0.0.1", "0.0.0.0"].includes(hostname);
}

function resolveCaptureMode(targetUrl, requestedMode) {
  const mode = normalizeCaptureMode(requestedMode);
  if (mode !== "auto") {
    return mode;
  }

  const parsed = new URL(targetUrl);
  if (isLocalHost(parsed.hostname) || parsed.hostname.startsWith("m.") || parsed.hostname.includes("mobile")) {
    return "mobile";
  }

  return "web-fit";
}

function getCaptureConfig(resolvedMode) {
  if (resolvedMode === "mobile") {
    return {
      viewport: MOBILE_VIEWPORT,
      screenshot: { type: "png", fullPage: false },
      fitMode: "cover",
    };
  }

  if (resolvedMode === "web-crop") {
    const clipWidth = Math.round(DESKTOP_VIEWPORT.height * (MOBILE_VIEWPORT.width / MOBILE_VIEWPORT.height));
    return {
      viewport: DESKTOP_VIEWPORT,
      screenshot: {
        type: "png",
        clip: {
          x: Math.max(0, Math.round((DESKTOP_VIEWPORT.width - clipWidth) / 2)),
          y: 0,
          width: Math.min(clipWidth, DESKTOP_VIEWPORT.width),
          height: DESKTOP_VIEWPORT.height,
        },
      },
      fitMode: "cover",
    };
  }

  return {
    viewport: DESKTOP_VIEWPORT,
    screenshot: { type: "png", fullPage: false },
    fitMode: "contain",
  };
}

async function getBrowser() {
  if (!browserPromise) {
    let chromium;
    try {
      ({ chromium } = require("playwright"));
    } catch (error) {
      throw new Error("Playwright is not installed. Run: npm install -D playwright && npx playwright install chromium");
    }

    const executablePath = SYSTEM_BROWSER_CANDIDATES.find((candidate) => fs.existsSync(candidate));
    browserPromise = chromium.launch({
      headless: true,
      executablePath,
      channel: executablePath ? undefined : "chromium",
    });
  }

  return browserPromise;
}

async function captureScreenshotBundle(page, captureConfig) {
  const [pngBuffer, copyBuffer] = await Promise.all([
    page.screenshot(captureConfig.screenshot),
    page.screenshot({
      ...captureConfig.screenshot,
      type: "jpeg",
      quality: 55,
      scale: "css",
    }),
  ]);

  return {
    imageDataUrl: `data:image/png;base64,${pngBuffer.toString("base64")}`,
    copyImageDataUrl: `data:image/jpeg;base64,${copyBuffer.toString("base64")}`,
  };
}

async function capturePreview(targetUrl, requestedMode) {
  const resolvedMode = resolveCaptureMode(targetUrl, requestedMode);
  const captureConfig = getCaptureConfig(resolvedMode);
  const browser = await getBrowser();
  const context = await browser.newContext({
    viewport: captureConfig.viewport,
    deviceScaleFactor: DEVICE_SCALE,
    userAgent: USER_AGENT,
  });

  const page = await context.newPage();
  try {
    try {
      await page.goto(targetUrl, { waitUntil: "networkidle", timeout: 60000 });
    } catch {
      try {
        await page.goto(targetUrl, { waitUntil: "load", timeout: 60000 });
      } catch {
        try {
          await page.goto(targetUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
        } catch {
          await page.goto(targetUrl, { waitUntil: "commit", timeout: 60000 });
        }
      }
    }

    await page.waitForTimeout(CAPTURE_WAIT_MS);

    const [title, finalUrl, screenshots] = await Promise.all([
      page.title().catch(() => ""),
      Promise.resolve(page.url()),
      captureScreenshotBundle(page, captureConfig),
    ]);

    return {
      title,
      finalUrl,
      requestedMode: normalizeCaptureMode(requestedMode),
      captureMode: resolvedMode,
      fitMode: captureConfig.fitMode,
      viewport: captureConfig.viewport,
      imageDataUrl: screenshots.imageDataUrl,
      copyImageDataUrl: screenshots.copyImageDataUrl,
      capturedAt: new Date().toISOString(),
    };
  } finally {
    await page.close().catch(() => {});
    await context.close().catch(() => {});
  }
}

async function captureJobScreenshots(job) {
  const resolvedMode = resolveCaptureMode(job.url, job.requestedMode);
  job.captureMode = resolvedMode;
  const captureConfig = getCaptureConfig(resolvedMode);
  const browser = await getBrowser();
  const context = await browser.newContext({
    viewport: captureConfig.viewport,
    deviceScaleFactor: DEVICE_SCALE,
    userAgent: USER_AGENT,
  });

  const page = await context.newPage();
  let targets = [];

  try {
    if (job.routes.length) {
      const manualTargets = [
        job.url,
        ...job.routes.map((route) => new URL(route.startsWith("/") ? route : `/${route}`, job.url).href),
      ];
      const deduped = [...new Set(manualTargets.map((item) => normalizeUrlForDedupe(item)))];
      targets = deduped.slice(0, Math.max(1, job.slideCount || 5)).map((targetUrl, index) => ({
        route: toRelativeRoute(targetUrl, job.url),
        label: buildTargetLabel(targetUrl, index + 1),
        targetUrl,
      }));
      pushJobEvent(job, "ok", `已根据手动路由整理出 ${targets.length} 个页面`);
    } else {
      pushJobEvent(job, "run", "正在自动发现同域页面 …");
      targets = await discoverCaptureTargets(job, page);
      pushJobEvent(job, "ok", `自动发现 ${targets.length} 个不同页面`);
    }
  } catch (error) {
    targets = [{
      route: toRelativeRoute(job.url, job.url),
      label: buildTargetLabel(job.url, 1),
      targetUrl: normalizeUrlForDedupe(job.url),
    }];
    pushJobEvent(job, "dim", `页面自动发现失败，已回退到单页截图：${error.message}`);
  }

  job.total = targets.length;
  pushJobEvent(job, "ok", `已创建任务，共 ${targets.length} 个页面待截图`);
  pushJobEvent(job, "ok", "Playwright chromium 已就绪");
  pushJobEvent(job, "ok", `当前截图模式：${resolvedMode}`);

  try {
    for (const [index, target] of targets.entries()) {
      const prefix = String(index + 1).padStart(2, "0");
      pushJobEvent(job, "run", `截图 ${prefix}-${target.label}.png …`);

      try {
        await page.goto(target.targetUrl, { waitUntil: "networkidle", timeout: 60000 });
      } catch {
        try {
          await page.goto(target.targetUrl, { waitUntil: "load", timeout: 60000 });
        } catch {
          try {
            await page.goto(target.targetUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
          } catch {
            await page.goto(target.targetUrl, { waitUntil: "commit", timeout: 60000 });
          }
        }
      }

      await page.waitForTimeout(CAPTURE_WAIT_MS);

      const [title, finalUrl, screenshots] = await Promise.all([
        page.title().catch(() => ""),
        Promise.resolve(page.url()),
        captureScreenshotBundle(page, captureConfig),
      ]);

      const payload = {
        route: target.route,
        label: target.label,
        requestUrl: target.targetUrl,
        finalUrl,
        title,
        file: `${prefix}-${target.label}.png`,
        requestedMode: job.requestedMode,
        captureMode: resolvedMode,
        fitMode: captureConfig.fitMode,
        viewport: captureConfig.viewport,
        imageDataUrl: screenshots.imageDataUrl,
        copyImageDataUrl: screenshots.copyImageDataUrl,
      };

      job.screenshots.push(payload);
      job.completed += 1;
      job.updatedAt = new Date().toISOString();
      job.expiresAt = Date.now() + JOB_TTL_MS;

      responseCache.set(buildCacheKey(target.targetUrl, job.requestedMode), {
        payload: {
          title,
          finalUrl,
          requestedMode: job.requestedMode,
          captureMode: resolvedMode,
          fitMode: captureConfig.fitMode,
          viewport: captureConfig.viewport,
          imageDataUrl: payload.imageDataUrl,
          copyImageDataUrl: payload.copyImageDataUrl,
          capturedAt: new Date().toISOString(),
        },
        expiresAt: Date.now() + CACHE_TTL_MS,
      });

      pushJobEvent(job, "ok", `${payload.file} 已保存 (${captureConfig.viewport.width * DEVICE_SCALE}×${captureConfig.viewport.height * DEVICE_SCALE}px)`);
    }

    if (ANTHROPIC_API_KEY || OPENAI_API_KEY) {
      pushJobEvent(job, "run", "AI 正在分析截图并生成个性化文案 …");
      try {
        const copyResult = await generateCopyPlanWithAi(job);
        job.copyPlan = copyResult ? copyResult.plan : null;
        job.copySource = copyResult ? copyResult.provider : null;
        if (job.copyPlan) {
          pushJobEvent(job, "ok", `AI 文案已生成（${job.copySource}），共 ${job.copyPlan.slides.length} 张`);
        }
      } catch (error) {
        job.copyPlan = null;
        job.copySource = null;
        pushJobEvent(job, "dim", `AI 文案生成失败，已回退模板文案：${error.message}`);
      }
    } else {
      pushJobEvent(job, "dim", "未配置可用的 AI 文案服务 key，当前仍使用本地模板文案");
    }

    job.status = "completed";
    pushJobEvent(job, "ok", `真实截图完成，共 ${job.completed} 张`);
  } catch (error) {
    job.status = "failed";
    job.error = formatCaptureError(error, job.url);
    pushJobEvent(job, "error", `截图失败：${job.error}`);
  } finally {
    job.updatedAt = new Date().toISOString();
    job.expiresAt = Date.now() + JOB_TTL_MS;
    await page.close().catch(() => {});
    await context.close().catch(() => {});
  }
}

function buildCacheKey(targetUrl, requestedMode) {
  return `${normalizeCaptureMode(requestedMode)}::${targetUrl}`;
}

async function getPreview(targetUrl, requestedMode) {
  const cacheKey = buildCacheKey(targetUrl, requestedMode);
  const cached = responseCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.payload;
  }

  if (inflightRequests.has(cacheKey)) {
    return inflightRequests.get(cacheKey);
  }

  const requestPromise = capturePreview(targetUrl, requestedMode)
    .then((payload) => {
      responseCache.set(cacheKey, {
        payload,
        expiresAt: Date.now() + CACHE_TTL_MS,
      });
      inflightRequests.delete(cacheKey);
      return payload;
    })
    .catch((error) => {
      inflightRequests.delete(cacheKey);
      throw error;
    });

  inflightRequests.set(cacheKey, requestPromise);
  return requestPromise;
}

const server = http.createServer(async (req, res) => {
  if (!req.url) {
    sendJson(res, 400, { error: "Missing request URL" });
    return;
  }

  if (req.method === "OPTIONS") {
    setCorsHeaders(res);
    res.writeHead(204);
    res.end();
    return;
  }

  const requestUrl = new URL(req.url, `http://127.0.0.1:${PORT}`);

  if (req.method === "GET" && requestUrl.pathname === "/health") {
    sendJson(res, 200, { ok: true });
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/assets/iphone-mockup.png") {
    sendStaticFile(res, PHONE_MOCKUP_PATH, "image/png");
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/api/preview") {
    try {
      const targetUrl = normalizeTargetUrl(requestUrl.searchParams.get("url"));
      const payload = await getPreview(targetUrl, requestUrl.searchParams.get("mode"));
      sendJson(res, 200, payload);
    } catch (error) {
      sendJson(res, 500, { error: formatCaptureError(error, requestUrl.searchParams.get("url")) });
    }
    return;
  }

  if (req.method === "POST" && requestUrl.pathname === "/api/capture-jobs") {
    try {
      const body = await readRequestBody(req);
      const payload = body ? JSON.parse(body) : {};
      const url = normalizeTargetUrl(payload.url);
      const requestedMode = normalizeCaptureMode(payload.captureMode);
      const routes = Array.isArray(payload.routes)
        ? payload.routes.map((route) => String(route || "").trim()).filter(Boolean)
        : [];

      const job = {
        id: createJobId(),
        status: "running",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        expiresAt: Date.now() + JOB_TTL_MS,
        total: 0,
        completed: 0,
        url,
        requestedMode,
        requestSignature: buildRequestSignature({
          url,
          routes,
          slideCount: Number.parseInt(payload.slideCount, 10) || 6,
          styleId: String(payload.styleId || "").trim(),
          styleLabel: String(payload.styleLabel || "").trim(),
          appNameHint: String(payload.appNameHint || "").trim(),
          descriptionHint: String(payload.descriptionHint || "").trim(),
        }),
        slideCount: Number.parseInt(payload.slideCount, 10) || 6,
        styleId: String(payload.styleId || "").trim(),
        styleLabel: String(payload.styleLabel || "").trim(),
        stylePrompt: String(payload.stylePrompt || "").trim(),
        styleKeywords: Array.isArray(payload.styleKeywords)
          ? payload.styleKeywords.map((item) => String(item || "").trim()).filter(Boolean).slice(0, 8)
          : [],
        appNameHint: String(payload.appNameHint || "").trim(),
        descriptionHint: String(payload.descriptionHint || "").trim(),
        routes,
        screenshots: [],
        copyPlan: null,
        copySource: null,
        events: [],
        error: null,
      };

      captureJobs.set(job.id, job);
      pushJobEvent(job, "ok", `检测 ${url} … 可访问`);
      captureJobScreenshots(job).catch((error) => {
        job.status = "failed";
        job.error = formatCaptureError(error, job.url);
        pushJobEvent(job, "error", `截图失败：${job.error}`);
      });

      sendJson(res, 201, { jobId: job.id, status: job.status });
    } catch (error) {
      sendJson(res, 400, { error: error.message || "Invalid request" });
    }
    return;
  }

  if (req.method === "POST" && requestUrl.pathname === "/api/export-files") {
    try {
      const body = await readRequestBody(req, 250 * 1024 * 1024);
      const payload = body ? JSON.parse(body) : {};
      const result = exportFilesToDisk(payload);
      sendJson(res, 201, result);
    } catch (error) {
      sendJson(res, 400, { error: error.message || "导出失败" });
    }
    return;
  }

  if (req.method === "POST" && requestUrl.pathname === "/api/render-exports") {
    try {
      const body = await readRequestBody(req, 250 * 1024 * 1024);
      const payload = body ? JSON.parse(body) : {};
      const result = await renderExportFilesToDisk(payload);
      sendJson(res, 201, result);
    } catch (error) {
      sendJson(res, 400, { error: error.message || "导出失败" });
    }
    return;
  }

  if (req.method === "GET" && requestUrl.pathname.startsWith("/api/capture-jobs/")) {
    const jobId = requestUrl.pathname.split("/").pop();
    const job = jobId ? captureJobs.get(jobId) : null;

    if (!job) {
      sendJson(res, 404, { error: "Job not found" });
      return;
    }

    sendJson(res, 200, serializeJob(job));
    return;
  }

  sendJson(res, 404, { error: "Not found" });
});

server.listen(PORT, "127.0.0.1", () => {
  cleanupExpiredJobs();
  console.log(`Screenshot server running at http://127.0.0.1:${PORT}`);
});

setInterval(cleanupExpiredJobs, 1000 * 60 * 5).unref();

async function shutdown() {
  server.close();
  if (browserPromise) {
    const browser = await browserPromise.catch(() => null);
    if (browser) {
      await browser.close().catch(() => {});
    }
  }
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
