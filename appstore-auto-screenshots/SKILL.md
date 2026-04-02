---
name: appstore-auto-screenshots
description: Use when you need to auto-generate Apple App Store marketing screenshots from a live HTML app URL. Captures real app screens via Playwright, then builds a Next.js exporter at all Apple-required iPhone resolutions. Triggers on: app store screenshots, appstore upload, screenshot generator, 上架截图, app store marketing.
---

# App Store Screenshot Auto-Generator

## Overview

Takes a URL to a running HTML app, automatically captures real screens via Playwright, analyzes what the app does, and builds a Next.js marketing screenshot generator that exports at all Apple-required iPhone sizes.

**What makes this different from manual screenshot tools:**
- No need to manually take screenshots — the app is screenshotted automatically at the exact iPhone viewport
- Multiple screens captured with one command, including scrolled states and sub-pages
- Claude reads and understands the UI to plan the narrative marketing arc

## Core Principle

**Screenshots are advertisements, not documentation.** The goal is to sell a *feeling*, an *outcome*, or to kill a *pain point* — not to document the UI. Every screenshot slide = one idea, clearly communicated.

---

## Phase 0: Gather Input

Ask ALL of these questions in a **single message** before writing any code. Do not skip or split.

### Required

1. **App URL** — "What is the URL of your app? (e.g. http://localhost:3000 or https://yourapp.com)"
   - If source HTML files only: tell the user to first run `npx serve .` or `python -m http.server 8080` in the app folder
2. **App name** — "What is your app called?"
3. **App description** — "In one sentence, what does your app do and who is it for?"

### Optional (decide from defaults if skipped)

4. **Screens to capture** — "Are there specific pages or states you want in the screenshots? List URLs or click paths (e.g. `/dashboard`, `/settings`). Leave blank for home screen only."
5. **App icon** — "Do you have an app icon PNG? If yes, share the path."
6. **Brand colors** — "What are your brand colors? (accent, background, text) — or skip and I'll detect them from the screenshots."
7. **Number of slides** — "How many marketing screenshots do you want? (1–10, Apple recommends 5–6)"
8. **Style direction** — "What visual style do you want for the marketing frames? Examples: clean/minimal, bold/dark, warm/organic, tech/gradient. Or share App Store screenshot references."

### Auto-decided (do NOT ask — decide from screenshots)

- Background style, gradients, decorative elements
- Typography weight and spacing matching brand personality
- Which screens become which slide slots
- Copy direction (pain point / outcome / moment)

---

## Phase 1: Capture Real App Screenshots

### Step 1.1 — Check the App is Reachable

```bash
curl -s -o /dev/null -w "%{http_code}" <URL>
```

If not reachable, guide the user:
- **Local HTML file**: `cd <folder> && npx serve . -p 3000`
- **React/Vite dev server**: `npm run dev` or `yarn dev`
- **Already deployed**: proceed

### Step 1.2 — Install Playwright

```bash
# Check if installed
node -e "require('playwright')" 2>/dev/null && echo "ok" || echo "not installed"

# Install if needed (try bun first, then npm)
bun add -D playwright || npm install -D playwright
npx playwright install chromium
```

### Step 1.3 — Run the Capture Script

The `scripts/capture-app.js` script captures screenshots at iPhone 15 Pro viewport (390×844, deviceScaleFactor 3 = 1170×2532px native).

```bash
node scripts/capture-app.js <URL> ./captured-screenshots [--routes=/page1,/page2] [--scroll]
```

Flags:
- `--routes=/path1,/path2` — capture additional sub-pages
- `--scroll` — also capture scrolled-down state for each page
- `--click=".button-selector"` — click an element then capture (for modals, menus, tabs)

After running, confirm all screenshots look correct by reading them:
```bash
ls ./captured-screenshots/
```

Use the Read tool to **view each captured screenshot** (Claude is multimodal). Note what you see in each one.

### Step 1.4 — Manual Supplement (if needed)

If some screens can't be auto-captured (e.g. require login, gesture-heavy flows), tell the user:
> "The following screens need manual capture — please take screenshots on your device and drop them in `./captured-screenshots/` as PNG files:
> - [list any screens that need it]"

---

## Phase 2: Analyze the App & Plan the Narrative

After viewing all captured screenshots, complete this analysis internally (do not ask the user):

### App Analysis Checklist

1. **What is the core value?** — The single most important thing this app does
2. **Key screens identified** — List each captured screen and what it shows
3. **Primary user flow** — What does a first-time user do?
4. **Differentiator** — What makes this app better than alternatives?
5. **Trust signals** — Any social proof, review ratings, user stats visible in the UI?
6. **Brand palette detected** — Extract dominant colors from screenshots if user didn't provide them

### Slide Assignment Framework

Map captured screens to slide slots. Not all slots required — pick what fits the slide count:

| Slot | Purpose | Which captured screen to use |
|------|---------|------------------------------|
| #1 | **Hero / Main Benefit** | Best-looking home screen — this is the ONLY one most users see in listings |
| #2 | **Core Differentiator** | The screen that shows what makes this app unique |
| #3 | **Key Feature #1** | Most important user task screen |
| #4 | **Key Feature #2** | Second most important feature |
| #5 | **Key Feature #3** | Third feature (or ecosystem: widgets, watch, etc.) |
| 2nd-to-last | **Trust / Identity** | "Built for people who [X]" — use a calm, detailed screen |
| Last | **More Features** | Pill-badge layout of extras — no screenshot needed, text-only slide |

**Rule:** Each slide sells ONE idea. If a screen shows two features, crop or use only part of it.

---

## Phase 3: Write Copy First

Get headlines right before building layouts. Bad copy ruins good design.

### Iron Rules

1. **One idea per headline** — never two things joined by "and"
2. **Short words** — 1–2 syllables, no jargon
3. **3–5 words per visual line** — must read in one second at thumbnail size
4. **Line breaks are intentional** — use `<br />` to control them

### Three Proven Headline Approaches

| Type | What it does | Example |
|------|-------------|---------|
| **Paint a moment** | User pictures themselves doing it | "Check your balance without opening the app." |
| **State an outcome** | What life looks like after | "A clear view of every expense." |
| **Kill a pain** | Name the problem and destroy it | "Never guess where your money went." |

### What Never Works

- Feature list as headline: "Track tasks with tags, filters, and notes"
- Two ideas joined by "and": "Save X and never miss Y"
- Vague aspirational: "Everything, organized"
- Marketing buzzwords: "AI-powered insights" (unless actually AI)

### Copy Output Format

For each planned slide, write 2 options:
- Option A: pain-killer or moment framing
- Option B: outcome framing

Present to user, then proceed with whichever they pick (or your best judgment if they don't respond).

---

## Phase 4: Set Up the Project & Build the Generator

### Step 4.1 — Detect Package Manager

```bash
which bun && echo "bun" || which pnpm && echo "pnpm" || which yarn && echo "yarn" || echo "npm"
```

### Step 4.2 — Scaffold Next.js Project

```bash
# bun
bunx create-next-app@latest . --typescript --tailwind --app --src-dir --no-eslint --import-alias "@/*"
bun add html-to-image

# pnpm
pnpx create-next-app@latest . --typescript --tailwind --app --src-dir --no-eslint --import-alias "@/*"
pnpm add html-to-image

# npm
npx create-next-app@latest . --typescript --tailwind --app --src-dir --no-eslint --import-alias "@/*"
npm install html-to-image
```

### Step 4.3 — Copy Assets

```bash
# Copy captured screenshots to public/screenshots/
cp -r ./captured-screenshots/*.png ./public/screenshots/

# Copy app icon if provided
cp <icon-path> ./public/app-icon.png

# Copy iPhone mockup from the app-store-screenshots skill
cp ../app-store-screenshots-main/skills/app-store-screenshots/mockup.png ./public/mockup.png
```

**If `mockup.png` is not available at that path**, generate a CSS-only phone mockup (see Phone Mockup Component below — CSS fallback version).

### Step 4.4 — File Structure

```
project/
├── public/
│   ├── mockup.png              # iPhone frame
│   ├── app-icon.png            # App icon (if provided)
│   └── screenshots/            # Captured app screenshots
│       ├── 01-home.png
│       ├── 02-dashboard.png
│       └── ...
├── src/app/
│   ├── layout.tsx              # Font setup
│   └── page.tsx                # Screenshot generator (single file)
└── package.json
```

### Step 4.5 — Build `page.tsx`

The entire generator lives in one file. Architecture:

```
page.tsx
├── Constants (IPHONE_W=1320, IPHONE_H=2868, design tokens)
├── SIZES array (all 4 Apple iPhone export sizes)
├── Phone component (mockup frame + screenshot overlay)
├── Caption component (category label + headline)
├── Decorative components (blobs/glows matching style direction)
├── Slide1..N components (one per planned slide)
├── SLIDES registry array
├── ScreenshotPreview (ResizeObserver scaling + hover-to-export)
└── ScreenshotsPage (grid layout + size selector + export all button)
```

#### Export Sizes — Apple Required

```typescript
const SIZES = [
  { label: '6.9"', w: 1320, h: 2868 },   // iPhone 16 Pro Max
  { label: '6.5"', w: 1284, h: 2778 },   // iPhone 15 Plus
  { label: '6.3"', w: 1206, h: 2622 },   // iPhone 16 Pro
  { label: '6.1"', w: 1125, h: 2436 },   // iPhone 14 / 15
] as const;
```

**Design at 1320×2868 (largest). Export scales down to other sizes.**

#### Phone Mockup Component (PNG-based)

```typescript
// Pre-measured values for the included mockup.png
const MK_W = 1022;
const MK_H = 2082;
const SC_L = (52 / MK_W) * 100;
const SC_T = (46 / MK_H) * 100;
const SC_W = (918 / MK_W) * 100;
const SC_H = (1990 / MK_H) * 100;
const SC_RX = (126 / 918) * 100;
const SC_RY = (126 / 1990) * 100;

function Phone({ src, alt, style, className = "" }: {
  src: string; alt: string; style?: React.CSSProperties; className?: string;
}) {
  return (
    <div className={`relative ${className}`}
      style={{ aspectRatio: `${MK_W}/${MK_H}`, ...style }}>
      <img src="/mockup.png" alt="" className="block w-full h-full" draggable={false} />
      <div className="absolute z-10 overflow-hidden"
        style={{
          left: `${SC_L}%`, top: `${SC_T}%`,
          width: `${SC_W}%`, height: `${SC_H}%`,
          borderRadius: `${SC_RX}% / ${SC_RY}%`,
        }}>
        <img src={src} alt={alt}
          className="block w-full h-full object-cover object-top"
          draggable={false} />
      </div>
    </div>
  );
}
```

**CSS-only phone fallback** (if mockup.png is unavailable):

```tsx
function Phone({ src, alt, style, className = "" }: {
  src: string; alt: string; style?: React.CSSProperties; className?: string;
}) {
  return (
    <div className={`relative ${className}`}
      style={{ aspectRatio: "9/19.5", ...style }}>
      <div style={{
        width: "100%", height: "100%",
        borderRadius: "12% / 5.5%",
        background: "linear-gradient(160deg, #2C2C2E 0%, #1C1C1E 100%)",
        boxShadow: "inset 0 0 0 2px rgba(255,255,255,0.12), 0 24px 80px rgba(0,0,0,0.7)",
        position: "relative", overflow: "hidden",
      }}>
        {/* Dynamic Island */}
        <div style={{
          position: "absolute", top: "1.6%", left: "50%",
          transform: "translateX(-50%)", width: "26%", height: "2.6%",
          borderRadius: "9999px", background: "#111113", zIndex: 20,
        }} />
        {/* Screen */}
        <div style={{
          position: "absolute", left: "3.5%", top: "2%",
          width: "93%", height: "96%",
          borderRadius: "10% / 4.5%", overflow: "hidden", background: "#000",
        }}>
          <img src={src} alt={alt}
            style={{ display: "block", width: "100%", height: "100%",
              objectFit: "cover", objectPosition: "top" }}
            draggable={false} />
        </div>
      </div>
    </div>
  );
}
```

#### Typography — Resolution-Independent

All sizes relative to canvas width W (1320px at design resolution):

| Element | Formula | Weight |
|---------|---------|--------|
| Category label | `W * 0.028` | 600 |
| Headline | `W * 0.09` – `W * 0.1` | 700 |
| Hero headline | `W * 0.1` | 800 |
| Body / subtext | `W * 0.038` | 400 |

#### Phone Placement Patterns

Vary across slides — never repeat the same layout in adjacent slides:

**Centered (hero, single feature):**
```
bottom: 0, width: "82%", left: "50%", transform: "translateX(-50%) translateY(12%)"
```

**Right-weighted (copy left, phone right):**
```
right: "-4%", bottom: 0, width: "80%"
```

**Two phones (comparison or multi-feature):**
```
Back:  left: "-6%", bottom: 0, width: "60%", rotate(-3deg), opacity: 0.5
Front: right: "-3%", bottom: 0, width: "78%"
```

**Phone + floating UI cards** (only if clear elements visible in screenshots):
```
Cards positioned at edges, slight rotation (2–4deg), drop shadows.
Never block the phone's main content area.
```

#### Slide Canvas Background Patterns

Choose based on user's style direction:

```tsx
// Clean / minimal
background: "linear-gradient(160deg, #F8F6F2 0%, #EDE8E0 100%)"

// Dark / bold
background: "linear-gradient(160deg, #0B1020 0%, #151B34 100%)"

// Warm / organic
background: "linear-gradient(160deg, #F5EDE0 0%, #EDD5BC 100%)"

// Tech / gradient
background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)"

// Contrast slide (use 1–2 in a set for visual rhythm)
background: theme.accent  // solid accent color
```

#### Export Implementation

```typescript
import { toPng } from "html-to-image";

async function exportSlide(el: HTMLElement, w: number, h: number, filename: string) {
  // Move on-screen for capture
  el.style.left = "0px";
  el.style.opacity = "1";
  el.style.zIndex = "-1";

  const opts = { width: w, height: h, pixelRatio: 1, cacheBust: true };

  // CRITICAL: Double-call — first warms fonts/images, second produces clean output
  await toPng(el, opts);
  const dataUrl = await toPng(el, opts);

  // Move back off-screen
  el.style.left = "-9999px";
  el.style.opacity = "";
  el.style.zIndex = "";

  // Download
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  a.click();
}
```

**File naming** (zero-padded, sorts cleanly in Finder/App Store Connect):
```
01-hero-1320x2868.png
02-feature-1284x2778.png
```

#### Full Page UI Layout

```tsx
// Toolbar: size selector + "Export All" button
// Grid: 2–3 columns of preview cards
// Each card: scaled preview + hover overlay "Export this size"
// Below grid: instruction text "Resize in the dropdown, then Export All"
```

The toolbar should be simple: one size `<select>` dropdown and one "Export All" button. No complexity.

---

## Phase 5: Export at All Apple Sizes

### Export All Workflow

1. User selects export size from dropdown (defaults to 6.9" / 1320×2868)
2. Clicks "Export All" — downloads all slides at the selected size, one by one with a 300ms delay
3. To get all 4 sizes: repeat for each size in the dropdown

Optionally add a "Bulk Export" button that loops through all 4 sizes automatically:

```typescript
async function exportAllSizes() {
  for (const size of SIZES) {
    for (let i = 0; i < SLIDES.length; i++) {
      const el = document.getElementById(`export-slide-${i}`);
      if (!el) continue;
      const filename = `${String(i + 1).padStart(2, "0")}-${SLIDES[i].id}-${size.w}x${size.h}.png`;
      await exportSlide(el, size.w, size.h, filename);
      await new Promise(r => setTimeout(r, 300));
    }
  }
}
```

### File Naming Convention

```
01-hero-1320x2868.png          ← first slide, largest size
01-hero-1284x2778.png
01-hero-1206x2622.png
01-hero-1125x2436.png
02-feature-1320x2868.png       ← second slide, all sizes
...
```

---

## Phase 6: QA Gate

Before handing back to the user, review every slide:

### Message Quality
- [ ] One idea per slide — no two things joined by "and"
- [ ] Hero slide communicates the main benefit in under 1 second
- [ ] Headlines are 3–5 words per visual line
- [ ] Copy is specific (not "Everything, organized")

### Visual Quality
- [ ] No two adjacent slides use the same phone placement pattern
- [ ] At least one contrast/dark slide in the set for visual rhythm
- [ ] App screenshots are correctly aligned inside the phone frame (object-position: top)
- [ ] Captured screenshots look real and clear — not blurry or clipped
- [ ] Text is never covered by the phone or decorative elements

### Export Quality
- [ ] Test one export — is the image clean with correct dimensions?
- [ ] Double-call trick is in place (fonts/images render correctly)
- [ ] Filenames have zero-padded prefix and sort correctly

### Handoff
When presenting results:
1. Briefly describe the narrative arc across slides
2. Note any slides using contrast treatment
3. Call out any screens that couldn't be auto-captured and were skipped

---

## Common Mistakes & Fixes

| Mistake | Fix |
|---------|-----|
| Captured screenshot is blank/white | Wait for `networkidle` + add 1s delay after navigation |
| App requires login, can't capture | Ask user to add `?demo=true` or create a guest route |
| Phone screen looks stretched | Use `object-fit: cover; object-position: top` |
| All slides look the same | Vary phone placement: center → right → two-phone → no-phone |
| Copy is too long | Apply "3–5 words per line" rule, add `<br />` breaks |
| Export is blank | Use double-call trick; move element to `left: 0` before capture |
| Screenshots too small/low-res | Playwright captured at deviceScaleFactor 3 — copy from raw output, not thumbnails |
| Decorative blobs invisible | Increase size and opacity — too visible > invisible |
| Text overlaps phone | Move caption above phone or add a dark gradient overlay strip |
| Background too flat | Add radial gradients or soft blob shapes for depth |
