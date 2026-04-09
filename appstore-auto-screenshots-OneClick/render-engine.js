// ─── Render Engine ───────────────────────────────────────────────────────────
// Shared rendering functions used by both preview.html and design-gallery.html.
// Edit here once → both pages update on next browser refresh.

const SERVER = "http://127.0.0.1:4318";

// ─── Typography defaults ──────────────────────────────────────────────────────
// Single source of truth for gallery previews.
// headlineSize / subtitleSize mirror the midpoint of the ranges in generateStyleRecipe.
// When you change the ranges in screenshot-server.js, update these values too.
const TYPO_DEFAULTS = {
  font: '"SF Pro Display", -apple-system, sans-serif',
  headlineWeight: 900, headlineTracking: '-0.03em', headlineSize: 0.124,
  subtitleWeight: 400, subtitleSize: 0.046,
};

const MK_W = 1022, MK_H = 2082;
const SC_L = (52 / MK_W) * 100;
const SC_T = (46 / MK_H) * 100;
const SC_W = (918 / MK_W) * 100;
const SC_H = (1990 / MK_H) * 100;
const SC_RX = (126 / 918) * 100;
const SC_RY = (126 / 1990) * 100;

// ─── Slide rendering ──────────────────────────────────────────────────────────

function decorationSvg(dec, canvasW, canvasH) {
  const sizeMap = { sm: 1.30, md: 1.80, lg: 2.30, xl: 2.80 };
  const svgSize = canvasW * (sizeMap[dec.size] || 0.6);
  let posStyle = "";
  switch (dec.position) {
    case "top-right":    posStyle = `top:-${svgSize*0.3}px;right:-${svgSize*0.3}px;`; break;
    case "bottom-left":  posStyle = `bottom:-${svgSize*0.3}px;left:-${svgSize*0.3}px;`; break;
    case "top-left":     posStyle = `top:-${svgSize*0.25}px;left:-${svgSize*0.25}px;`; break;
    case "bottom-right": posStyle = `bottom:-${svgSize*0.25}px;right:-${svgSize*0.25}px;`; break;
    case "center-left":  posStyle = `top:${(canvasH-svgSize)/2}px;left:-${svgSize*0.2}px;`; break;
    case "center-right": posStyle = `top:${(canvasH-svgSize)/2}px;right:-${svgSize*0.2}px;`; break;
    default:             posStyle = `top:0;right:0;`;
  }
  const transform = `rotate(${dec.rotation}deg) scale(${dec.scale})`;

  if (dec.isRing) {
    // Mono-luxe concentric rings — all values canvas-relative to match old project's visual scale
    // Old project used absolute px (gap=24, sw=2.5) in a ~390px CSS space; here we scale by canvasW/390
    const sizeToMaxR = { sm: 0.9, md: 1.3, lg: 1.7, xl: 2.1 };
    const maxR  = Math.round(canvasW * (sizeToMaxR[dec.size] || 1.3));
    const gap   = Math.max(20, Math.round(canvasW * 0.062));   // 24px@390 → ~82px@1320
    const swMax = Math.max(2.5, canvasW * 0.0062);             // 2.5px@390 → ~8.2px@1320
    const swMin = Math.max(0.8, canvasW * 0.002);              // 0.8px@390 → ~2.6px@1320
    const originMap = {
      'top-right':    [canvasW, 0],
      'bottom-left':  [0,       canvasH],
      'top-left':     [0,       0],
      'bottom-right': [canvasW, canvasH],
      'center-left':  [0,       canvasH * 0.5],
      'center-right': [canvasW, canvasH * 0.5],
    };
    const [ocx, ocy] = originMap[dec.position] || [canvasW * 0.5, canvasH * 0.62];
    const ringColor = dec.color.replace(/rgba\((\d+),\s*(\d+),\s*(\d+),\s*[\d.]+\)/, 'rgba($1,$2,$3,1)');
    let rings = "";
    for (let r = gap; r <= maxR; r += gap) {
      const sw = Math.max(swMin, swMax - (swMax - swMin) * (r / maxR)).toFixed(2);
      const op = (0.82 * Math.pow(0.88, (r / gap) - 1)).toFixed(3);
      rings += `<circle cx="${ocx}" cy="${ocy}" r="${r}" fill="none" stroke="${ringColor}" stroke-width="${sw}" opacity="${op}"/>`;
    }
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${canvasW}" height="${canvasH}" viewBox="0 0 ${canvasW} ${canvasH}"
      style="position:absolute;top:0;left:0;overflow:visible;pointer-events:none;z-index:0;">${rings}</svg>`;
  }
  if (dec.isDots) {
    // Electric-neon style: subtle dot tile across full canvas with radial ellipse mask
    // Exact replication of CSS: background-image radial-gradient 1.5px dot / 20px grid
    // + mask-image radial-gradient ellipse (black 0%, 0.30 at 55%, transparent 100%)
    // spacing and dotR canvas-relative: old project used 20px/1.5px in ~390px CSS space
    // at 1320px physical canvas that's 3.4× larger → scale accordingly
    const spacing = Math.max(20, Math.round(canvasW * 0.052));  // 20px@390 → ~69px@1320
    const dotR    = Math.max(3, Math.round(canvasW * 0.006)); // 1.5px@390 → ~4px@1320
    const uid = Math.floor(Math.random() * 0xfffff).toString(16);
    // 0.20 base opacity per dot — matches electric-neon rgba(..., 0.20) exactly
    const dotColor = dec.color.replace(/rgba\((\d+),\s*(\d+),\s*(\d+),\s*[\d.]+\)/, 'rgba($1,$2,$3,1.0)');
    // Shift mask focus with dec.position — mirrors how --pattern-x/y varies per slide in old project
    const focusMap = {
      'top-right':    ['68%', '32%'], 'bottom-left':  ['32%', '68%'],
      'top-left':     ['32%', '32%'], 'bottom-right': ['68%', '68%'],
      'center-left':  ['30%', '50%'], 'center-right': ['70%', '50%'],
    };
    const [fx, fy] = focusMap[dec.position] || ['50%', '50%'];
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${canvasW}" height="${canvasH}" viewBox="0 0 ${canvasW} ${canvasH}"
      style="position:absolute;top:0;left:0;pointer-events:none;z-index:0;">
      <defs>
        <pattern id="dp${uid}" x="0" y="0" width="${spacing}" height="${spacing}" patternUnits="userSpaceOnUse">
          <circle cx="${spacing/2}" cy="${spacing/2}" r="${dotR}" fill="${dotColor}"/>
        </pattern>
        <radialGradient id="dg${uid}" cx="${fx}" cy="${fy}" r="50%" gradientUnits="objectBoundingBox">
          <stop offset="0%"   stop-color="white" stop-opacity="1"/>
          <stop offset="55%"  stop-color="white" stop-opacity="0.30"/>
          <stop offset="100%" stop-color="white" stop-opacity="0"/>
        </radialGradient>
        <mask id="dm${uid}">
          <rect width="${canvasW}" height="${canvasH}" fill="url(#dg${uid})"/>
        </mask>
      </defs>
      <rect width="${canvasW}" height="${canvasH}" fill="url(#dp${uid})" mask="url(#dm${uid})"/>
    </svg>`;
  }
  if (dec.isCrossLines) {
    // Refined subtle grid: same pattern+mask system as dots — full canvas, radial ellipse fade
    // 0.4px hairline stroke, 24px spacing, 0.18 base opacity, centered radial fade to transparent
    // spacing and strokeW canvas-relative: old project used 10px/1px in ~390px CSS space
    const spacing = Math.max(40, Math.round(canvasW * 0.052));           // 10px@390 → ~34px@1320
    const strokeW = Math.max(0.8, (canvasW * 0.0052)).toFixed(2);        // 1px@390  → ~3.4px@1320
    const uid = Math.floor(Math.random() * 0xfffff).toString(16);
    // 0.18 base opacity — slightly lower than dots (0.20) for even more delicate feel
    const lineColor = dec.color.replace(/rgba\((\d+),\s*(\d+),\s*(\d+),\s*[\d.]+\)/, 'rgba($1,$2,$3,1.0)');
    // Same focus-shift logic as dots
    const focusMap = {
      'top-right':    ['68%', '32%'], 'bottom-left':  ['32%', '68%'],
      'top-left':     ['32%', '32%'], 'bottom-right': ['68%', '68%'],
      'center-left':  ['30%', '50%'], 'center-right': ['70%', '50%'],
    };
    const [fx, fy] = focusMap[dec.position] || ['50%', '50%'];
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${canvasW}" height="${canvasH}" viewBox="0 0 ${canvasW} ${canvasH}"
      style="position:absolute;top:0;left:0;pointer-events:none;z-index:0;">
      <defs>
        <pattern id="gp${uid}" x="0" y="0" width="${spacing}" height="${spacing}" patternUnits="userSpaceOnUse">
          <line x1="${spacing}" y1="0" x2="${spacing}" y2="${spacing}" stroke="${lineColor}" stroke-width="${strokeW}"/>
          <line x1="0" y1="${spacing}" x2="${spacing}" y2="${spacing}" stroke="${lineColor}" stroke-width="${strokeW}"/>
        </pattern>
        <radialGradient id="gg${uid}" cx="${fx}" cy="${fy}" r="50%" gradientUnits="objectBoundingBox">
          <stop offset="0%"   stop-color="white" stop-opacity="1"/>
          <stop offset="55%"  stop-color="white" stop-opacity="0.30"/>
          <stop offset="100%" stop-color="white" stop-opacity="0"/>
        </radialGradient>
        <mask id="gm${uid}">
          <rect width="${canvasW}" height="${canvasH}" fill="url(#gg${uid})"/>
        </mask>
      </defs>
      <rect width="${canvasW}" height="${canvasH}" fill="url(#gp${uid})" mask="url(#gm${uid})"/>
    </svg>`;
  }
  if (dec.isDiagonalLines) {
    // Dark-bold style: 45-degree diagonal stripes with radial ellipse mask
    const spacing = Math.max(40, Math.round(canvasW * 0.052));
    const strokeW = Math.max(0.8, canvasW * 0.0052).toFixed(2);
    const uid = Math.floor(Math.random() * 0xfffff).toString(16);
    const lineColor = dec.color.replace(/rgba\((\d+),\s*(\d+),\s*(\d+),\s*[\d.]+\)/, 'rgba($1,$2,$3,1.0)');
    const focusMap = {
      'top-right':    ['68%','32%'], 'bottom-left':  ['32%','68%'],
      'top-left':     ['32%','32%'], 'bottom-right': ['68%','68%'],
      'center-left':  ['30%','50%'], 'center-right': ['70%','50%'],
    };
    const [fx, fy] = focusMap[dec.position] || ['50%','50%'];
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${canvasW}" height="${canvasH}" viewBox="0 0 ${canvasW} ${canvasH}"
      style="position:absolute;top:0;left:0;pointer-events:none;z-index:0;">
      <defs>
        <pattern id="dlp${uid}" x="0" y="0" width="${spacing}" height="${spacing}" patternUnits="userSpaceOnUse" patternTransform="rotate(45 ${canvasW/2} ${canvasH/2})">
          <line x1="0" y1="0" x2="0" y2="${spacing * 2}" stroke="${lineColor}" stroke-width="${strokeW}"/>
        </pattern>
        <radialGradient id="dlg${uid}" cx="${fx}" cy="${fy}" r="55%" gradientUnits="objectBoundingBox">
          <stop offset="0%"   stop-color="white" stop-opacity="1"/>
          <stop offset="52%"  stop-color="white" stop-opacity="0.25"/>
          <stop offset="100%" stop-color="white" stop-opacity="0"/>
        </radialGradient>
        <mask id="dlm${uid}">
          <rect width="${canvasW}" height="${canvasH}" fill="url(#dlg${uid})"/>
        </mask>
      </defs>
      <rect width="${canvasW}" height="${canvasH}" fill="url(#dlp${uid})" mask="url(#dlm${uid})"/>
    </svg>`;
  }
  if (dec.isStreetLines) {
    // Street-drop style: S-curve lines with accent chevron icons
    const sx = canvasW / 390, sy = canvasH / 844;
    const cxMap = {
      'top-right': 270, 'bottom-left': 120, 'top-left': 130,
      'bottom-right': 260, 'center-left': 145, 'center-right': 245,
    };
    const cxBase = cxMap[dec.position] || 195;
    const cx = cxBase * sx;
    const a  = 88 * sx;
    const getRgb = (c) => { const m = c.match(/rgba\((\d+),\s*(\d+),\s*(\d+)/); return m ? [m[1],m[2],m[3]] : ['255','255','255']; };
    const [r,g,b] = getRgb(dec.color);
    const lines = [
      { dx: 0,       op: 1.0,  w: 1.0 },
      { dx: 30*sx,   op: 0.64, w: 0.7 },
      { dx: -30*sx,  op: 0.56, w: 0.7 },
      { dx: 58*sx,   op: 0.36, w: 0.5 },
      { dx: -58*sx,  op: 0.30, w: 0.5 },
    ];
    const paths = lines.map(({ dx, op, w }) => {
      const x = cx + dx;
      const d = [
        'M', (x - a*0.45).toFixed(1), canvasH.toFixed(1),
        'C', (x + a*1.1).toFixed(1),  (0.758*canvasH).toFixed(1),
             (x - a*1.1).toFixed(1),  (0.509*canvasH).toFixed(1),
             x.toFixed(1),             (0.5*canvasH).toFixed(1),
        'S', (x + a*1.1).toFixed(1),  (0.225*canvasH).toFixed(1),
             (x + a*0.45).toFixed(1), '0',
      ].join(' ');
      return `<path d="${d}" stroke="rgba(${r},${g},${b},${op})" stroke-width="${(w*sx).toFixed(2)}" fill="none"/>`;
    }).join('');
    const chevronPositions = [
      { icx: 44*sx, icy: 82*sy }, { icx: 350*sx, icy: 410*sy }, { icx: 36*sx, icy: 760*sy },
    ];
    const chevrons = chevronPositions.map(({ icx, icy }) => {
      const s = 22 * sx;
      const tx = icx.toFixed(1), ty = (icy - s*0.38).toFixed(1);
      const lx = (icx - s*0.42).toFixed(1), ly = (icy + s*0.28).toFixed(1), rx = (icx + s*0.42).toFixed(1);
      return `<path d="M ${lx},${ly} L ${tx},${ty} L ${rx},${ly}" stroke="rgba(${r},${g},${b},1.0)" stroke-width="${(2.8*sx).toFixed(2)}" fill="none"/>`;
    }).join('');
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${canvasW}" height="${canvasH}" viewBox="0 0 ${canvasW} ${canvasH}"
      style="position:absolute;top:0;left:0;pointer-events:none;z-index:0;">
      <g fill="none" stroke-linecap="round" stroke-linejoin="round">${paths}${chevrons}</g>
    </svg>`;
  }
  if (dec.isNoiseGrain) {
    // Noise grain: two stacked layers — hard-light + overlay for strong visible grain
    const uid = Math.floor(Math.random() * 0xfffff).toString(16);
    const seed = Math.floor(dec.rotation * 0.27) % 100;
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${canvasW}" height="${canvasH}" viewBox="0 0 ${canvasW} ${canvasH}"
      style="position:absolute;top:0;left:0;pointer-events:none;z-index:1;mix-blend-mode:hard-light;opacity:0.10;">
      <filter id="ngf${uid}" x="0%" y="0%" width="100%" height="100%" color-interpolation-filters="sRGB">
        <feTurbulence type="fractalNoise" baseFrequency="0.68" numOctaves="3" seed="${seed}" stitchTiles="stitch" result="noise"/>
        <feColorMatrix type="saturate" values="0" in="noise" result="gray"/>
        <feComponentTransfer in="gray">
          <feFuncR type="linear" slope="8" intercept="-3.5"/>
          <feFuncG type="linear" slope="8" intercept="-3.5"/>
          <feFuncB type="linear" slope="8" intercept="-3.5"/>
        </feComponentTransfer>
      </filter>
      <rect width="${canvasW}" height="${canvasH}" filter="url(#ngf${uid})"/>
    </svg>
    <svg xmlns="http://www.w3.org/2000/svg" width="${canvasW}" height="${canvasH}" viewBox="0 0 ${canvasW} ${canvasH}"
      style="position:absolute;top:0;left:0;pointer-events:none;z-index:1;mix-blend-mode:overlay;opacity:0.09;">
      <filter id="ngf2${uid}" x="0%" y="0%" width="100%" height="100%" color-interpolation-filters="sRGB">
        <feTurbulence type="fractalNoise" baseFrequency="0.78" numOctaves="4" seed="${seed + 13}" stitchTiles="stitch" result="noise"/>
        <feColorMatrix type="saturate" values="0" in="noise"/>
      </filter>
      <rect width="${canvasW}" height="${canvasH}" filter="url(#ngf2${uid})"/>
    </svg>`;
  }
  if (dec.isCenterPulse) {
    // Center pulse: concentric diamonds expanding from bottom-center — geometric radar feel
    const ocx = canvasW * 0.5, ocy = canvasH * 0.67;
    const maxR = canvasW * 1.1;
    const gap = canvasW * 0.082;
    const getRgb = (c) => { const m = c.match(/rgba\((\d+),\s*(\d+),\s*(\d+)/); return m ? [m[1],m[2],m[3]] : ['108','99','255']; };
    const [r, g, b] = getRgb(dec.color);
    const swBase = Math.max(0.5, canvasW * 0.00125);
    let shapes = '';
    for (let i = 1; i * gap <= maxR + gap; i++) {
      const rad = i * gap;
      const op = (0.95 * Math.pow(0.82, i - 1)).toFixed(3);
      const sw = Math.max(0.15, swBase - i * 0.045).toFixed(2);
      const cx = ocx, cy = ocy;
      const d = `M ${cx.toFixed(1)},${(cy - rad).toFixed(1)} L ${(cx + rad).toFixed(1)},${cy.toFixed(1)} L ${cx.toFixed(1)},${(cy + rad).toFixed(1)} L ${(cx - rad).toFixed(1)},${cy.toFixed(1)} Z`;
      shapes += `<path d="${d}" fill="none" stroke="rgba(${r},${g},${b},1)" stroke-width="${sw}" opacity="${op}"/>`;
    }
    const dotR = (canvasW * 0.008).toFixed(1);
    shapes += `<circle cx="${ocx.toFixed(1)}" cy="${ocy.toFixed(1)}" r="${dotR}" fill="rgba(${r},${g},${b},0.9)"/>`;
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${canvasW}" height="${canvasH}" viewBox="0 0 ${canvasW} ${canvasH}"
      style="position:absolute;top:0;left:0;pointer-events:none;z-index:0;overflow:visible;">${shapes}</svg>`;
  }
  if (dec.isScanlines) {
    // Scanlines: white semi-transparent stripes — visible on both dark and light backgrounds
    const lineH = Math.max(3, Math.round(canvasH * 0.0014));
    return `<div style="position:absolute;inset:0;pointer-events:none;z-index:2;background:repeating-linear-gradient(to bottom,transparent 0px,transparent ${lineH}px,rgba(255,255,255,0.06) ${lineH}px,rgba(255,255,255,0.06) ${lineH + 1}px);"></div>`;
  }
  if (dec.isHairlineGrid) {
    // Hairline grid: ultra-thin SVG pattern grid + radial fade mask + axis lines + crosshair markers
    const uid = Math.floor(Math.random() * 0xfffff).toString(16);
    const spacing = Math.max(24, Math.round(canvasW * 0.024));
    const sw = Math.max(2.5, canvasW * 0.0030).toFixed(2);
    const getRgb = (c) => { const m = c.match(/rgba\((\d+),\s*(\d+),\s*(\d+)/); return m ? [m[1],m[2],m[3]] : ['99','102','241']; };
    const [r, g, b] = getRgb(dec.color);
    const cx = canvasW * 0.5, cy = canvasH * 0.5;
    const cmSize = Math.round(canvasW * 0.025);
    // Each crosshair has 4 arms with independently varied lengths (0.4–1.0× cmSize) and opacities
    // [left, right, up, down, hShift, vShift] — arms in cmSize units, shifts offset the crossing point
    const armSeeds = [
      [1.00, 0.28, 0.42, 1.35, 0.18, -0.12],
      [0.32, 1.20, 1.40, 0.35, -0.20, 0.15],
      [1.30, 0.22, 0.60, 1.10, 0.10, 0.22],
      [0.45, 1.35, 0.30, 0.80, -0.15, -0.18],
    ];
    const markers = [
      [canvasW * 0.32, canvasH * 0.25], [canvasW * 0.68, canvasH * 0.25],
      [canvasW * 0.32, canvasH * 0.75], [canvasW * 0.68, canvasH * 0.75],
    ].map(([mx, my], idx) => {
      const [aL, aR, aU, aD, hs, vs] = armSeeds[idx];
      const ox = mx + Math.round(cmSize * hs), oy = my + Math.round(cmSize * vs);
      const x1 = (ox - Math.round(cmSize * aL)).toFixed(1), x2 = (ox + Math.round(cmSize * aR)).toFixed(1);
      const y1 = (oy - Math.round(cmSize * aU)).toFixed(1), y2 = (oy + Math.round(cmSize * aD)).toFixed(1);
      const sw2 = Math.max(2.0, canvasW * 0.0020).toFixed(2);
      return `<line x1="${x1}" y1="${oy.toFixed(1)}" x2="${x2}" y2="${oy.toFixed(1)}" stroke="rgba(${r},${g},${b},0.85)" stroke-width="${sw2}"/>
        <line x1="${ox.toFixed(1)}" y1="${y1}" x2="${ox.toFixed(1)}" y2="${y2}" stroke="rgba(${r},${g},${b},0.85)" stroke-width="${sw2}"/>`;
    }).join('');
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${canvasW}" height="${canvasH}" viewBox="0 0 ${canvasW} ${canvasH}"
      style="position:absolute;top:0;left:0;pointer-events:none;z-index:0;">
      <defs>
        <pattern id="hgg${uid}" x="0" y="0" width="${spacing}" height="${spacing}" patternUnits="userSpaceOnUse">
          <path d="M ${spacing} 0 L 0 0 0 ${spacing}" fill="none" stroke="rgba(${r},${g},${b},0.70)" stroke-width="${sw}"/>
        </pattern>
        <radialGradient id="hgm${uid}" cx="50%" cy="48%" r="58%">
          <stop offset="0%"   stop-color="white" stop-opacity="1"/>
          <stop offset="60%"  stop-color="white" stop-opacity="0.5"/>
          <stop offset="100%" stop-color="white" stop-opacity="0"/>
        </radialGradient>
        <mask id="hgmk${uid}"><rect width="${canvasW}" height="${canvasH}" fill="url(#hgm${uid})"/></mask>
      </defs>
      <rect width="${canvasW}" height="${canvasH}" fill="url(#hgg${uid})" mask="url(#hgmk${uid})"/>
      <line x1="${cx.toFixed(1)}" y1="0" x2="${cx.toFixed(1)}" y2="${canvasH}" stroke="rgba(${r},${g},${b},0.75)" stroke-width="${Math.max(2.0, canvasW * 0.0020).toFixed(2)}"/>
      <line x1="0" y1="${cy.toFixed(1)}" x2="${canvasW}" y2="${cy.toFixed(1)}" stroke="rgba(${r},${g},${b},0.75)" stroke-width="${Math.max(2.0, canvasW * 0.0020).toFixed(2)}"/>
      ${markers}
    </svg>`;
  }
  // Glow: pure CSS radial-gradient div — matches old project's natural breathing feel
  // No SVG filter blur; the gradient fades smoothly to transparent on its own,
  // identical to the .render-slide::before/::after approach in appstore-auto-screenshots.
  const glowSize = Math.round(svgSize * 0.90);
  // Boost alpha to match old project's luminosity (old: rgba(accent, 0.48) * opacity 0.7 ≈ 0.34 center)
  const glowColor = dec.color.replace(
    /rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)/,
    (_, r, g, b, a) => `rgba(${r},${g},${b},${Math.min(0.52, parseFloat(a) * 1.6).toFixed(2)})`
  );
  return `<div style="position:absolute;${posStyle}width:${glowSize}px;height:${glowSize}px;border-radius:50%;background:radial-gradient(circle,${glowColor} 0%,transparent 70%);transform:${transform};pointer-events:none;z-index:0;"></div>`;
}

function phoneSvg(canvasW, screenshotUrl, accentHex, showReflection = false) {
  const phoneW = Math.round(canvasW * 0.72);
  const mockupSrc = `${SERVER}/assets/iphone-mockup.png`;
  const ah = (accentHex || '#6c63ff').replace('#', '');
  const ar = parseInt(ah.slice(0, 2), 16);
  const ag = parseInt(ah.slice(2, 4), 16);
  const ab = parseInt(ah.slice(4, 6), 16);
  // Inner phone content — shared between main render and reflection clone
  const phoneInner = `
    <div style="position:absolute;inset:9% 7% 3%;border-radius:26%;background:radial-gradient(circle at 50% 18%,rgba(${ar},${ag},${ab},0.16) 0%,transparent 40%),radial-gradient(circle at 52% 68%,rgba(6,10,18,0.24) 0%,transparent 72%);filter:blur(28px);opacity:0.9;transform:scale(1.02);pointer-events:none;z-index:0;"></div>
    <div style="position:absolute;inset:11% 12% 1%;border-radius:30%;background:radial-gradient(circle at 50% 30%,rgba(255,255,255,0.08) 0%,transparent 45%),radial-gradient(circle at 50% 76%,rgba(6,10,18,0.38) 0%,transparent 68%);filter:blur(32px);opacity:0.78;transform:translateY(4%);pointer-events:none;z-index:0;"></div>
    <div style="position:absolute;inset:1.1% 2.8% 0.9%;border-radius:11.5%/5.8%;background:linear-gradient(180deg,rgba(255,255,255,0.32),rgba(255,255,255,0.06) 7%,rgba(8,10,14,0.10) 100%),linear-gradient(120deg,rgba(245,216,160,0.55),rgba(255,255,255,0.12) 18%,rgba(24,28,36,0.30) 52%,rgba(242,222,187,0.42) 82%,rgba(255,255,255,0.18));box-shadow:0 28px 60px rgba(2,4,10,0.42),0 10px 24px rgba(2,4,10,0.28),0 0 0 1px rgba(255,255,255,0.10);opacity:0.82;pointer-events:none;"></div>
    <img src="${mockupSrc}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:contain;z-index:2;pointer-events:none;user-select:none;" loading="eager" decoding="sync" />
    <div style="position:absolute;left:${SC_L.toFixed(3)}%;top:${SC_T.toFixed(3)}%;width:${SC_W.toFixed(3)}%;height:${SC_H.toFixed(3)}%;border-radius:${SC_RX.toFixed(3)}%/${SC_RY.toFixed(3)}%;overflow:hidden;background:#04060b;z-index:3;box-shadow:inset 0 0 0 1px rgba(255,255,255,0.08),inset 0 -24px 40px rgba(0,0,0,0.22),inset 0 24px 32px rgba(255,255,255,0.04);">
      <img src="${screenshotUrl}" style="display:block;width:100%;height:100%;object-fit:cover;object-position:top;" loading="eager" decoding="sync" />
      <div style="position:absolute;inset:0;background:linear-gradient(180deg,rgba(255,255,255,0.11),transparent 18%,transparent 78%,rgba(0,0,0,0.12)),linear-gradient(90deg,rgba(255,255,255,0.04),transparent 20%,transparent 80%,rgba(0,0,0,0.06));z-index:2;pointer-events:none;"></div>
    </div>`;
  // Glass reflection platform (clean-light style) — mirrored clone fading downward
  const reflectionHtml = showReflection ? `
    <div style="position:absolute;top:100%;left:-6%;width:112%;height:${Math.round(canvasW * 0.56)}px;overflow:hidden;pointer-events:none;z-index:0;">
      <div style="position:absolute;top:0;left:8%;width:84%;height:1px;background:linear-gradient(90deg,transparent,rgba(200,220,255,0.5) 20%,rgba(220,235,255,0.85) 50%,rgba(200,220,255,0.5) 80%,transparent);z-index:2;"></div>
      <div style="position:absolute;top:0;left:6%;width:88%;aspect-ratio:${MK_W}/${MK_H};transform:scaleY(-1);transform-origin:center center;opacity:0.24;filter:blur(0.6px) saturate(0.5) brightness(1.0);-webkit-mask-image:linear-gradient(to top,rgba(0,0,0,0.9) 0%,rgba(0,0,0,0.55) 28%,rgba(0,0,0,0.15) 55%,transparent 78%);mask-image:linear-gradient(to top,rgba(0,0,0,0.9) 0%,rgba(0,0,0,0.55) 28%,rgba(0,0,0,0.15) 55%,transparent 78%);pointer-events:none;">${phoneInner}</div>
    </div>` : '';
  return `<div style="width:${phoneW}px;aspect-ratio:${MK_W}/${MK_H};position:relative;flex-shrink:0;">${phoneInner}${reflectionHtml}</div>`;
}

function ghostFrameHtml(canvasW, canvasH, recipe) {
  if (!recipe.ghostFrames) return '';
  const p = recipe.palette;
  const phoneW = Math.round(canvasW * 0.58);
  const getRgb = (hex) => {
    const h = (hex||'#6c63ff').replace('#','');
    return [parseInt(h.slice(0,2),16), parseInt(h.slice(2,4),16), parseInt(h.slice(4,6),16)];
  };
  const [r1,g1,b1] = getRgb(p.accent);
  const [r2,g2,b2] = getRgb(p.accent2);
  const bw = Math.max(1, Math.round(canvasW * 0.002));
  const glowPx = Math.round(canvasW * 0.04);
  const left  = `<div style="position:absolute;left:-14%;bottom:4%;width:${phoneW}px;aspect-ratio:${MK_W}/${MK_H};border-radius:11.5%/5.8%;border:${bw}px solid rgba(${r1},${g1},${b1},0.32);background:linear-gradient(160deg,rgba(${r1},${g1},${b1},0.05),transparent);box-shadow:0 0 ${glowPx}px rgba(${r1},${g1},${b1},0.15);transform:rotate(-9deg);opacity:0.75;pointer-events:none;z-index:1;"></div>`;
  const right = `<div style="position:absolute;right:-14%;bottom:4%;width:${phoneW}px;aspect-ratio:${MK_W}/${MK_H};border-radius:11.5%/5.8%;border:${bw}px solid rgba(${r2},${g2},${b2},0.28);background:linear-gradient(160deg,rgba(${r2},${g2},${b2},0.05),transparent);box-shadow:0 0 ${glowPx}px rgba(${r2},${g2},${b2},0.14);transform:rotate(8deg);opacity:0.65;pointer-events:none;z-index:1;"></div>`;
  return left + right;
}

// Compute headline font size in px, clamped to fit the available width per layout.
// Chinese: CJK chars are 1em wide; with -0.03em tracking → 0.97em effective.
// English: bold SF Pro Display averages ~0.52em per character.
function calcHeadlineSize(canvasW, t, rawHeadline, layout) {
  const basePx = Math.round(canvasW * t.headlineSize);
  const lines = (rawHeadline || '').split('\n');
  const tightLayouts = ['right', 'left', 'bottom-right', 'bottom-left'];
  const availW = tightLayouts.includes(layout)
    ? Math.round(canvasW * 0.58)   // 679px @ 1170
    : Math.round(canvasW * 0.84);  // 983px @ 1170

  if (/[\u4e00-\u9fff]/.test(rawHeadline)) {
    const maxCjk = Math.max(...lines.map(l => [...l].filter(c => /[\u4e00-\u9fff]/.test(c)).length));
    if (maxCjk === 0) return basePx;
    return Math.min(basePx, Math.floor(availW / (maxCjk * 0.97)));
  } else {
    const maxLen = Math.max(...lines.map(l => l.trim().length));
    if (maxLen === 0) return basePx;
    return Math.min(basePx, Math.floor(availW / (maxLen * 0.52)));
  }
}

function buildSlideHtml(recipe, copySlide, screenshotUrl, canvasW, canvasH) {
  const p = recipe.palette;
  const t = recipe.typography;
  const layout = copySlide.layout || "hero";
  const rawHeadline = copySlide.headline || "";
  const headline  = rawHeadline.replace(/\n/g, "<br/>");
  // Scale phone & text down proportionally on shorter canvases (e.g. 1080x1920 vs iPhone ~2.17 ratio)
  const refAspect = 2868 / 1320;
  const phoneScale = Math.min(1.0, (canvasH / canvasW) / refAspect);
  const headlineSize = Math.round(calcHeadlineSize(canvasW, t, rawHeadline, layout) * phoneScale);
  const subtitleSize = Math.round(canvasW * t.subtitleSize * phoneScale);
  const subtitle  = copySlide.subtitle || "";
  const decorHtml = (recipe.decorations || []).map((d) => decorationSvg(d, canvasW, canvasH)).join("");
  const showRefl  = recipe.glassReflection || false;
  const basePhoneW = `width:${Math.round(canvasW*0.72)}px`;
  const phoneHtml    = phoneSvg(canvasW, screenshotUrl, p.accent, showRefl)
    .replace(basePhoneW, `width:${Math.round(canvasW*0.72*phoneScale)}px`);
  const phoneWide    = phoneSvg(canvasW, screenshotUrl, p.accent, showRefl)
    .replace(basePhoneW, `width:${Math.round(canvasW*0.78*phoneScale)}px`);
  const phoneSmall   = phoneSvg(canvasW, screenshotUrl, p.accent, showRefl)
    .replace(basePhoneW, `width:${Math.round(canvasW*0.65*phoneScale)}px`);
  const phoneMid     = phoneSvg(canvasW, screenshotUrl, p.accent, showRefl)
    .replace(basePhoneW, `width:${Math.round(canvasW*0.68*phoneScale)}px`);
  const phoneDuoBack = phoneSvg(canvasW, screenshotUrl, p.accent, false)
    .replace(basePhoneW, `width:${Math.round(canvasW*0.60*phoneScale)}px`);
  const ghosts = ghostFrameHtml(canvasW, canvasH, recipe);

  let innerHtml = "";
  if (layout === "hero") {
    const heroTiltY = recipe.heroTiltDir === 'right' ? 14 : -14;
    const heroTiltTransform = `perspective(900px) translateX(-50%) translateY(10%) rotateY(${heroTiltY}deg) rotateX(-4deg)`;
    innerHtml = `
      <div style="position:absolute;top:${Math.round(canvasH*0.0833)}px;left:0;right:0;text-align:center;z-index:10;padding:0 ${Math.round(canvasW*0.08)}px;">
        <div style="font-size:${headlineSize}px;font-weight:${t.headlineWeight};letter-spacing:${t.headlineTracking};line-height:1.1;color:${p.text};overflow-wrap:break-word;word-break:keep-all;">${headline}</div>
        <div style="font-size:${subtitleSize}px;color:${p.muted};margin-top:${Math.round(canvasH*0.022)}px;line-height:1.5;overflow-wrap:break-word;word-break:keep-all;">${subtitle}</div>
      </div>
      <div style="position:absolute;bottom:0;left:50%;transform:${heroTiltTransform} scale(1.21);z-index:5;">${phoneHtml}</div>`;
  } else if (layout === "right") {
    innerHtml = `
      <div style="position:absolute;top:${Math.round(canvasH*0.0833)}px;left:${Math.round(canvasW*0.08)}px;z-index:10;max-width:${Math.round(canvasW*0.58)}px;">
        <div style="font-size:${headlineSize}px;font-weight:${t.headlineWeight};letter-spacing:${t.headlineTracking};line-height:1.1;color:${p.text};overflow-wrap:break-word;word-break:keep-all;">${headline}</div>
        <div style="font-size:${subtitleSize}px;color:${p.muted};margin-top:${Math.round(canvasH*0.02)}px;line-height:1.5;overflow-wrap:break-word;word-break:keep-all;">${subtitle}</div>
      </div>
      <div style="position:absolute;bottom:-120px;right:-4%;z-index:5;transform:scale(1.1);transform-origin:bottom right;">${phoneWide}</div>`;
  } else if (layout === "left") {
    innerHtml = `
      <div style="position:absolute;top:${Math.round(canvasH*0.0833)}px;right:${Math.round(canvasW*0.08)}px;z-index:10;max-width:${Math.round(canvasW*0.58)}px;text-align:right;">
        <div style="font-size:${headlineSize}px;font-weight:${t.headlineWeight};letter-spacing:${t.headlineTracking};line-height:1.1;color:${p.text};overflow-wrap:break-word;word-break:keep-all;">${headline}</div>
        <div style="font-size:${subtitleSize}px;color:${p.muted};margin-top:${Math.round(canvasH*0.02)}px;line-height:1.5;overflow-wrap:break-word;word-break:keep-all;">${subtitle}</div>
      </div>
      <div style="position:absolute;bottom:-120px;left:-4%;z-index:5;transform:scale(1.1);transform-origin:bottom left;">${phoneWide}</div>`;
  } else if (layout === "duo") {
    innerHtml = `
      <div style="position:absolute;top:${Math.round(canvasH*0.0833)}px;left:0;right:0;text-align:center;z-index:10;padding:0 ${Math.round(canvasW*0.06)}px;">
        <div style="font-size:${headlineSize}px;font-weight:${t.headlineWeight};letter-spacing:${t.headlineTracking};line-height:1.1;color:${p.text};overflow-wrap:break-word;word-break:keep-all;">${headline}</div>
        <div style="font-size:${subtitleSize}px;color:${p.muted};margin-top:${Math.round(canvasH*0.018)}px;line-height:1.5;overflow-wrap:break-word;word-break:keep-all;">${subtitle}</div>
      </div>
      <div style="position:absolute;bottom:-40px;left:calc(-8% + 140px);z-index:4;opacity:0.55;transform:rotate(-6deg) scale(1.1);transform-origin:bottom left;">${phoneDuoBack}</div>
      <div style="position:absolute;bottom:-230px;right:calc(-3% + 125px);z-index:5;transform:rotate(6deg) scale(1.21);transform-origin:bottom right;">${phoneHtml}</div>`;
  } else if (layout === "trust") {
    const phoneTrust = phoneSvg(canvasW, screenshotUrl, p.accent, true).replace(basePhoneW, `width:${Math.round(canvasW*0.703*phoneScale)}px`);
    innerHtml = `
      <div style="position:absolute;top:${Math.round(canvasH*0.07)}px;left:0;right:0;text-align:center;z-index:10;padding:0 ${Math.round(canvasW*0.1)}px;">
        <div style="font-size:${headlineSize}px;font-weight:${t.headlineWeight};letter-spacing:${t.headlineTracking};line-height:1.1;color:${p.text};overflow-wrap:break-word;word-break:keep-all;">${headline}</div>
      </div>
      <div style="position:absolute;bottom:${Math.round(canvasH*0.04) + 32}px;left:50%;transform:translateX(-50%) scale(1.1);transform-origin:bottom center;z-index:5;">${phoneTrust}</div>`;
  } else if (layout === "bottom-right") {
    innerHtml = `
      <div style="position:absolute;bottom:${Math.round(canvasH*0.0833)}px;left:${Math.round(canvasW*0.08)}px;z-index:10;max-width:${Math.round(canvasW*0.58)}px;">
        <div style="font-size:${headlineSize}px;font-weight:${t.headlineWeight};letter-spacing:${t.headlineTracking};line-height:1.1;color:${p.text};overflow-wrap:break-word;word-break:keep-all;">${headline}</div>
        <div style="font-size:${subtitleSize}px;color:${p.muted};margin-top:${Math.round(canvasH*0.02)}px;line-height:1.5;overflow-wrap:break-word;word-break:keep-all;">${subtitle}</div>
      </div>
      <div style="position:absolute;top:-120px;right:-4%;z-index:5;transform:scale(1.1);transform-origin:top right;">${phoneWide}</div>`;
  } else if (layout === "bottom-left") {
    innerHtml = `
      <div style="position:absolute;bottom:${Math.round(canvasH*0.0833)}px;right:${Math.round(canvasW*0.08)}px;z-index:10;max-width:${Math.round(canvasW*0.58)}px;text-align:right;">
        <div style="font-size:${headlineSize}px;font-weight:${t.headlineWeight};letter-spacing:${t.headlineTracking};line-height:1.1;color:${p.text};overflow-wrap:break-word;word-break:keep-all;">${headline}</div>
        <div style="font-size:${subtitleSize}px;color:${p.muted};margin-top:${Math.round(canvasH*0.02)}px;line-height:1.5;overflow-wrap:break-word;word-break:keep-all;">${subtitle}</div>
      </div>
      <div style="position:absolute;top:-120px;left:-4%;z-index:5;transform:scale(1.1);transform-origin:top left;">${phoneWide}</div>`;
  } else {
    innerHtml = `
      <div style="position:absolute;bottom:${Math.round(canvasH*0.06)}px;left:0;right:0;text-align:center;z-index:10;padding:0 ${Math.round(canvasW*0.08)}px;">
        <div style="font-size:${headlineSize}px;font-weight:${t.headlineWeight};letter-spacing:${t.headlineTracking};line-height:1.1;color:${p.text};overflow-wrap:break-word;word-break:keep-all;">${headline}</div>
        <div style="font-size:${subtitleSize}px;color:${p.muted};margin-top:${Math.round(canvasH*0.015)}px;line-height:1.5;overflow-wrap:break-word;word-break:keep-all;">${subtitle}</div>
      </div>
      <div style="position:absolute;top:${Math.round(canvasH*0.04)}px;left:50%;transform:translateX(-50%) scale(1.1);transform-origin:top center;z-index:5;">${phoneMid}</div>`;
  }

  const fontImport = t.fontsUrl ? `<style>@import url('${t.fontsUrl}');</style>` : "";
  return `${fontImport}<div data-export-root style="width:${canvasW}px;height:${canvasH}px;background:linear-gradient(160deg,${p.bg} 0%,${p.bgEnd} 100%);font-family:${t.font};position:relative;overflow:hidden;flex-shrink:0;">${decorHtml}${ghosts}${innerHtml}</div>`;
}
