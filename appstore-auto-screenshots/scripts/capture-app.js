#!/usr/bin/env node
/**
 * capture-app.js — Captures app screenshots at iPhone dimensions for App Store marketing
 *
 * Usage:
 *   node capture-app.js <url> [output-dir] [options]
 *
 * Options:
 *   --routes=/path1,/path2     Capture additional sub-pages
 *   --scroll                   Also capture a scrolled-down state for each page
 *   --click=".selector"        Click an element before capturing (for modals, tabs, menus)
 *   --wait=2000                Extra wait time in ms after page load (default: 1200)
 *   --light                    Use light color-scheme media query (default: system)
 *   --dark                     Use dark color-scheme media query
 *
 * Examples:
 *   node capture-app.js http://localhost:3000 ./captured-screenshots
 *   node capture-app.js https://myapp.com ./caps --routes=/dashboard,/profile --scroll
 *   node capture-app.js http://localhost:3000 ./caps --click=".tab-settings" --wait=2000
 */

const path = require("path");
const fs = require("fs");

// iPhone 15 Pro viewport — 390×844 logical px, ×3 device pixel ratio = 1170×2532 native
const VIEWPORT = { width: 390, height: 844 };
const DEVICE_SCALE = 3;

// Slugify a string for use in filenames
function slug(str) {
  return str.replace(/^\//, "").replace(/\//g, "-").replace(/[^a-z0-9-]/gi, "") || "page";
}

// Parse CLI arguments
function parseArgs(argv) {
  const args = argv.slice(2);
  const url = args[0];
  const outputDir = args[1] && !args[1].startsWith("--") ? args[1] : "./captured-screenshots";

  const flags = args.slice(url ? (args[1] && !args[1].startsWith("--") ? 2 : 1) : 0);

  const routes = (flags.find((a) => a.startsWith("--routes=")) || "")
    .replace("--routes=", "")
    .split(",")
    .filter(Boolean);

  const clickSelector = (flags.find((a) => a.startsWith("--click=")) || "")
    .replace("--click=", "") || null;

  const waitMs = parseInt(
    (flags.find((a) => a.startsWith("--wait=")) || "--wait=1200").replace("--wait=", ""),
    10
  );

  const scroll = flags.includes("--scroll");
  const colorScheme = flags.includes("--dark") ? "dark" : flags.includes("--light") ? "light" : "no-preference";

  return { url, outputDir, routes, clickSelector, waitMs, scroll, colorScheme };
}

async function capturePage(page, outputDir, filename, label) {
  const filepath = path.join(outputDir, filename);
  await page.screenshot({ path: filepath, fullPage: false });
  console.log(`  ✓ ${label} → ${filename}`);
  return { file: filename, label };
}

async function main() {
  const { url, outputDir, routes, clickSelector, waitMs, scroll, colorScheme } = parseArgs(process.argv);

  if (!url) {
    console.error([
      "Usage: node capture-app.js <url> [output-dir] [options]",
      "",
      "Options:",
      "  --routes=/path1,/path2   Capture additional sub-pages",
      "  --scroll                 Also capture scrolled-down state for each page",
      "  --click='.selector'      Click an element before capturing",
      "  --wait=2000              Extra wait time ms after load (default: 1200)",
      "  --light / --dark         Force color scheme",
      "",
      "Example:",
      "  node capture-app.js http://localhost:3000 ./captured-screenshots --routes=/dashboard,/profile",
    ].join("\n"));
    process.exit(1);
  }

  // Dynamic require — Playwright must be installed before running
  let chromium;
  try {
    ({ chromium } = require("playwright"));
  } catch {
    console.error(
      "Playwright is not installed. Run:\n  npm install -D playwright && npx playwright install chromium"
    );
    process.exit(1);
  }

  fs.mkdirSync(outputDir, { recursive: true });
  console.log(`\nCapturing ${url}`);
  console.log(`Output → ${path.resolve(outputDir)}\n`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: DEVICE_SCALE,
    colorScheme,
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
  });

  const page = await context.newPage();
  const captured = [];
  let index = 1;

  // Helper: navigate, settle, optionally click, then screenshot
  async function capture(targetUrl, label, suffix = "") {
    await page.goto(targetUrl, { waitUntil: "networkidle", timeout: 30000 }).catch(async () => {
      // Fallback: wait for domcontentloaded if networkidle times out (e.g. polling apps)
      await page.goto(targetUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
    });
    await page.waitForTimeout(waitMs);

    if (clickSelector) {
      await page.locator(clickSelector).first().click({ timeout: 5000 }).catch(() => {
        console.warn(`  ⚠ Could not click "${clickSelector}" — skipping click`);
      });
      await page.waitForTimeout(600);
    }

    const prefix = String(index).padStart(2, "0");
    const name = `${prefix}-${slug(label)}${suffix}.png`;
    captured.push(await capturePage(page, outputDir, name, label + suffix));
    index++;

    // Scrolled state: scroll 40% down and capture again
    if (scroll) {
      await page.evaluate(() => window.scrollBy(0, window.innerHeight * 0.4));
      await page.waitForTimeout(400);
      const scrollName = `${String(index).padStart(2, "0")}-${slug(label)}-scrolled.png`;
      captured.push(await capturePage(page, outputDir, scrollName, label + " (scrolled)"));
      index++;
      await page.evaluate(() => window.scrollTo(0, 0));
    }
  }

  // --- Main page ---
  await capture(url, "home");

  // --- Additional routes ---
  for (const route of routes) {
    const routeUrl = route.startsWith("http") ? route : `${url.replace(/\/$/, "")}${route}`;
    await capture(routeUrl, route);
  }

  await browser.close();

  // Write manifest
  const manifest = {
    url,
    capturedAt: new Date().toISOString(),
    viewport: { ...VIEWPORT, deviceScaleFactor: DEVICE_SCALE },
    nativeResolution: {
      width: VIEWPORT.width * DEVICE_SCALE,
      height: VIEWPORT.height * DEVICE_SCALE,
    },
    screenshots: captured,
  };

  const manifestPath = path.join(outputDir, "manifest.json");
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

  console.log(`\n✅ Captured ${captured.length} screenshot(s)`);
  console.log(`   Manifest: ${manifestPath}`);
  console.log(`   Native resolution: ${manifest.nativeResolution.width}×${manifest.nativeResolution.height}px`);
  console.log("\nScreenshots:");
  captured.forEach((s) => console.log(`  → ${s.file}`));
  console.log(
    "\nNext step: share the output folder path with Claude to generate marketing screenshots."
  );
}

main().catch((err) => {
  console.error("\n✗ Capture failed:", err.message);
  process.exit(1);
});
