# poster-motion — Phase 1 实施规格

> 这是一份可独立执行的实施规格。新 Claude Code session 读完此文档即可直接开始编码，无需任何额外上下文。

---

## 产品定位

**输入**：用户上传一张图片 + 输入标题  
**输出**：App Store 尺寸海报 PNG（1242×2688）  
**核心洞察**：静态海报是动效系统的一帧。用 Remotion 构建，`renderStill(frame=60)` 导出静帧，未来同一套组件直接接 `renderMedia()` 出视频。

---

## 关键技术决策（不要变更）

1. **不用 html2canvas**：无法渲染 WebGL/复杂 CSS 效果，未来接 reactbits.dev 时会失效
2. **用 Remotion `renderStill()`**：Remotion 自带 headless Chromium，渲染结果与浏览器所见一致
3. **前端用 HTML + Vanilla JS**：无需 Vite 打包，轻量，预览展示服务端渲染的 PNG
4. **图片传递方式**：前端发 base64 → 服务端存临时文件 → 通过 HTTP URL 传给 Remotion composition
5. **维度注册表是核心扩展点**：Phase 2 只需往 `DIMENSIONS` 对象里加新 key，不改核心逻辑

---

## 最终项目结构

```
poster-motion/
├── src/
│   ├── index.tsx                          # Remotion 入口（registerRoot）
│   ├── Root.tsx                           # Composition 注册
│   ├── types/
│   │   └── BannerConfig.ts               ✅ 已创建
│   ├── styles/
│   │   └── ColorSystem.ts                # HSL 色彩生成
│   ├── dimensions/
│   │   ├── index.ts                      # 维度注册表（核心扩展点）
│   │   ├── background/
│   │   │   ├── GradientBg.tsx
│   │   │   └── BlocksBg.tsx
│   │   ├── textEffect/
│   │   │   ├── StaticText.tsx
│   │   │   └── FadeText.tsx
│   │   ├── decoration/
│   │   │   ├── CircleDots.tsx
│   │   │   └── LineStrokes.tsx
│   │   └── entrance/
│   │       ├── FadeSlideUp.tsx
│   │       └── ScaleIn.tsx
│   └── compositions/
│       └── BannerComposition.tsx
├── server/
│   ├── colorGen.js                       # 配置生成（改编自 Auto-banner-OneClick）
│   ├── render.js                         # renderStill() 封装
│   └── server.js                         # Express HTTP 服务器
├── public/
│   └── index.html                        # 前端 UI
├── package.json                          ✅ 已创建
├── tsconfig.json                         ✅ 已创建
└── .gitignore                            ✅ 已创建
```

---

## 已创建文件

- `package.json`
- `tsconfig.json`
- `.gitignore`
- `src/types/BannerConfig.ts` — 完整类型定义，包含 `BannerConfig`、`Palette`、`BannerDimensions`、`DimensionProps`、`EntranceDimensionProps`

---

## package.json 依赖（已定义，直接 npm install）

```json
{
  "dependencies": {
    "@remotion/bundler": "^4.0.443",
    "@remotion/cli": "^4.0.443",
    "@remotion/renderer": "^4.0.443",
    "@remotion/studio": "^4.0.443",
    "cors": "^2.8.6",
    "express": "^5.2.1",
    "react": "^19.2.4",
    "react-dom": "^19.2.4",
    "remotion": "^4.0.443",
    "uuid": "^13.0.0"
  }
}
```

---

## src/types/BannerConfig.ts（已创建，仅供参考）

```typescript
export interface Palette {
  bg: string; bgEnd: string; accent: string; accent2: string;
  text: string; muted: string; card: string; shadow: string;
}
export interface BannerDimensions {
  background: string; textEffect: string; decoration: string;
  entrance: string; layout: string;
}
export interface BannerConfig {
  imageUrl: string;   // HTTP URL，Express 本地服务的临时文件
  title: string;
  dimensions: BannerDimensions;
  palette: Palette;
  width: number;      // 1242
  height: number;     // 2688
  seed: string;
}
export interface DimensionProps {
  frame: number; fps: number; palette: Palette; config: BannerConfig;
}
export interface EntranceDimensionProps extends DimensionProps {
  children: React.ReactNode;
}
```

---

## src/styles/ColorSystem.ts

改编自 `/Users/chenjiaqi/developer/Automatic-picture/Auto-banner-OneClick/scripts/screenshot-server.js` 第 198-596 行。

需要提取并转写为 TypeScript 的函数：
- `hslToHex(h, s, l)` → 第 198 行
- `hexToRgb(hex)` → 第 210 行
- `isDark(hex)` → 第 224 行
- `createRng(seed)` → 第 240 行（Mulberry32 PRNG）
- `generateStyleRecipe(seed)` → 第 360 行（色彩和谐算法）

**简化版 ColorSystem.ts 需要实现**：

```typescript
export function hslToHex(h: number, s: number, l: number): string { ... }
export function hexToRgb(hex: string): { r: number; g: number; b: number } { ... }
export function isDark(hex: string): boolean { ... }
export function createRng(seed: number): () => number { ... }  // Mulberry32

// 将字符串 seed 转为数字（用于 Mulberry32）
function hashSeed(seed: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h || 1;
}

// 主函数：从 seed 生成完整 BannerConfig（除 imageUrl/title 外）
export function generatePalette(seed: string): Palette { ... }
```

`generatePalette` 内部逻辑直接移植自 `generateStyleRecipe` 的色彩部分（第 360-510 行），去掉 typography / decorations / layouts / copies 部分，只保留 palette 生成。

---

## server/colorGen.js

```javascript
// CommonJS（不是 TypeScript）
// 直接从 Auto-banner-OneClick 的 screenshot-server.js 提取相同函数（JS 版本）
// 需要的函数：hslToHex, hexToRgb, isDark, createRng, 色彩和谐逻辑

const DIMENSION_OPTIONS = {
  background: ['gradient', 'blocks'],
  textEffect: ['static', 'fade'],
  decoration: ['circles', 'lines'],
  entrance: ['fadeSlideUp', 'scaleIn'],
  layout: ['titleTop', 'titleBottom'],
};

function hashSeed(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h || 1;
}

/**
 * @param {object} opts
 * @param {string} opts.seed
 * @param {string} opts.imageUrl    - 本地 HTTP URL，e.g. http://127.0.0.1:4330/assets/xxx.png
 * @param {string} opts.title
 * @returns {BannerConfig}
 */
function generateBannerConfig({ seed, imageUrl, title = '全新体验' }) {
  const rng = createRng(hashSeed(seed));
  const pick = (arr) => arr[Math.floor(rng() * arr.length)];

  // 色彩生成（从 screenshot-server.js generateStyleRecipe 移植）
  const palette = generatePalette(rng);

  return {
    imageUrl,
    title,
    dimensions: {
      background: pick(DIMENSION_OPTIONS.background),
      textEffect: pick(DIMENSION_OPTIONS.textEffect),
      decoration: pick(DIMENSION_OPTIONS.decoration),
      entrance: pick(DIMENSION_OPTIONS.entrance),
      layout: pick(DIMENSION_OPTIONS.layout),
    },
    palette,
    width: 1242,
    height: 2688,
    seed,
  };
}

module.exports = { generateBannerConfig };
```

---

## server/render.js

改编自 `/Users/chenjiaqi/developer/Automatic-picture/video-auto-animations/server/render.js`，将 `renderMedia` 替换为 `renderStill`：

```javascript
const { bundle } = require('@remotion/bundler');
const { renderStill, selectComposition } = require('@remotion/renderer');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
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
  }
  return cachedBundle;
}

/**
 * Render a single still frame (frame 60 = 2s in, animations settled).
 * @param {object} config  BannerConfig
 * @param {string} outputPath  absolute path for output PNG
 */
async function renderBannerStill(config, outputPath) {
  const serveUrl = await getBundle();

  const composition = await selectComposition({
    serveUrl,
    id: 'BannerComposition',
    inputProps: { config },
  });

  await renderStill({
    composition,
    serveUrl,
    output: outputPath,
    inputProps: { config },
    frame: 60,          // 2s in → all entrance animations fully settled
    imageFormat: 'png',
    overwrite: true,
  });
}

function clearBundleCache() { cachedBundle = null; }

module.exports = { renderBannerStill, clearBundleCache };
```

---

## server/server.js

```javascript
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { generateBannerConfig } = require('./colorGen');
const { renderBannerStill } = require('./render');

const PORT = parseInt(process.env.PORT || '4330', 10);

// Temp dirs
const ASSETS_DIR = path.join(__dirname, '..', 'temp-assets');
const RENDERS_DIR = path.join(__dirname, '..', 'renders');
fs.mkdirSync(ASSETS_DIR, { recursive: true });
fs.mkdirSync(RENDERS_DIR, { recursive: true });

const app = express();
app.use(cors());
app.use(express.json({ limit: '20mb' }));  // large base64 images

// Serve static files
app.use(express.static(path.join(__dirname, '..', 'public')));
app.use('/assets', express.static(ASSETS_DIR));   // uploaded images
app.use('/renders', express.static(RENDERS_DIR)); // rendered PNGs

// ── POST /api/render ──────────────────────────────────────────────────────────
// Body: { imageBase64: string, title: string, seed?: string }
// Response: { previewUrl: string, config: BannerConfig }
app.post('/api/render', async (req, res) => {
  try {
    const { imageBase64, title = '全新体验', seed } = req.body;

    if (!imageBase64) return res.status(400).json({ error: 'imageBase64 is required' });

    const sessionId = uuidv4();
    const activeSeed = seed || sessionId;

    // 1. Save uploaded image to disk
    const imageBuffer = Buffer.from(
      imageBase64.replace(/^data:image\/\w+;base64,/, ''),
      'base64'
    );
    const imageFilename = `${sessionId}.png`;
    const imagePath = path.join(ASSETS_DIR, imageFilename);
    fs.writeFileSync(imagePath, imageBuffer);

    // 2. Generate BannerConfig (image URL accessible to Remotion headless Chrome)
    const imageUrl = `http://127.0.0.1:${PORT}/assets/${imageFilename}`;
    const config = generateBannerConfig({ seed: activeSeed, imageUrl, title });

    // 3. Render still frame
    const renderFilename = `${sessionId}.png`;
    const renderPath = path.join(RENDERS_DIR, renderFilename);
    console.log(`[server] Rendering ${sessionId}...`);
    await renderBannerStill(config, renderPath);
    console.log(`[server] Done: ${renderFilename}`);

    res.json({
      previewUrl: `/renders/${renderFilename}`,
      config,
    });
  } catch (err) {
    console.error('[server] Render error:', err);
    res.status(500).json({ error: String(err.message || err) });
  }
});

// Health check
app.get('/health', (req, res) => res.json({ ok: true }));

const server = app.listen(PORT, () => {
  console.log(`✦ poster-motion server running at http://127.0.0.1:${PORT}`);
  console.log(`  Studio: npx remotion studio src/index.tsx`);
});

// Graceful shutdown
process.on('SIGINT', () => { server.close(); process.exit(0); });
process.on('SIGTERM', () => { server.close(); process.exit(0); });
```

---

## src/index.tsx（Remotion 入口）

```typescript
import { registerRoot } from 'remotion';
import { RemotionRoot } from './Root';
registerRoot(RemotionRoot);
```

---

## src/Root.tsx

```typescript
import React from 'react';
import { Composition } from 'remotion';
import { BannerComposition } from './compositions/BannerComposition';
import { BannerConfig } from './types/BannerConfig';

// Default config for Remotion Studio preview
const defaultConfig: BannerConfig = {
  imageUrl: 'https://via.placeholder.com/390x844',
  title: '全新体验',
  dimensions: {
    background: 'gradient',
    textEffect: 'fade',
    decoration: 'circles',
    entrance: 'fadeSlideUp',
    layout: 'titleTop',
  },
  palette: {
    bg: '#1a1a2e', bgEnd: '#16213e',
    accent: '#e94560', accent2: '#0f3460',
    text: '#ffffff', muted: 'rgba(255,255,255,0.65)',
    card: 'rgba(255,255,255,0.08)', shadow: 'rgba(0,0,0,0.5)',
  },
  width: 1242,
  height: 2688,
  seed: 'default',
};

export const RemotionRoot: React.FC = () => (
  <Composition
    id="BannerComposition"
    component={BannerComposition}
    durationInFrames={90}   // 3 seconds @ 30fps
    fps={30}
    width={1242}
    height={2688}
    defaultProps={{ config: defaultConfig }}
  />
);
```

---

## src/compositions/BannerComposition.tsx

```typescript
import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import { BannerConfig, DimensionProps } from '../types/BannerConfig';
import { DIMENSIONS } from '../dimensions';
import { ImageLayer } from './ImageLayer';

export const BannerComposition: React.FC<{ config: BannerConfig }> = ({ config }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const BackgroundComp = DIMENSIONS.background[config.dimensions.background];
  const DecorationComp = DIMENSIONS.decoration[config.dimensions.decoration];
  const TextComp       = DIMENSIONS.textEffect[config.dimensions.textEffect];
  const EntranceComp   = DIMENSIONS.entrance[config.dimensions.entrance];

  const props: DimensionProps = { frame, fps, palette: config.palette, config };

  return (
    <AbsoluteFill>
      <BackgroundComp {...props} />
      <DecorationComp {...props} />
      <EntranceComp {...props}>
        <ImageLayer config={config} />
      </EntranceComp>
      <TextComp {...props} />
    </AbsoluteFill>
  );
};
```

### ImageLayer（非维度组件，内联在 compositions/ 下）

```typescript
// src/compositions/ImageLayer.tsx
import React from 'react';
import { BannerConfig } from '../types/BannerConfig';

export const ImageLayer: React.FC<{ config: BannerConfig }> = ({ config }) => {
  const { imageUrl, palette, dimensions, width, height } = config;
  const isTop = dimensions.layout === 'titleTop';

  // Title takes 26% of height; image occupies the remaining space
  const imageAreaStyle: React.CSSProperties = isTop
    ? { position: 'absolute', top: height * 0.26, bottom: 0, left: 60, right: 60 }
    : { position: 'absolute', top: 0, bottom: height * 0.26, left: 60, right: 60 };

  return (
    <div style={imageAreaStyle as React.CSSProperties}>
      <div style={{
        width: '100%', height: '100%',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <img
          src={imageUrl}
          style={{
            maxWidth: '88%',
            maxHeight: '90%',
            objectFit: 'contain',
            borderRadius: 32,
            boxShadow: `0 40px 120px ${palette.shadow}, 0 0 0 1px ${palette.card}`,
          }}
        />
      </div>
    </div>
  );
};
```

---

## src/dimensions/index.ts（维度注册表 — 核心扩展点）

```typescript
import React from 'react';
import { DimensionProps, EntranceDimensionProps } from '../types/BannerConfig';

// Background
import { GradientBg }  from './background/GradientBg';
import { BlocksBg }    from './background/BlocksBg';

// Text effects
import { StaticText }  from './textEffect/StaticText';
import { FadeText }    from './textEffect/FadeText';

// Decorations
import { CircleDots }  from './decoration/CircleDots';
import { LineStrokes } from './decoration/LineStrokes';

// Entrance (wrapper components with children)
import { FadeSlideUp } from './entrance/FadeSlideUp';
import { ScaleIn }     from './entrance/ScaleIn';

// ── Registry ──────────────────────────────────────────────────────────────────
// To add a new option: import the component, add a key here.
// Nothing else needs to change.

export const DIMENSIONS = {
  background: {
    gradient: GradientBg,
    blocks:   BlocksBg,
    // Phase 2: aurora: Aurora, particles: Particles
  } as Record<string, React.FC<DimensionProps>>,

  textEffect: {
    static:   StaticText,
    fade:     FadeText,
    // Phase 2: blur: BlurText, circular: CircularText
  } as Record<string, React.FC<DimensionProps>>,

  decoration: {
    circles:  CircleDots,
    lines:    LineStrokes,
    // Phase 2: beams: Beams, spotlight: Spotlight
  } as Record<string, React.FC<DimensionProps>>,

  entrance: {
    fadeSlideUp: FadeSlideUp,
    scaleIn:     ScaleIn,
    // Phase 2: glitch: GlitchFlash, blurDissolve: BlurDissolve
  } as Record<string, React.FC<EntranceDimensionProps>>,
};
```

---

## 维度组件实现规格

### Background 维度（AbsoluteFill，fullscreen，无入参动效）

**GradientBg.tsx**
```typescript
import React from 'react';
import { AbsoluteFill } from 'remotion';
import { DimensionProps } from '../../types/BannerConfig';

export const GradientBg: React.FC<DimensionProps> = ({ palette }) => (
  <AbsoluteFill style={{
    background: `linear-gradient(145deg, ${palette.bg} 0%, ${palette.bgEnd} 100%)`,
  }} />
);
```

**BlocksBg.tsx**
```typescript
// 纯色背景 + 2 个半透明圆角矩形装饰
export const BlocksBg: React.FC<DimensionProps> = ({ palette }) => (
  <AbsoluteFill style={{ backgroundColor: palette.bg }}>
    <div style={{
      position: 'absolute', width: 900, height: 900, borderRadius: 120,
      background: palette.accent, opacity: 0.12,
      top: -200, right: -200,
    }} />
    <div style={{
      position: 'absolute', width: 600, height: 600, borderRadius: 80,
      background: palette.accent2, opacity: 0.10,
      bottom: -100, left: -150,
    }} />
  </AbsoluteFill>
);
```

### TextEffect 维度（AbsoluteFill，读 config.dimensions.layout 决定位置）

**StaticText.tsx**
```typescript
import React from 'react';
import { AbsoluteFill } from 'remotion';
import { DimensionProps } from '../../types/BannerConfig';

export const StaticText: React.FC<DimensionProps> = ({ palette, config }) => {
  const isTop = config.dimensions.layout === 'titleTop';
  const posStyle: React.CSSProperties = isTop
    ? { top: 0, height: config.height * 0.22 }
    : { bottom: 0, height: config.height * 0.22 };

  return (
    <AbsoluteFill>
      <div style={{
        position: 'absolute', left: 80, right: 80, ...posStyle,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <h1 style={{
          margin: 0, textAlign: 'center',
          fontSize: 88, fontWeight: 800, lineHeight: 1.15,
          letterSpacing: '-0.02em',
          color: palette.text,
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}>
          {config.title}
        </h1>
      </div>
    </AbsoluteFill>
  );
};
```

**FadeText.tsx**  
同 StaticText，但加上 `interpolate` 淡入动效：
```typescript
import { interpolate } from 'remotion';
// opacity: interpolate(frame, [15, 50], [0, 1], { extrapolateRight: 'clamp' })
// translateY: interpolate(frame, [15, 50], [30, 0], { extrapolateRight: 'clamp' })
// 注意：extrapolateLeft 也需要 'clamp'
```

### Decoration 维度（AbsoluteFill，SVG 装饰元素，使用 config.seed 生成稳定的随机位置）

**CircleDots.tsx** — 用 `config.seed` 生成 12 个圆点，位置固定（不随 frame 变化）
```typescript
// 从 seed 生成 dots 数组：{ x: %, y: %, size: px, opacity: float }
// 避免与图片主体区域重叠（layout=titleTop 时图片在下半区，dots 应分散全图）
// 圆点颜色使用 palette.accent，opacity 范围 0.15-0.45
```

**LineStrokes.tsx** — 4 条细线，角度随机，颜色 palette.accent2 opacity 0.2
```typescript
// SVG 元素，position absolute，pointer-events none
// lines 数组从 seed 生成（长度 100-250px，随机角度和位置）
```

### Entrance 维度（wrapper，children prop，用 interpolate 控制动效）

**FadeSlideUp.tsx**
```typescript
import React from 'react';
import { interpolate } from 'remotion';
import { EntranceDimensionProps } from '../../types/BannerConfig';

export const FadeSlideUp: React.FC<EntranceDimensionProps> = ({ frame, children }) => {
  const opacity = interpolate(frame, [0, 42], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });
  const translateY = interpolate(frame, [0, 42], [80, 0], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });
  return (
    <div style={{ width: '100%', height: '100%', opacity, transform: `translateY(${translateY}px)` }}>
      {children}
    </div>
  );
};
```

**ScaleIn.tsx**
```typescript
// scale: interpolate(frame, [0, 36], [0.88, 1.0], ...)
// opacity: interpolate(frame, [0, 28], [0, 1], ...)
```

---

## public/index.html

简洁的单页面 UI，HTML + Vanilla JS，无框架依赖：

```
布局：
  左栏（操作区，400px）：
    - 文件上传区（drag & drop 或 click）
    - 标题输入框（placeholder: "全新体验"，maxlength: 20）
    - "一键生成" 按钮
    - 当有结果时：显示 seed 信息 + "重新生成"按钮 + "下载 PNG"按钮

  右栏（预览区）：
    - 初始：虚线占位框
    - 生成中：loading 状态（spinner + "渲染中..."）
    - 完成：<img src="/renders/xxx.png"> 按比例缩放展示（max-height: 80vh）
    - 显示当前维度选择（背景/文字/装饰/动效/布局各是哪个选项）

JS 逻辑：
  1. 读取图片为 base64 dataURL
  2. POST /api/render { imageBase64, title, seed? }
  3. 展示返回的 previewUrl
  4. 重新生成：同样的 imageBase64 + title，不传 seed（服务端生成新随机 seed）
  5. 下载：<a href=previewUrl download="poster.png"> 触发
```

---

## 实施顺序

1. `cd poster-motion && npm install`（等待依赖安装，需要较长时间）
2. 创建 `src/styles/ColorSystem.ts`（直接从 Auto-banner-OneClick 的 JS 代码移植）
3. 创建所有维度组件（8 个）
4. 创建 `src/dimensions/index.ts`
5. 创建 `src/compositions/BannerComposition.tsx` + `ImageLayer.tsx`
6. 创建 `src/Root.tsx` + `src/index.tsx`
7. 创建 `server/colorGen.js`
8. 创建 `server/render.js`
9. 创建 `server/server.js`
10. 创建 `public/index.html`
11. 运行 `node server/server.js` 测试

---

## 源码参考位置（复用时直接读这些文件）

| 需要 | 从哪里读 | 行号 |
|---|---|---|
| Mulberry32 RNG | Auto-banner-OneClick/scripts/screenshot-server.js | 240-249 |
| hslToHex / hexToRgb / isDark | 同上 | 198-224 |
| 色彩和谐算法（colorMode + harmony） | 同上 | 360-510 |
| bundle 缓存 + webpack override | video-auto-animations/server/render.js | 全文 |
| Express server 模式 | video-auto-animations/server/server.js | 全文 |

---

## 验证 checklist

- [ ] `npm install` 无报错
- [ ] `node server/server.js` 启动，打印 `✦ poster-motion server running at http://127.0.0.1:4330`
- [ ] 上传一张图片，点击生成，30 秒内出现预览 PNG
- [ ] 点击"重新生成"，预览变化（不同配色或装饰）
- [ ] 下载的 PNG 尺寸为 1242×2688
- [ ] TypeScript 无编译报错（`npx tsc --noEmit`）

---

_规格生成于 2026-04-17，对应讨论 session。_
