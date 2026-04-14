# 上架图自动生成规则文档

> 对应代码：`scripts/screenshot-server.js` + `render-engine.js` + `preview.html`
> 想调整任何内容，直接对着这个文件说即可。

---

## 一、整体生成流程

```
用户输入（preview.html 左侧面板）
  ├─ App URL（必填）
  ├─ App Name（可 AI 自动填）
  ├─ Language（英文 / 中文，可多选）
  └─ Export Size（导出尺寸，可多选）
        ↓
点击 Generate
  ├─ 并行：AI 生成 App Name（若未填）
  └─ 并行：AI 生成 Logo（见 logo-rule.md）
        ↓
POST /api/oneclick-capture → 创建异步 Job
        ↓
后端 runOneclickPipeline() 执行三步：
  ├─ Step 1：自动发现页面 & 截图捕获
  ├─ Step 2：生成视觉风格配方（Style Recipe）
  └─ Step 3：AI 生成文案（Claude）
        ↓
前端每 800ms 轮询 Job 状态，实时更新进度
        ↓
渲染 6 张幻灯片（iframe 预览）
        ↓
点击 Export All → Playwright 批量渲染 PNG
  └─ 保存到 ~/Downloads/appstore-auto-screenshots-oneclick/
```

---

## 二、截图捕获规格

### 设备模拟参数
- **设备**：iPhone（User-Agent: iPhone OS 17.0）
- **逻辑分辨率**：390 × 844
- **设备像素比**：3x → 实际捕获 1170 × 2532 PNG
- **页面等待时间**：1200ms（`CAPTURE_WAIT_MS`）

### 去重策略（三层）
1. **URL 去重**：相同最终地址（含重定向）只保留一张
2. **像素完全去重**：SHA256(PNG) 完全一致的跳过
3. **视觉近似去重**：采样 20×15 网格像素，欧几里得距离过近的跳过

**最终数量**：最多 6 张不重复截图

### 导出尺寸（5 种 Apple 标准）

| 尺寸 | 设备 | 备注 |
|---|---|---|
| 1080 × 1920 | 通用安卓 / 旧机型 | |
| 1125 × 2436 | iPhone 14/15 (6.1") | |
| 1206 × 2622 | iPhone 16 Pro (6.3") | |
| 1284 × 2778 | iPhone 15 Plus (6.5") | |
| **1320 × 2868** | **iPhone 16 Pro Max (6.9")** | **主设计尺寸** |

所有布局基于 1320 × 2868 设计，导出时等比缩放。

---

## 三、视觉风格配方（Style Recipe）

每次生成时，系统随机生成一套完整的视觉方案，包含以下维度：

### 3.1 心情名称（30 个，纯展示用）
```
Arctic Dawn, Neon Pulse, Terracotta, Midnight Bloom, Solar Flare,
Sage Breeze, Deep Ocean, Amber Haze, Cosmic Dust, Mint Forest,
Crimson Dusk, Lavender Mist, Golden Hour, Obsidian, Coral Reef,
Autumn Ember, Electric Jade, Rose Quartz, Steel Blue, Citrus Pop,
Plum Twilight, Desert Sand, Aqua Neon, Bronze Age, Pearl White,
Volcanic, Tundra, Papaya Fizz, Night Garden, Glacier
```

### 3.2 色彩和谐规则（5 种，随机选 1）

| 规则 | 描述 |
|---|---|
| complementary（对比）| 主色 + 180° 对色 |
| triadic（三角）| 主色 + 120° + 240° |
| analogous（邻近）| 主色 + 30° + 60° |
| split-complementary（分裂对比）| 主色 + 150° + 210° |
| monochromatic（单色）| 主色的明暗变体 |

### 3.3 色彩模式（8 种，随机选 1）

| 模式 | 特征 | 适用场景 |
|---|---|---|
| light | 纯白/浅色背景，低饱和强调色 | 极简、清爽 |
| dark | 近黑背景，高饱和强调色 | 高级感、高对比 |
| warm-light | 暖白/米色背景 | 温暖、柔和 |
| cool-dark | 深蓝/深海背景 | 科技感、金融感 |
| earthy | 浅绿/自然色背景 | 自然、生活类 |
| neon-dark | 纯黑背景，霓虹强调色 | 赛博朋克 |

调色板包含 10 个色值：`bg`、`bgEnd`（渐变）、`accent`、`accent2`、`text`、`muted`、`card`、`chip`、`glow`、`shadow`

### 3.4 字体配对（4 套，随机选 1）

| 字体 | 语言 | 风格 | 粗度 |
|---|---|---|---|
| Inter | 英文 | 现代极简无衬线 | 900 |
| Playfair Display | 英文 | 高对比衬线 | 700 |
| Noto Sans SC | 中文 | 现代无衬线 | 700 |
| Noto Serif SC | 中文 | 衬线重量感 | 900 |

### 3.5 特殊视觉效果

| 效果 | 触发条件 | 描述 |
|---|---|---|
| **幽灵框架**（ghostFrames）| neon-dark / cool-dark 模式，55% 概率 | 主手机两侧绘制淡色 iPhone 轮廓，赛博朋克风 |
| **玻璃反射**（glassReflection）| light / warm-light 模式，55% 概率 | 手机底部绘制镜像倒影，干净光感 |

---

## 四、布局系统

### 4.1 6 种布局类型

| 布局名 | 手机位置 | 文案位置 | 视觉特点 |
|---|---|---|---|
| **hero** | 底部中央，3D 透视倾斜 | 顶部中央 | 主打冲击感，首张常用 |
| **right** | 右下角，外溢出血 | 左上角 | 强调左侧文案 |
| **left** | 左下角，外溢出血 | 右上角 | 强调右侧文案 |
| **duo** | 双手机（背景+前景叠加）| 顶部中央 | 对比展示多个界面 |
| **trust** | 中央，卡片容器内 | 顶部中央 | 建立信任感、稳重 |
| **center** | 顶部中央 | 底部中央 | 强调底部文案 |
| **bottom-right** | 右上角，外溢 | 左下角 | 文案在底部左 |
| **bottom-left** | 左上角，外溢 | 右下角 | 文案在底部右 |

### 4.2 布局视觉轴线（4 种，随机选 1）

系统从 4 种轴线中选 1 种，确保 6 张幻灯片视觉语言统一：

| 轴线 | 布局组合 |
|---|---|
| center | hero → trust → duo → center → ... |
| top-corner | right ↔ left 交替 |
| bottom-corner | bottom-right ↔ bottom-left 交替 |
| flip | right → bottom-right → left → bottom-left 交替 |

### 4.3 手机模型框尺寸

- **模型框**：1022 × 2082 px
- **截图显示区域**：宽 89.83%，高 95.58%，内边距 52px(左)/46px(顶)
- **圆角**：约 126px（与 iPhone 真实圆角一致）

---

## 五、SVG 装饰系统

每套配方随机生成 2~4 个装饰元素，叠加在背景上营造层次感。

### 5.1 装饰类型（15+ 种）

| 类型 | 描述 |
|---|---|
| blob-organic | 有机流体曲线形 |
| blob-soft | 柔和椭圆变形 |
| blob-spiky | 尖角放射曲线 |
| circle-solid | 实心正圆 |
| hexagon | 正六边形 |
| triangle-soft | 圆角三角 |
| diamond | 菱形 |
| ring | 同心圆环（径向渐变） |
| dots-grid | 点阵网格（椭圆遮罩） |
| cross-lines | 十字细线网格（低对比） |
| diagonal-lines | 45° 对角粗线（大胆） |
| street-lines | S 曲线 + 雪佛龙图标（街道感） |
| noise-grain | 胶片噪点（SVG turbulence） |
| center-pulse | 从中下部发出的同心脉冲 |
| scanlines | CSS 扫描线条纹 |

### 5.2 装饰属性范围

| 属性 | 范围 |
|---|---|
| 颜色 | accent / accent2，透明度 0.15–0.37 |
| 缩放 | 0.8x – 2.0x |
| 旋转 | 0° – 360° |
| 尺寸等级 | sm / md / lg / xl |
| 位置 | 顶右、底左、中左、顶左、底右、中右（可外溢出血 -30%） |

---

## 六、文案生成规则（Claude AI）

### 6.1 调用条件
需配置 `ANTHROPIC_API_KEY`，否则使用降级模板（见 6.3）。  
模型：`claude-sonnet-4-20250514`，每种语言单独调用一次。

### 6.2 Prompt 核心规则

**单一观点原则（最重要）**：每张幻灯片只能传达 1 个想法
- ❌ 禁止：`"Track trades, boost gains"`（两个子句）
- ✅ 正确：`"Trade smarter"`（单一想法）

**标题字符限制**：

| 语言 | 限制 | 换行规则 |
|---|---|---|
| 中文 | 5–10 字 | ≤5 字单行；6–10 字分 2 行（每行 3–6 字） |
| 英文 | 每行 ≤10 字（含空格） | 无标点 |

**副标题字符限制**：

| 语言 | 限制 |
|---|---|
| 中文 | ≤12 字，单一短语，禁用顿号/逗号分隔多个点 |
| 英文 | ≤20 字，单一直接短语，禁用逗号连接结构 |

**输入内容**：6 张截图（JPEG）+ App 名称 + 描述 + 心情名 + 布局顺序

### 6.3 降级文案模板（API 不可用时）

**英文**：
1. "The Smarter Way" / "To Get It Done"
2. "Everything You Need" / "Right Here"
3. "Designed for" / "Real Life"
4. "Simple." / "Powerful." / "Yours."
5. "Less Effort." / "Better Results."
6. "Do More" / "With Less"

**中文**：
1. "更智能的方式" / "轻松完成"
2. "一切所需" / "就在这里"
3. "为真实生活" / "而设计"
4. "简单。强大。专属。"
5. "更少努力" / "更好结果"
6. "用更少" / "做更多"

---

## 七、可配置参数

### 环境变量（`.env.local`）

| 变量 | 默认值 | 说明 |
|---|---|---|
| `PORT` | 4318 | 服务端口 |
| `ANTHROPIC_API_KEY` | - | Claude 文案生成（可选） |
| `OPENAI_API_KEY` | - | DALL·E Logo（可选） |
| `DASHSCOPE_API_KEY` | - | Qwen Logo（推荐配置） |
| `CAPTURE_WAIT_MS` | 1200 | 页面加载等待时间（ms） |
| `APP_LOGO_PAGE_TIMEOUT_MS` | 8000 | Logo 品牌色提取超时（ms） |
| `APP_LOGO_AI_TIMEOUT_MS` | 15000 | Qwen Logo 生成超时（ms） |
| `DALLE_LOGO_AI_TIMEOUT_MS` | 50000 | DALL·E Logo 超时（ms） |

### 生成接口参数（POST /api/oneclick-capture）

| 参数 | 类型 | 说明 |
|---|---|---|
| `url` | string | 目标 App 地址（必填） |
| `appName` | string | App 名称 |
| `description` | string | 一句话描述（可选，影响文案质量） |
| `languages` | ["en","zh"] | 生成语言（默认 ["en"]） |
| `brandHue` | 0–359 | 强制色调（来自 Logo 品牌色，可选） |
| `routes` | string[] | 手动指定抓取页面路径（可选） |

---

## 八、关键代码位置速查

| 功能 | 文件 | 位置 |
|---|---|---|
| 整体生成管道 | screenshot-server.js | `runOneclickPipeline()` |
| 风格配方生成 | screenshot-server.js | `generateStyleRecipe()` |
| Claude 文案生成 | screenshot-server.js | `generateCopyWithClaude()` |
| 降级文案模板 | screenshot-server.js | `buildFallbackCopy()` |
| 幻灯片 HTML 构建 | render-engine.js | `buildSlideHtml()` |
| 装饰 SVG 渲染 | render-engine.js | `decorationSvg()` |
| 手机框架 SVG | render-engine.js | `phoneSvg()` |
| 前端触发生成 | preview.html | `startGenerate()` |
| 前端导出 | preview.html | `exportAll()` |
