/**
 * render.js — Trigger Remotion to render GenericPromo with a Script JSON
 */
const { bundle } = require("@remotion/bundler");
const { renderMedia, selectComposition } = require("@remotion/renderer");
const path = require("path");

const ROOT_DIR = path.resolve(__dirname, "..");
const ENTRY_POINT = path.join(ROOT_DIR, "src", "index.tsx");
const STUDIO_ENTRY = path.join(
  ROOT_DIR,
  "node_modules/@remotion/studio/dist/esm/renderEntry.mjs"
);

// Cached bundle location to avoid re-bundling on subsequent renders
let cachedBundle = null;

async function renderScript(script, outputPath, onProgress) {
  if (!cachedBundle) {
    console.log("[render] Bundling Remotion project...");
    cachedBundle = await bundle({
      entryPoint: ENTRY_POINT,
      webpackOverride: (config) => ({
        ...config,
        resolve: {
          ...config.resolve,
          alias: {
            ...config.resolve?.alias,
            "@remotion/studio/renderEntry": STUDIO_ENTRY,
          },
        },
      }),
    });
  }

  console.log("[render] Selecting GenericPromo composition...");
  const composition = await selectComposition({
    serveUrl: cachedBundle,
    id: "GenericPromo",
    inputProps: { script },
  });

  const totalFrames = composition.durationInFrames;
  console.log(`[render] ${totalFrames} frames @ ${composition.fps}fps → ${outputPath}`);

  let lastReported = -1;
  await renderMedia({
    composition,
    serveUrl: cachedBundle,
    codec: "h264",
    outputLocation: outputPath,
    inputProps: { script },
    onProgress: ({ progress }) => {
      const pct = Math.round(progress * 100);
      if (pct !== lastReported) {
        lastReported = pct;
        onProgress?.(pct);
      }
    },
  });
}

/** Invalidate bundle cache (call if source files changed) */
function clearBundleCache() {
  cachedBundle = null;
}

module.exports = { renderScript, clearBundleCache };
