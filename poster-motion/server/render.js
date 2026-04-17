'use strict';

const { bundle }                        = require('@remotion/bundler');
const { renderStill, selectComposition } = require('@remotion/renderer');
const path = require('path');
const os   = require('os');
const fs   = require('fs');

const ROOT_DIR    = path.resolve(__dirname, '..');
const ENTRY_POINT = path.join(ROOT_DIR, 'src', 'index.tsx');
const STUDIO_ENTRY = path.join(
  ROOT_DIR, 'node_modules/@remotion/studio/dist/esm/renderEntry.mjs'
);

let cachedBundle = null;

async function getBundle() {
  if (!cachedBundle) {
    console.log('[render] Bundling Remotion project...');
    cachedBundle = await bundle({
      entryPoint: ENTRY_POINT,
      webpackOverride: (config) => ({
        ...config,
        resolve: {
          ...config.resolve,
          alias: {
            ...config.resolve?.alias,
            '@remotion/studio/renderEntry': STUDIO_ENTRY,
          },
        },
      }),
    });
    console.log('[render] Bundle ready.');
  }
  return cachedBundle;
}

/**
 * Render a single still frame and return the PNG as a Buffer.
 * No files are written to the project directory.
 * @param {object} config   BannerConfig
 * @returns {Promise<Buffer>}
 */
async function renderBannerStill(config) {
  const serveUrl = await getBundle();

  const composition = await selectComposition({
    serveUrl,
    id: 'BannerComposition',
    inputProps: { config },
  });

  const tmpPath = path.join(os.tmpdir(), `pm-${Date.now()}-${Math.random().toString(36).slice(2)}.png`);
  try {
    await renderStill({
      composition,
      serveUrl,
      output: tmpPath,
      inputProps: { config },
      frame: 45,
      imageFormat: 'png',
      overwrite: true,
    });
    return fs.readFileSync(tmpPath);
  } finally {
    fs.rmSync(tmpPath, { force: true });
  }
}

function clearBundleCache() { cachedBundle = null; }

module.exports = { renderBannerStill, clearBundleCache };
