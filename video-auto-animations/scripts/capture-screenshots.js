/**
 * Capture screenshots + element coordinates for ev-calc tutorial video.
 * Output: public/screenshots/*.png + public/screenshots/coords.json
 *
 * Usage: node scripts/capture-screenshots.js
 */

const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs");

const OUT_DIR = path.resolve(__dirname, "../public/screenshots");
const URL = "https://justyn.spailab.com/ev-calc.html";

const VIEWPORT = { width: 390, height: 844 };
const DPR = 2.77;

async function capture() {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: DPR });
  const page = await context.newPage();

  console.log("Opening page...");
  await page.goto(URL, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);

  const coords = {};

  // ─── 01: initial (no scroll) ──────────────────────────────────────────────
  const optRect = await page.evaluate(() => {
    const el = Array.from(document.querySelectorAll("button, div, span, li"))
      .find(e => e.textContent.trim() === "期权产品");
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  });
  coords.optionsTab = { x: Math.round(optRect.x * DPR), y: Math.round(optRect.y * DPR) };
  await page.screenshot({ path: path.join(OUT_DIR, "01-initial.png") });
  console.log("✓ 01-initial.png  | optionsTab:", coords.optionsTab);

  // ─── 02: click options tab ────────────────────────────────────────────────
  await page.evaluate(() => {
    const el = Array.from(document.querySelectorAll("button, div, span, li"))
      .find(e => e.textContent.trim() === "期权产品");
    el && el.click();
  });
  await page.waitForTimeout(700);
  await page.screenshot({ path: path.join(OUT_DIR, "02-options-tab.png") });
  console.log("✓ 02-options-tab.png");

  // ─── 03: fill form (no scroll — inputs are in upper half) ─────────────────
  await page.fill("#option-underlying", "100");
  await page.waitForTimeout(100);
  await page.fill("#option-premium", "8");
  await page.waitForTimeout(100);
  await page.fill("#option-strike", "110");
  await page.waitForTimeout(100);

  const inputCoords = await page.evaluate((dpr) => {
    const ids = ["option-underlying", "option-premium", "option-strike"];
    return ids.map(id => {
      const el = document.getElementById(id);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: Math.round((r.left + r.width / 2) * dpr), y: Math.round((r.top + r.height / 2) * dpr) };
    });
  }, DPR);
  coords.inputUnderlying = inputCoords[0];
  coords.inputPremium    = inputCoords[1];
  coords.inputStrike     = inputCoords[2];
  await page.screenshot({ path: path.join(OUT_DIR, "03-form-filled.png") });
  console.log("✓ 03-form-filled.png  | inputs:", inputCoords);

  // ─── 04: scroll to show calc button, screenshot ───────────────────────────
  // Calc button is at page y≈1427, scroll so it appears at viewport y≈380
  const SCROLL_TO_CALC = 1060;
  await page.evaluate((scrollY) => window.scrollTo(0, scrollY), SCROLL_TO_CALC);
  await page.waitForTimeout(400);

  const calcCoords = await page.evaluate((dpr) => {
    const btn = Array.from(document.querySelectorAll("button"))
      .find(b => b.textContent.includes("计算期望值") && b.offsetParent !== null);
    if (!btn) return null;
    const r = btn.getBoundingClientRect();
    return { x: Math.round((r.left + r.width / 2) * dpr), y: Math.round((r.top + r.height / 2) * dpr) };
  }, DPR);
  coords.calcBtn = calcCoords;
  await page.screenshot({ path: path.join(OUT_DIR, "04-calc-visible.png") });
  console.log("✓ 04-calc-visible.png  | calcBtn:", calcCoords);

  // ─── 05: click + results ──────────────────────────────────────────────────
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll("button"))
      .find(b => b.textContent.includes("计算期望值") && b.offsetParent !== null);
    btn && btn.click();
  });
  await page.waitForTimeout(1200);
  // Scroll to show results
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight - 844));
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(OUT_DIR, "05-results.png") });
  console.log("✓ 05-results.png");

  await browser.close();

  fs.writeFileSync(path.join(OUT_DIR, "coords.json"), JSON.stringify(coords, null, 2));
  console.log("\nCoords saved:");
  console.log(JSON.stringify(coords, null, 2));
}

capture().catch(err => { console.error("Capture failed:", err); process.exit(1); });
