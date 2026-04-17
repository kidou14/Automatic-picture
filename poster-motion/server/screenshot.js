'use strict';

/**
 * screenshot.js — Playwright-based URL capture
 * Ported from Auto-banner-OneClick/scripts/screenshot-server.js
 *
 * Main export: captureScreenshots(url) → Array<{ imageDataUrl, label, finalUrl }>
 */

const fs     = require('fs');
const crypto = require('crypto');
const zlib   = require('zlib');
const { URL } = require('url');

const MOBILE_VIEWPORT = { width: 390, height: 844 };
const DEVICE_SCALE    = 3;
const USER_AGENT      =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
const CAPTURE_WAIT_MS = parseInt(process.env.CAPTURE_WAIT_MS || '1200', 10);
const MAX_SCREENSHOTS = 1;

const SYSTEM_BROWSER_CANDIDATES = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
];

let browserPromise = null;

async function getBrowser() {
  // If the cached browser has disconnected, clear it so we re-launch below.
  if (browserPromise) {
    try {
      const b = await browserPromise;
      if (!b.isConnected()) browserPromise = null;
    } catch {
      browserPromise = null;
    }
  }

  if (!browserPromise) {
    let chromium;
    try { ({ chromium } = require('playwright')); }
    catch { throw new Error('Playwright not installed. Run: npm install playwright && npx playwright install chromium'); }

    const executablePath = SYSTEM_BROWSER_CANDIDATES.find((c) => fs.existsSync(c));
    browserPromise = chromium.launch({
      headless: true,
      executablePath,
      channel: executablePath ? undefined : 'chromium',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
    });
  }
  return browserPromise;
}

async function navigateWithFallback(page, targetUrl, timeout = 60000) {
  try { await page.goto(targetUrl, { waitUntil: 'networkidle', timeout }); }
  catch {
    try { await page.goto(targetUrl, { waitUntil: 'load', timeout }); }
    catch {
      try { await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout }); }
      catch { await page.goto(targetUrl, { waitUntil: 'commit', timeout }); }
    }
  }
}

// ── Visual duplicate detection ────────────────────────────────────────────────

function samplePngPixels(buf) {
  if (buf.length < 8 || buf.readUInt32BE(0) !== 0x89504e47) return null;
  let pos = 8;
  let width = 0, height = 0, colorType = 0, bitDepth = 0;
  const idatParts = [];
  while (pos + 12 <= buf.length) {
    const len  = buf.readUInt32BE(pos);
    const type = buf.slice(pos + 4, pos + 8).toString('ascii');
    const data = buf.slice(pos + 8, pos + 8 + len);
    if (type === 'IHDR') { width = data.readUInt32BE(0); height = data.readUInt32BE(4); bitDepth = data[8]; colorType = data[9]; }
    else if (type === 'IDAT') idatParts.push(data);
    else if (type === 'IEND') break;
    pos += 12 + len;
  }
  if (!width || !height || !idatParts.length) return null;
  let raw;
  try { raw = zlib.inflateSync(Buffer.concat(idatParts)); } catch { return null; }
  const ch = colorType === 2 ? 3 : colorType === 6 ? 4 : colorType === 0 ? 1 : 3;
  const bpp = Math.ceil((bitDepth / 8) * ch);
  const stride = 1 + width * bpp;
  const COLS = 20, ROWS = 15;
  const samples = [];
  for (let r = 0; r < ROWS; r++) {
    const row = Math.floor(r * height / ROWS);
    const rowBase = row * stride + 1;
    for (let c = 0; c < COLS; c++) {
      const col = Math.floor(c * width / COLS);
      const off = rowBase + col * bpp;
      if (off + Math.min(ch, 3) - 1 < raw.length) samples.push(raw[off], raw[off + 1] ?? 0, raw[off + 2] ?? 0);
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
  const COLS = 20, ROWS = 15, BLOCK_COLS = 4, BLOCK_ROWS = 3, THRESHOLD = 22;
  for (let br = 0; br < BLOCK_ROWS; br++) {
    for (let bc = 0; bc < BLOCK_COLS; bc++) {
      let diff = 0, count = 0;
      const rStart = Math.floor(br * ROWS / BLOCK_ROWS), rEnd = Math.floor((br + 1) * ROWS / BLOCK_ROWS);
      const cStart = Math.floor(bc * COLS / BLOCK_COLS), cEnd = Math.floor((bc + 1) * COLS / BLOCK_COLS);
      for (let r = rStart; r < rEnd; r++) for (let c = cStart; c < cEnd; c++) {
        const idx = (r * COLS + c) * 3;
        diff += Math.abs(a.samples[idx] - b.samples[idx])
              + Math.abs(a.samples[idx + 1] - b.samples[idx + 1])
              + Math.abs(a.samples[idx + 2] - b.samples[idx + 2]);
        count += 3;
      }
      if (count > 0 && diff / count > THRESHOLD) return false;
    }
  }
  return true;
}

// ── Route discovery ───────────────────────────────────────────────────────────

function normalizeUrlForDedupe(rawUrl) {
  const parsed = new URL(rawUrl);
  if (parsed.pathname !== '/') parsed.pathname = parsed.pathname.replace(/\/+$/, '') || '/';
  parsed.hash = '';
  return parsed.href;
}

function buildTargetLabel(targetUrl, fallbackIndex) {
  try {
    const parsed = new URL(targetUrl);
    const tail = parsed.pathname.split('/').filter(Boolean).pop() || 'home';
    return tail.replace(/\.[a-z0-9]+$/i, '') || `page-${fallbackIndex}`;
  } catch { return `page-${fallbackIndex}`; }
}

async function collectSameOriginLinks(page, currentUrl, origin) {
  const links = await page.$$eval('a[href]', (anchors) =>
    anchors.map((a) => a.getAttribute('href') || '').filter(Boolean)
  ).catch(() => []);
  const results = [], seen = new Set();
  for (const href of links) {
    const trimmed = href.trim();
    if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('javascript:') ||
        trimmed.startsWith('mailto:') || trimmed.startsWith('tel:')) continue;
    try {
      const absolute = new URL(trimmed, currentUrl);
      if (!['http:', 'https:'].includes(absolute.protocol)) continue;
      if (absolute.origin !== origin) continue;
      absolute.hash = '';
      const normalized = normalizeUrlForDedupe(absolute.href);
      if (seen.has(normalized)) continue;
      seen.add(normalized);
      results.push(normalized);
    } catch { /* ignore */ }
  }
  return results;
}

async function discoverCaptureTargets(page, startRawUrl) {
  const startUrl = normalizeUrlForDedupe(startRawUrl);
  const origin   = new URL(startUrl).origin;
  const rootUrl  = normalizeUrlForDedupe(origin + '/');
  const initialUrls = startUrl === rootUrl ? [startUrl] : [rootUrl, startUrl];
  const queue    = initialUrls.map((url) => ({ url, depth: 0 }));
  const queued   = new Set(initialUrls);
  const visited  = new Set();
  const targets  = [];
  const visitedFinalUrls = new Set();

  while (queue.length && targets.length < MAX_SCREENSHOTS) {
    const current = queue.shift();
    if (!current || visited.has(current.url)) continue;
    visited.add(current.url);
    try {
      await page.goto(current.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(400);
      const finalUrl = normalizeUrlForDedupe(page.url());
      if (visitedFinalUrls.has(finalUrl)) continue;
      visitedFinalUrls.add(finalUrl);
      targets.push({ targetUrl: current.url, label: buildTargetLabel(current.url, targets.length + 1) });
      if (current.depth >= 2 || targets.length >= MAX_SCREENSHOTS) continue;
      const links = await collectSameOriginLinks(page, current.url, origin);
      for (const link of links) {
        if (!visited.has(link) && !queued.has(link)) { queued.add(link); queue.push({ url: link, depth: current.depth + 1 }); }
      }
    } catch { /* skip failed pages */ }
  }
  return targets;
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Capture up to MAX_SCREENSHOTS from a URL using Playwright.
 * Calls onProgress(index, total, label) after each successful screenshot.
 *
 * @param {string} url
 * @param {function} [onProgress]
 * @returns {Promise<Array<{ pngBuffer: Buffer, imageDataUrl: string, label: string, finalUrl: string }>>}
 */
async function captureScreenshots(url, onProgress) {
  const browser = await getBrowser();
  const context = await browser.newContext({
    viewport: MOBILE_VIEWPORT,
    deviceScaleFactor: DEVICE_SCALE,
    userAgent: USER_AGENT,
    colorScheme: 'no-preference',
  });
  const page = await context.newPage();

  try {
    // When MAX_SCREENSHOTS=1, skip discovery entirely — just capture the given URL
    let targets;
    if (MAX_SCREENSHOTS === 1) {
      targets = [{ targetUrl: url, label: buildTargetLabel(url, 1) }];
    } else {
      try { targets = await discoverCaptureTargets(page, url); }
      catch { targets = [{ targetUrl: url, label: 'home' }]; }
    }

    const results = [];
    const capturedFinalUrls    = new Set();
    const capturedContentHashes = new Set();
    const capturedPngBuffers   = [];

    for (let i = 0; i < targets.length; i++) {
      const { targetUrl, label } = targets[i];
      await navigateWithFallback(page, targetUrl);
      await page.waitForTimeout(CAPTURE_WAIT_MS);

      const finalUrl = normalizeUrlForDedupe(page.url());
      if (capturedFinalUrls.has(finalUrl)) continue;
      capturedFinalUrls.add(finalUrl);

      const pngBuffer = await page.screenshot({ type: 'png', fullPage: false });

      // Exact duplicate
      const hash = crypto.createHash('sha256').update(pngBuffer).digest('hex');
      if (capturedContentHashes.has(hash)) continue;

      // Visual duplicate
      if (capturedPngBuffers.some((prev) => looksLikeDuplicate(prev, pngBuffer))) continue;

      capturedContentHashes.add(hash);
      capturedPngBuffers.push(pngBuffer);

      const item = {
        pngBuffer,
        imageDataUrl: `data:image/png;base64,${pngBuffer.toString('base64')}`,
        label,
        finalUrl,
      };
      results.push(item);

      if (onProgress) onProgress(results.length, targets.length, label);
    }

    return results;
  } finally {
    await page.close().catch(() => {});
    await context.close().catch(() => {});
  }
}

module.exports = { captureScreenshots };
