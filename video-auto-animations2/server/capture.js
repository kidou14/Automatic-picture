/**
 * capture.js — Generic Playwright page capture
 * Step 1: initial screenshot + DOM metadata extraction
 * Step 2: execute AI interaction plan → screenshots + native coords
 */
const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs");

const VIEWPORT = { width: 390, height: 844 };
const DPR = 2.769; // → 1080px native width

/**
 * Load URL, take initial screenshot, extract DOM metadata.
 * Returns { ssFile, ssHeight, metadata }
 */
async function captureInitial(url, sessionDir) {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: DPR,
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15",
  });

  // Block external font requests — Playwright waits for document.fonts.ready before
  // taking a screenshot; aborting fonts makes that resolve instantly instead of
  // timing out after 30 s on slow / unreachable font CDNs.
  await context.route(/(fonts\.googleapis\.com|fonts\.gstatic\.com|use\.typekit\.net|fast\.fonts\.net)/, (route) => route.abort());
  await context.route(/\.(woff2?|ttf|otf|eot)(\?.*)?$/i, (route) => route.abort());

  const page = await context.newPage();

  await page.goto(url, { waitUntil: "load", timeout: 30000 }).catch(() =>
    page.goto(url, { waitUntil: "domcontentloaded", timeout: 15000 })
  );
  await page.waitForTimeout(2500);

  const ssFile = "ss_00.png";
  const ssPath = path.join(sessionDir, ssFile);
  await page.screenshot({ path: ssPath, fullPage: true, timeout: 60000 });

  // Viewport-only screenshot for Claude (full-page can exceed 8000px limit)
  const aiSsFile = "ss_ai.png";
  await page.screenshot({ path: path.join(sessionDir, aiSsFile), fullPage: false, timeout: 60000 });

  const metadata = await page.evaluate(() => {
    const vis = (el) => el && el.offsetParent !== null;
    return {
      title: document.title,
      metaDescription:
        document.querySelector('meta[name="description"]')?.content || "",
      h1: Array.from(document.querySelectorAll("h1"))
        .filter(vis)
        .map((el) => el.innerText.trim())
        .filter(Boolean)
        .slice(0, 3),
      h2: Array.from(document.querySelectorAll("h2"))
        .filter(vis)
        .map((el) => el.innerText.trim())
        .filter(Boolean)
        .slice(0, 5),
      h3: Array.from(document.querySelectorAll("h3"))
        .filter(vis)
        .map((el) => el.innerText.trim())
        .filter(Boolean)
        .slice(0, 5),
      buttons: Array.from(
        document.querySelectorAll('button, [role="button"], .btn, input[type="submit"]')
      )
        .filter(vis)
        .map((el) => ({
          text: el.innerText?.trim().substring(0, 60) || el.value || "",
          id: el.id,
          className: el.className?.toString().substring(0, 100) || "",
        }))
        .filter((b) => b.text)
        .slice(0, 15),
      inputs: Array.from(
        document.querySelectorAll("input, select, textarea")
      )
        .filter(vis)
        .map((el) => ({
          type: el.type || el.tagName.toLowerCase(),
          id: el.id,
          name: el.name,
          placeholder: el.placeholder || "",
          label:
            document.querySelector(`label[for="${el.id}"]`)?.innerText?.trim() ||
            "",
        }))
        .slice(0, 12),
      links: Array.from(document.querySelectorAll("nav a, header a, .nav a, .menu a"))
        .filter(vis)
        .map((el) => ({
          text: el.innerText?.trim().substring(0, 50) || "",
          href: el.href,
        }))
        .filter((l) => l.text)
        .slice(0, 8),
      bodyText: document.body.innerText.substring(0, 1500),
    };
  });

  const ssHeight = await getPngHeight(ssPath);
  await browser.close();
  return { ssFile, aiSsFile, ssHeight, metadata };
}

/**
 * Execute AI interaction plan.
 * plan.steps: [{action, selector, value, scroll_y, description, callout_text}]
 * Returns: { interactions, ssHeights }
 */
async function executeInteractionPlan(url, plan, sessionDir) {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: DPR,
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15",
  });

  // Same font-blocking as captureInitial — prevents screenshot timeout
  await context.route(/(fonts\.googleapis\.com|fonts\.gstatic\.com|use\.typekit\.net|fast\.fonts\.net)/, (route) => route.abort());
  await context.route(/\.(woff2?|ttf|otf|eot)(\?.*)?$/i, (route) => route.abort());

  const page = await context.newPage();

  await page.goto(url, { waitUntil: "load", timeout: 30000 }).catch(() =>
    page.goto(url, { waitUntil: "domcontentloaded", timeout: 15000 })
  );
  await page.waitForTimeout(2500);

  const interactions = [];
  const ssHeights = {};
  let ssCounter = 0;

  // Capture initial state
  const initialSs = `ss_${String(ssCounter).padStart(2, "0")}.png`;
  await page.screenshot({ path: path.join(sessionDir, initialSs), fullPage: true });
  ssHeights[initialSs] = await getPngHeight(path.join(sessionDir, initialSs));

  for (let i = 0; i < plan.steps.length; i++) {
    const step = plan.steps[i];
    const beforeSs = `ss_${String(ssCounter).padStart(2, "0")}.png`;

    let clickCoords = null;
    const scrollBefore = await page.evaluate(() => window.scrollY * 2.769);

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
          await page.waitForTimeout(400);

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
        const beforeAfterScroll = `ss_${String(ssCounter).padStart(2, "0")}.png`;
        await page.screenshot({
          path: path.join(sessionDir, beforeAfterScroll),
          fullPage: true,
        });
        ssHeights[beforeAfterScroll] = await getPngHeight(
          path.join(sessionDir, beforeAfterScroll)
        );
        const beforeSsActual = beforeAfterScroll;
        const scrollBeforeActual = await page.evaluate(
          () => window.scrollY * 2.769
        );

        await page.evaluate((sel) => {
          const el = document.querySelector(sel);
          if (el) el.click();
        }, step.selector);
        await page.waitForTimeout(1000);

        const scrollAfter = await page.evaluate(() => window.scrollY * 2.769);
        ssCounter++;
        const afterSs = `ss_${String(ssCounter).padStart(2, "0")}.png`;
        await page.screenshot({
          path: path.join(sessionDir, afterSs),
          fullPage: true,
        });
        ssHeights[afterSs] = await getPngHeight(path.join(sessionDir, afterSs));

        interactions.push({
          action: "click",
          description: step.description,
          callout_text: step.callout_text,
          before_ss: beforeSsActual,
          after_ss: afterSs,
          scroll_before: Math.round(scrollBeforeActual),
          scroll_after: Math.round(scrollAfter),
          click_x: clickCoords?.x ?? null,
          click_y: clickCoords?.y ?? null,
          ss_height: ssHeights[beforeSsActual],
        });
        continue;
      }

      if (step.action === "fill" && step.selector) {
        await page.evaluate((sel) => {
          const el = document.querySelector(sel);
          if (el) el.focus();
        }, step.selector);
        try {
          await page.fill(step.selector, step.value || "");
        } catch {
          await page.evaluate(
            ([sel, val]) => {
              const el = document.querySelector(sel);
              if (el) {
                el.value = val;
                el.dispatchEvent(new Event("input", { bubbles: true }));
                el.dispatchEvent(new Event("change", { bubbles: true }));
              }
            },
            [step.selector, step.value || ""]
          );
        }
        await page.waitForTimeout(500);

        const scrollAfter = await page.evaluate(() => window.scrollY * 2.769);
        ssCounter++;
        const afterSs = `ss_${String(ssCounter).padStart(2, "0")}.png`;
        await page.screenshot({
          path: path.join(sessionDir, afterSs),
          fullPage: true,
        });
        ssHeights[afterSs] = await getPngHeight(path.join(sessionDir, afterSs));

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
          ss_height: ssHeights[beforeSs] || ssHeights[afterSs],
        });
        continue;
      }

      if (step.action === "scroll") {
        const targetY = step.scroll_y || 0;
        await page.evaluate((y) => window.scrollTo(0, y), targetY);
        await page.waitForTimeout(500);

        const scrollAfter = await page.evaluate(() => window.scrollY * 2.769);
        ssCounter++;
        const afterSs = `ss_${String(ssCounter).padStart(2, "0")}.png`;
        await page.screenshot({
          path: path.join(sessionDir, afterSs),
          fullPage: true,
        });
        ssHeights[afterSs] = await getPngHeight(path.join(sessionDir, afterSs));

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
          ss_height: ssHeights[beforeSs] || ssHeights[afterSs],
        });
      }
    } catch (err) {
      console.warn(`[capture] Step ${i} failed: ${err.message}`);
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
        ss_height: ssHeights[beforeSs] || 2338,
      });
    }
  }

  await browser.close();
  return { interactions, ssHeights };
}

/** Read PNG height from file header (bytes 20-23) */
function getPngHeight(imgPath) {
  return new Promise((resolve) => {
    const stream = fs.createReadStream(imgPath, { start: 0, end: 23 });
    const chunks = [];
    stream.on("data", (c) => chunks.push(c));
    stream.on("end", () => {
      try {
        const buf = Buffer.concat(chunks);
        resolve(buf.readUInt32BE(20));
      } catch {
        resolve(2338);
      }
    });
    stream.on("error", () => resolve(2338));
  });
}

module.exports = { captureInitial, executeInteractionPlan };
