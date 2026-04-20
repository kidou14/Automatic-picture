/**
 * capture.js — Playwright page capture (V3)
 *
 * Step 1: captureInitial  — initial screenshot + DOM metadata (same as V1)
 * Step 2: recordInteractions — execute plan + record video + track timestamps
 *
 * Key V3 addition: recordVideo is enabled on the browser context so we get
 * a real .webm screen recording alongside the interaction timestamp data.
 */
const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs");
const sharp = require("sharp");

const VIEWPORT = { width: 390, height: 844 };
const DPR = 2.769; // → 1080px native width for screenshots

const FONT_BLOCK = /(fonts\.googleapis\.com|fonts\.gstatic\.com|use\.typekit\.net|fast\.fonts\.net)/;
const FONT_EXT = /\.(woff2?|ttf|otf|eot)(\?.*)?$/i;

async function sharpenPng(filePath) {
  try {
    const buf = await sharp(filePath)
      .sharpen({ sigma: 0.6, m1: 0.3, m2: 0.8 })
      .toBuffer();
    fs.writeFileSync(filePath, buf);
  } catch (e) {
    console.warn("[capture] sharpen skipped:", e.message);
  }
}

// ─── Step 1: Initial screenshot + metadata ────────────────────────────────────

async function captureInitial(url, sessionDir) {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: DPR,
    userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15",
  });

  await context.route(FONT_BLOCK, (r) => r.abort());
  await context.route(FONT_EXT, (r) => r.abort());

  const page = await context.newPage();
  await page.goto(url, { waitUntil: "load", timeout: 30000 }).catch(() =>
    page.goto(url, { waitUntil: "domcontentloaded", timeout: 15000 })
  );
  await page.waitForTimeout(2500);

  const ssFile = "ss_00.png";
  const ssPath = path.join(sessionDir, ssFile);
  await page.screenshot({ path: ssPath, fullPage: true, timeout: 60000 });
  await sharpenPng(ssPath);

  const aiSsFile = "ss_ai.png";
  const aiSsPath = path.join(sessionDir, aiSsFile);
  await page.screenshot({ path: aiSsPath, fullPage: false, timeout: 60000 });
  await sharpenPng(aiSsPath);

  const metadata = await page.evaluate(() => {
    const vis = (el) => el && el.offsetParent !== null;
    return {
      title: document.title,
      metaDescription: document.querySelector('meta[name="description"]')?.content || "",
      h1: Array.from(document.querySelectorAll("h1")).filter(vis).map((el) => el.innerText.trim()).filter(Boolean).slice(0, 3),
      h2: Array.from(document.querySelectorAll("h2")).filter(vis).map((el) => el.innerText.trim()).filter(Boolean).slice(0, 5),
      h3: Array.from(document.querySelectorAll("h3")).filter(vis).map((el) => el.innerText.trim()).filter(Boolean).slice(0, 5),
      buttons: Array.from(document.querySelectorAll('button, [role="button"], .btn, input[type="submit"]'))
        .filter(vis)
        .map((el) => ({ text: el.innerText?.trim().substring(0, 60) || el.value || "", id: el.id, className: el.className?.toString().substring(0, 100) || "" }))
        .filter((b) => b.text)
        .slice(0, 15),
      inputs: Array.from(document.querySelectorAll("input, select, textarea"))
        .filter(vis)
        .map((el) => ({ type: el.type || el.tagName.toLowerCase(), id: el.id, name: el.name, placeholder: el.placeholder || "", label: document.querySelector(`label[for="${el.id}"]`)?.innerText?.trim() || "" }))
        .slice(0, 12),
      links: Array.from(document.querySelectorAll("nav a, header a, .nav a, .menu a"))
        .filter(vis)
        .map((el) => ({ text: el.innerText?.trim().substring(0, 50) || "", href: el.href }))
        .filter((l) => l.text)
        .slice(0, 8),
      bodyText: document.body.innerText.substring(0, 1500),
    };
  });

  const ssHeight = await getPngHeight(ssPath);
  await browser.close();
  return { ssFile, aiSsFile, ssHeight, metadata };
}

// ─── Step 2: Execute interactions + record video ──────────────────────────────

/**
 * Execute the AI interaction plan in a fresh browser session with video recording enabled.
 * Tracks precise timestamps for each interaction step.
 *
 * Returns:
 *   interactions[]  — same structure as V1 (for coordinate data)
 *   webmPath        — path to the raw screen recording (.webm)
 *   timeline[]      — [{step, before_ms, click_ms, after_ms}] relative to t0
 */
async function recordInteractions(url, plan, sessionDir) {
  const browser = await chromium.launch({ headless: true });

  // t0 is set right before context creation so all timestamps are relative to
  // the recording start (Playwright begins recording when the context is created).
  const t0 = Date.now();
  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: DPR,
    userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15",
    recordVideo: {
      dir: sessionDir,
      size: { width: VIEWPORT.width, height: VIEWPORT.height },
    },
  });

  await context.route(FONT_BLOCK, (r) => r.abort());
  await context.route(FONT_EXT, (r) => r.abort());

  const page = await context.newPage();

  await page.goto(url, { waitUntil: "load", timeout: 30000 }).catch(() =>
    page.goto(url, { waitUntil: "domcontentloaded", timeout: 15000 })
  );
  await page.waitForTimeout(2500);

  const interactions = [];
  const timeline = [];
  let ssCounter = 0;

  // Capture initial screenshot (for coordinate reference)
  const initialSs = `rec_${String(ssCounter).padStart(2, "0")}.png`;
  await page.screenshot({ path: path.join(sessionDir, initialSs), fullPage: true });
  await sharpenPng(path.join(sessionDir, initialSs));

  for (let i = 0; i < plan.steps.length; i++) {
    const step = plan.steps[i];
    const tEvent = { step: i, before_ms: null, click_ms: null, after_ms: null };

    // 500ms pause before each step — gives the video a readable "before" state
    await page.waitForTimeout(500);
    tEvent.before_ms = Date.now() - t0;

    const beforeSs = `rec_${String(ssCounter).padStart(2, "0")}.png`;
    const scrollBefore = await page.evaluate(() => window.scrollY * 2.769);
    let clickCoords = null;

    try {
      if (step.action === "click" && step.selector) {
        const elementInfo = await page.evaluate((sel) => {
          const el = document.querySelector(sel);
          if (!el) return null;
          const rect = el.getBoundingClientRect();
          const pageY = rect.top + window.scrollY;
          const targetScroll = Math.max(0, pageY - window.innerHeight * 0.35);
          return { pageY, targetScroll, found: true };
        }, step.selector);

        if (elementInfo?.found) {
          await page.evaluate((sy) => window.scrollTo(0, sy), elementInfo.targetScroll);
          await page.waitForTimeout(300);

          const coords = await page.evaluate((sel) => {
            const el = document.querySelector(sel);
            if (!el) return null;
            const rect = el.getBoundingClientRect();
            return {
              page_x: (rect.left + rect.width / 2 + window.scrollX) * 2.769,
              page_y: (rect.top + rect.height / 2 + window.scrollY) * 2.769,
            };
          }, step.selector);
          if (coords) {
            clickCoords = { x: Math.round(coords.page_x), y: Math.round(coords.page_y) };
          }
        }

        ssCounter++;
        const beforeAfterScroll = `rec_${String(ssCounter).padStart(2, "0")}.png`;
        await page.screenshot({ path: path.join(sessionDir, beforeAfterScroll), fullPage: true });
        await sharpenPng(path.join(sessionDir, beforeAfterScroll));
        const scrollBeforeActual = await page.evaluate(() => window.scrollY * 2.769);

        tEvent.click_ms = Date.now() - t0;
        await page.evaluate((sel) => {
          const el = document.querySelector(sel);
          if (el) el.click();
        }, step.selector);
        await page.waitForTimeout(2000);

        const scrollAfter = await page.evaluate(() => window.scrollY * 2.769);
        ssCounter++;
        const afterSs = `rec_${String(ssCounter).padStart(2, "0")}.png`;
        await page.screenshot({ path: path.join(sessionDir, afterSs), fullPage: true });
        await sharpenPng(path.join(sessionDir, afterSs));
        tEvent.after_ms = Date.now() - t0;

        interactions.push({
          action: "click",
          description: step.description,
          callout_text: step.callout_text,
          before_ss: beforeAfterScroll,
          after_ss: afterSs,
          scroll_before: Math.round(scrollBeforeActual),
          scroll_after: Math.round(scrollAfter),
          click_x: clickCoords?.x ?? null,
          click_y: clickCoords?.y ?? null,
        });

      } else if (step.action === "fill" && step.selector) {
        await page.evaluate((sel) => {
          const el = document.querySelector(sel);
          if (el) el.focus();
        }, step.selector);
        try {
          await page.fill(step.selector, step.value || "");
        } catch {
          await page.evaluate(([sel, val]) => {
            const el = document.querySelector(sel);
            if (el) { el.value = val; el.dispatchEvent(new Event("input", { bubbles: true })); el.dispatchEvent(new Event("change", { bubbles: true })); }
          }, [step.selector, step.value || ""]);
        }
        tEvent.click_ms = Date.now() - t0;
        await page.waitForTimeout(2000);

        const scrollAfter = await page.evaluate(() => window.scrollY * 2.769);
        ssCounter++;
        const afterSs = `rec_${String(ssCounter).padStart(2, "0")}.png`;
        await page.screenshot({ path: path.join(sessionDir, afterSs), fullPage: true });
        await sharpenPng(path.join(sessionDir, afterSs));
        tEvent.after_ms = Date.now() - t0;

        interactions.push({
          action: "fill",
          description: step.description,
          callout_text: step.callout_text,
          before_ss: beforeSs,
          after_ss: afterSs,
          scroll_before: Math.round(scrollBefore),
          scroll_after: Math.round(scrollAfter),
          click_x: null,
          click_y: null,
        });

      } else if (step.action === "scroll") {
        const targetY = step.scroll_y || 0;
        await page.evaluate((y) => window.scrollTo(0, y), targetY);
        tEvent.click_ms = Date.now() - t0;
        await page.waitForTimeout(2000);

        const scrollAfter = await page.evaluate(() => window.scrollY * 2.769);
        ssCounter++;
        const afterSs = `rec_${String(ssCounter).padStart(2, "0")}.png`;
        await page.screenshot({ path: path.join(sessionDir, afterSs), fullPage: true });
        tEvent.after_ms = Date.now() - t0;

        interactions.push({
          action: "scroll",
          description: step.description,
          callout_text: step.callout_text,
          before_ss: beforeSs,
          after_ss: afterSs,
          scroll_before: Math.round(scrollBefore),
          scroll_after: Math.round(scrollAfter),
          click_x: null,
          click_y: null,
        });
      }
    } catch (err) {
      console.warn(`[capture] Step ${i} failed: ${err.message}`);
      tEvent.click_ms = tEvent.click_ms ?? Date.now() - t0;
      tEvent.after_ms = Date.now() - t0;
      interactions.push({
        action: step.action,
        description: step.description,
        callout_text: step.callout_text,
        before_ss: beforeSs,
        after_ss: beforeSs,
        scroll_before: Math.round(scrollBefore),
        scroll_after: Math.round(scrollBefore),
        click_x: null,
        click_y: null,
      });
    }

    timeline.push(tEvent);
  }

  // 3s tail — ensures result scene has enough buffer before the recording ends
  await page.waitForTimeout(3000);
  const resultMs = Date.now() - t0;

  // Finalise the video — must close page before calling video().path()
  await page.close();
  const rawWebmPath = await page.video().path();
  await context.close();
  await browser.close();

  // Rename to a stable filename
  const webmDest = path.join(sessionDir, "screen.webm");
  fs.renameSync(rawWebmPath, webmDest);
  console.log(`[capture] Video saved: ${webmDest}`);

  return { interactions, timeline, webmPath: webmDest, resultMs };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getPngHeight(imgPath) {
  return new Promise((resolve) => {
    const stream = fs.createReadStream(imgPath, { start: 0, end: 23 });
    const chunks = [];
    stream.on("data", (c) => chunks.push(c));
    stream.on("end", () => {
      try { resolve(Buffer.concat(chunks).readUInt32BE(20)); }
      catch { resolve(2338); }
    });
    stream.on("error", () => resolve(2338));
  });
}

module.exports = { captureInitial, recordInteractions };
