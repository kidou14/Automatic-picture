---
name: appstore-auto-screenshots-OneClick
description: Use when you need to auto-generate Apple App Store marketing screenshots with a single command — no style selection required. Each generation produces a completely unique visual identity driven by algorithmic color theory and AI-generated copy. Triggers on: one-click screenshots, random style app store screenshots, 一键生成上架图, auto app store screenshots, unique style marketing screenshots.
---

# App Store Screenshots — OneClick

## What Makes This Different

Unlike standard screenshot generators where you choose from preset styles, **OneClick generates a completely unique visual identity each time**:

- **Algorithmic color palettes** — random starting hue × color harmony rule × mood mode = a fresh palette derived from first principles, never from a preset list
- **Procedural SVG decorations** — 15+ decoration types (organic blobs, geometric shapes, dot grids, rings, cross-lines) randomly configured each run
- **AI-generated copy** — Claude analyzes real screenshots and writes headlines unique to this app and this moment
- **Random layout sequence** — 6 layout archetypes (hero / right / left / duo / trust / center) shuffled fresh each time

Run it twice on the same app → two completely different-looking screenshot sets.

---

## Phase 0: Collect Input

Ask **all three in a single message** — do not ask separately, do not ask anything else.

1. **App URL** — "What is the URL of your running app?"
   - If static HTML: `cd <folder> && npx serve . -p 3000`
   - If React/Vite: `npm run dev`
2. **App name** — "What is your app called?"
3. **One-sentence description** — "In one sentence, what does your app do and who is it for?"

**Do NOT ask about:** visual style, colors, fonts, number of slides, layout — the system decides everything automatically.

---

## Phase 1: Check the App and Install Dependencies

### Step 1.1 — Verify the app is reachable

```bash
curl -s -o /dev/null -w "%{http_code}" <URL>
```

If not 200, guide the user to start their app first.

### Step 1.2 — Verify Playwright

```bash
cd appstore-auto-screenshots-OneClick
node -e "require('playwright')" 2>/dev/null && echo "ok" || npm install && npx playwright install chromium
```

---

## Phase 2: Run the OneClick Pipeline

The entire pipeline — screenshot capture → style recipe generation → AI copy — runs in one command via the local server.

### Step 2.1 — Start the server (if not running)

```bash
cd appstore-auto-screenshots-OneClick
bash start.sh &
# Wait for: "✦ OneClick screenshot server running at http://127.0.0.1:4318"
```

### Step 2.2 — Trigger the one-click capture

```bash
curl -s -X POST http://127.0.0.1:4318/api/oneclick-capture \
  -H "Content-Type: application/json" \
  -d '{
    "url": "<APP_URL>",
    "appName": "<APP_NAME>",
    "description": "<ONE_SENTENCE_DESCRIPTION>"
  }'
# Returns: { "jobId": "job_...", "status": "running" }
```

### Step 2.3 — Poll until complete

```bash
# Poll every 2 seconds
curl -s http://127.0.0.1:4318/api/capture-jobs/<jobId>
```

When `status === "completed"`, the response contains:
- `screenshots[]` — array of captured PNG data URLs
- `recipe` — the generated style recipe (mood, palette, typography, decorations, copy, layouts)

Report to the user:
- The **mood name** (e.g. "Dusk Neon", "Arctic Dawn")
- The **color harmony** (e.g. "triadic")
- Number of screenshots captured

---

## Phase 3: Build the Next.js Generator

This phase creates a standalone Next.js app that renders and exports all slides at full Apple-required resolutions.

### Step 3.1 — Detect package manager

```bash
which bun && echo "bun" || which pnpm && echo "pnpm" || which yarn && echo "yarn" || echo "npm"
```

### Step 3.2 — Scaffold Next.js

```bash
# bun (preferred)
bunx create-next-app@latest . --typescript --tailwind --app --src-dir --no-eslint --import-alias "@/*"
bun add html-to-image

# npm fallback
npx create-next-app@latest . --typescript --tailwind --app --src-dir --no-eslint --import-alias "@/*"
npm install html-to-image
```

### Step 3.3 — Copy assets

```bash
mkdir -p public/screenshots
# Copy captured screenshots from job data to public/screenshots/
# Copy iPhone mockup if available:
cp ../app-store-screenshots-main/skills/app-store-screenshots/mockup.png public/mockup.png 2>/dev/null || true
```

For each screenshot in `job.screenshots`, save `imageDataUrl` as `public/screenshots/0N-label.png`.

### Step 3.4 — File structure

```
project/
├── public/
│   ├── mockup.png           (or CSS-only phone fallback)
│   └── screenshots/
│       ├── 01-home.png
│       ├── 02-dashboard.png
│       └── ...
└── src/app/
    ├── layout.tsx
    └── page.tsx             (entire generator in one file)
```

---

## Phase 4: Write page.tsx Using the Generated Recipe

The recipe JSON from the job contains everything needed. Build the generator from it.

### Constants block

```typescript
// ─── Apple export sizes ────────────────────────────────────
const SIZES = [
  { label: '6.9"', w: 1320, h: 2868 },  // iPhone 16 Pro Max
  { label: '6.5"', w: 1284, h: 2778 },  // iPhone 15 Plus
  { label: '6.3"', w: 1206, h: 2622 },  // iPhone 16 Pro
  { label: '6.1"', w: 1125, h: 2436 },  // iPhone 14/15
] as const;
const CANVAS_W = 1320, CANVAS_H = 2868; // design at largest

// ─── Generated recipe (replace with actual values from job.recipe)
const RECIPE = {
  mood: "<mood>",
  palette: { bg: "<bg>", bgEnd: "<bgEnd>", accent: "<accent>", accent2: "<accent2>",
             text: "<text>", muted: "<muted>", card: "<card>", chip: "<chip>",
             glow: "<glow>", shadow: "<shadow>" },
  typography: { font: "<font>", headlineWeight: 800, headlineTracking: "<tracking>",
                headlineSize: 0.092, subtitleSize: 0.037, kickerSize: 0.028,
                kickerTracking: "0.08em", kickerWeight: 600 },
  decorations: [ /* array from recipe */ ],
  layouts: ["hero", "right", "left", "duo", "trust", "center"],
  copy: [ /* array from recipe */ ],
} as const;

// Phone mockup measurements (for mockup.png)
const MK_W = 1022, MK_H = 2082;
const SC_L = (52 / MK_W) * 100, SC_T = (46 / MK_H) * 100;
const SC_W = (918 / MK_W) * 100, SC_H = (1990 / MK_H) * 100;
const SC_RX = (126 / 918) * 100, SC_RY = (126 / 1990) * 100;
```

### Phone component (use PNG mockup when available, CSS fallback otherwise)

```tsx
function Phone({ src, alt, style, className = "" }: {
  src: string; alt: string; style?: React.CSSProperties; className?: string;
}) {
  // PNG-based (preferred):
  return (
    <div className={`relative ${className}`} style={{ aspectRatio: `${MK_W}/${MK_H}`, ...style }}>
      <img src="/mockup.png" alt="" className="block w-full h-full" draggable={false} />
      <div className="absolute z-10 overflow-hidden" style={{
        left: `${SC_L}%`, top: `${SC_T}%`,
        width: `${SC_W}%`, height: `${SC_H}%`,
        borderRadius: `${SC_RX}% / ${SC_RY}%`,
      }}>
        <img src={src} alt={alt} className="block w-full h-full object-cover object-top" draggable={false} />
      </div>
    </div>
  );
}
```

**CSS-only fallback** (when mockup.png unavailable):
```tsx
function Phone({ src, alt, style, className = "" }) {
  return (
    <div className={`relative ${className}`} style={{ aspectRatio: "9/19.5", ...style }}>
      <div style={{
        width: "100%", height: "100%",
        borderRadius: "12% / 5.5%",
        background: "linear-gradient(160deg, #2C2C2E 0%, #1C1C1E 100%)",
        boxShadow: "inset 0 0 0 2px rgba(255,255,255,0.12), 0 24px 80px rgba(0,0,0,0.7)",
        position: "relative", overflow: "hidden",
      }}>
        <div style={{ position:"absolute",top:"1.6%",left:"50%",transform:"translateX(-50%)",
          width:"26%",height:"2.6%",borderRadius:"9999px",background:"#111113",zIndex:20 }} />
        <div style={{ position:"absolute",left:"3.5%",top:"2%",width:"93%",height:"96%",
          borderRadius:"10% / 4.5%",overflow:"hidden",background:"#000" }}>
          <img src={src} alt={alt} style={{ display:"block",width:"100%",height:"100%",
            objectFit:"cover",objectPosition:"top" }} draggable={false} />
        </div>
      </div>
    </div>
  );
}
```

### Decoration component (render SVG elements from recipe)

```tsx
function Decoration({ dec, canvasW, canvasH }: { dec: typeof RECIPE.decorations[0], canvasW: number, canvasH: number }) {
  const sizeMap = { sm: 0.35, md: 0.55, lg: 0.75, xl: 0.95 };
  const svgSize = canvasW * (sizeMap[dec.size] || 0.6);
  // Position based on dec.position (top-right / bottom-left / etc.)
  // Render based on dec.type (blob → <path>, ring → <circle stroke>, dots → circles pattern, etc.)
  // See preview.html decorationSvg() for full reference implementation
}
```

### Typography sizing (resolution-independent)

All sizes relative to `canvasW`:
```typescript
const hs = Math.round(canvasW * RECIPE.typography.headlineSize);  // headline px
const ss = Math.round(canvasW * RECIPE.typography.subtitleSize);   // subtitle px
const ks = Math.round(canvasW * RECIPE.typography.kickerSize);     // kicker px
```

### Slide components — one per layout

Build `Slide1` through `SlideN` using the layout patterns from Phase 4 of the original skill:

| Layout | Phone position | Copy position |
|--------|---------------|---------------|
| `hero` | Centered, bottom 0, translateY(10%) | Top center |
| `right` | Right edge, bottom 0 | Top left |
| `left` | Left edge, bottom 0 | Top right |
| `duo` | Two phones: back left rotated, front right | Top center |
| `trust` | Center mid, floating card bottom | Top center |
| `center` | Top area centered | Bottom center |

### Export implementation

```typescript
import { toPng } from "html-to-image";

async function exportSlide(el: HTMLElement, w: number, h: number, filename: string) {
  el.style.cssText += ";position:fixed;left:0;top:0;z-index:-1;opacity:1;";
  const opts = { width: w, height: h, pixelRatio: 1, cacheBust: true };
  await toPng(el, opts);                   // first call: warm up fonts/images
  const dataUrl = await toPng(el, opts);   // second call: clean output
  el.style.cssText = el.style.cssText.replace(/;position:fixed.*?opacity:1;/, "");
  const a = document.createElement("a");
  a.href = dataUrl; a.download = filename; a.click();
  await new Promise(r => setTimeout(r, 300));
}
```

File naming: `01-hero-1320x2868.png` (zero-padded, sorts cleanly in Finder).

---

## Phase 5: QA Gate

Before handing back:

### Copy
- [ ] One idea per slide — no two things joined by "and"
- [ ] Hero slide communicates main benefit in under 1 second
- [ ] Headlines are 3–5 words per visual line

### Visual
- [ ] No two adjacent slides use the same layout
- [ ] Decorations are visible but not blocking phone content
- [ ] Screenshots aligned inside phone frame (`object-position: top`)
- [ ] Gradient background fills the full canvas

### Export
- [ ] Test one export — correct dimensions, clean output
- [ ] Double-call trick in place
- [ ] Filenames zero-padded

### Handoff
Report:
1. The generated **mood name** and **color harmony** (e.g. "Dusk Neon · triadic · neon-dark")
2. Number of slides created
3. To get different results: run again — a new seed is used every time

---

## Common Issues

| Issue | Fix |
|-------|-----|
| Server not responding on port 4318 | `bash start.sh` in the skill directory |
| Captured screenshot is blank/white | Add `--wait=2000` to give the app more load time |
| App requires login | Ask user to add `?demo=true` or create a public demo route |
| Export PNG is blank | Verify double-call trick; move element to `left:0` before capture |
| Phone screen stretched | Use `object-fit: cover; object-position: top` |
| Copy too long | Apply 3–5 words/line rule, add `<br />` breaks |
| Want a different style | Just run again — a new random seed generates completely new results |
