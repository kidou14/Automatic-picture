# Logo 生成新规则方案（AI自由创作版）

## 方案说明

### 与 logo-rule.md 的本质区别

| 维度 | logo-rule.md（词库版） | logo-rule-new.md（本方案） |
|------|----------------------|--------------------------|
| 主题概念 | 人工词库随机抽取（30选1） | Claude 自由创作，无预设上限 |
| 主体形状 | 人工词库随机抽取（30选1） | Claude 自由创作，无预设上限 |
| 主体颜色 | 人工词库随机抽取（30选1） | Claude 自由创作，无预设上限 |
| 背景颜色 | 人工词库随机抽取（30选1） | Claude 自由创作，无预设上限 |
| 设计风格 | 人工词库随机抽取（30选1） | **D词库随机抽取（30选1，同旧方案）** |
| 4个维度关联性 | 无，纯独立随机 | Claude 会主动思考4个维度的内在逻辑 |
| API调用次数 | 1次（图像模型） | 2次（Claude文本 → 图像模型） |

### 核心思路：两阶段 AI Pipeline

```
Stage 1: Claude（文本模型）
  └─ 输入：App名称 + Meta-Prompt
  └─ 输出：4个自由创作的设计维度（JSON）

           ↓

Stage 2: 图像生成模型（Qwen / Gemini）
  └─ 输入：Stage 1 的 JSON + D词库随机抽取的设计风格
  └─ 输出：Logo 图像
```

---

## Stage 1：Claude Meta-Prompt（文本生成阶段）

### 发送给 Claude 的 Prompt 模板

```
你是一位充满创意的Logo概念设计师。你的任务是为一款App生成一套简洁而独特的Logo设计概念。

App名称：{appName}

请从设计师的视角，自由地、大胆地创作以下4个设计维度。不要使用任何预设模板，不要走平庸路线，要寻找独特有趣的设计角度。4个维度之间应有内在的视觉逻辑和情感一致性。

【维度1：主题概念】
为这个Logo选择一个视觉驱动的抽象主题，这是整个Logo的情感内核。
- 可以来自任意领域：自然科学、哲学、金融交易、ai智能、物理现象、数学结构、全新工具、创意脑洞、天文宇宙、生物进化、音乐节奏、建筑空间、光学折射、量子力学、游戏机制、化学反应、航空航天、心理认知、工业制造、密码加密等
- 要足够具体和有画面感（不要泛泛的"创新""连接"等词）
- 用10-20字中文描述

【维度2：主体形状】
选择一个具体的、可视化的形态作为Logo的主体骨架。
- 要具体到可以让画师直接画出来的程度
- 可以是圆形、方形、长方形、三角、菱形、多边形、多角星形、梯形、钻石形、镂空形、几何体、圆柱、圆锥、有机形态、工程结构、符号变体、拓扑形态等等简洁的二维或三维形态
- 形状要与维度1的主题有内在关联
- 用10-20字中文描述

【维度3：主体颜色】
为Logo主体选择颜色，要附带质感描述。
- 包含：色调 + 视觉质感（发光/金属/渐变/哑光/折射等）
- 与主题概念要有情感上的共鸣
- 用10-20字中文描述

【维度4：背景颜色】
选择背景色，要与主体颜色形成强烈的对比或戏剧性的互补关系。
- 必须是纯色或简单渐变色，严禁出现纹理、花纹、图案、噪点等任何装饰性元素
- 包含：色调 + 氛围感描述
- 用10-20字中文描述

注意：请避免以下常见陈词滥调：纯黑背景+霓虹主体、蓝色科技感、简单几何+渐变配色。请寻找更意外、更有记忆点的组合。

以纯JSON格式输出，不要有任何额外文字或markdown标记：
{
  "theme": "...",
  "shape": "...",
  "body_color": "...",
  "bg_color": "...",
  "internal_logic": "一句话说明这4个维度的内在关联（供调试查看，不进入图像prompt）"
}
```

### Claude API 调用参数建议

```javascript
{
  model: "claude-haiku-4-5-20251001",  // 速度快、成本低
  max_tokens: 300,
  temperature: 1.0,                    // 最大创意随机性
  messages: [{ role: "user", content: metaPrompt }]
}
```

> 说明：temperature 设为 1.0 是关键，让 Claude 每次输出差异最大化，避免收敛到固定模式。

---

## Stage 2：D词库（设计风格，随机抽取）

> 此词库与 logo-rule.md 完全一致，随机抽取1个作为最终图像的渲染风格。

1. macOS 磨砂玻璃半透明质感
2. 金属铸造感，高光冷硬
3. 霓虹发光，暗底内发光效果
4. 油墨扩散，流体有机笔触
5. 等距几何立体像素风
6. C4D 高清三维渲染，超写实
7. 极简线条主义，单色细线
8. 剪纸叠层，阴影感分层
9. 水彩晕染，边缘柔和溢色
10. 玻璃折射，高透明度刻面感
11. 丝网印刷，复古颗粒质感
12. 渐变扁平化，无阴影极简
13. 布纹纤维质感，柔软立体
14. 发光粒子散点，科技动感
15. 哑光低光泽，沉稳厚重感
16. 液态金属，流动高反射
17. 木刻版画，粗犷刀刻纹理
18. 荧光描边，暗色调涂鸦风
19. 未来主义线框，透明骨骼感
20. 超扁平插画，明快色块分区
21. 彩色玻璃镶嵌，教堂花窗美感
22. 激光切割金属，精密工业锐利感
23. 故障艺术，RGB通道错位撕裂感
24. 烫金压纹，高档印刷工艺奢华感
25. 点彩画法，细密色点矩阵构成
26. 数字像素溶解，低分辨率美学感
27. 蜡笔手绘，粗粝童趣涂鸦感
28. 折纸立体构造，精准折叠切面感
29. 磁共振扫描风，科学成像冷峻感
30. 渐变描边叠加，多层轮廓光晕感

---

## Stage 2：最终图像 Prompt 模板

将 Claude 返回的 JSON + 随机抽取的 D 词库风格，代入以下模板：

```
请生成一个精致的512×512的App logo图标。

应用名称：{appName}

主题概念：{theme}
主体形状：{shape}
主体颜色：{body_color}
背景颜色：{bg_color}
设计风格：{D}

要求：图形占画布80%面积，无文字，无字母，无水印，无底部衬底，高清渲染品质，主体与背景高对比度
```

---

## 接入 logo-server.js 的说明

### 新增的 D 词库常量（与旧方案共享或独立声明皆可）

```javascript
const DESIGN_STYLES_NEW = [
  "macOS 磨砂玻璃半透明质感",
  "金属铸造感，高光冷硬",
  // ... 共30项，与 DESIGN_STYLES 内容一致
];
```

### 新增 buildPromptNew 函数（异步）

```javascript
async function buildPromptNew(appName) {
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

  // Stage 1：调用 Claude 生成4个自由维度
  const metaPrompt = `你是一位充满创意的Logo概念设计师...（完整内容见上方Meta-Prompt）`.replace('{appName}', appName);

  const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 300,
      temperature: 1.0,
      messages: [{ role: 'user', content: metaPrompt }]
    })
  });

  const claudeData = await claudeRes.json();
  const creative = JSON.parse(claudeData.content[0].text);

  // Stage 2：随机抽取设计风格
  const D = pick(DESIGN_STYLES_NEW);

  // 组装最终图像 Prompt
  return {
    prompt: `请生成一个精致的512×512的App logo图标。

应用名称：${appName}

主题概念：${creative.theme}
主体形状：${creative.shape}
主体颜色：${creative.body_color}
背景颜色：${creative.bg_color}
设计风格：${D}

要求：图形占画布80%面积，无文字，无字母，无水印，无底部衬底，高清渲染品质，主体与背景高对比度`,
    debug: {
      theme: creative.theme,
      shape: creative.shape,
      body_color: creative.body_color,
      bg_color: creative.bg_color,
      style: D,
      internal_logic: creative.internal_logic
    }
  };
}
```

### 路由切换建议

在现有接口增加 `rule` 参数即可兼容两套方案：

```javascript
// 请求：POST /api/generate?rule=new
const rule = new URL(req.url, 'http://x').searchParams.get('rule');
const { prompt, debug } = rule === 'new'
  ? await buildPromptNew(appName)
  : { prompt: buildPrompt(appName), debug: null };
```

前端切换只需在请求 URL 追加 `?rule=new` 即可，无需大改。

---

## 示例输出对比

### logo-rule.md 输出（词库机械组合）
```
主题概念：周而复始的轮回
主体形状：齿轮咬合的环状结构
主体颜色：荧光青绿，高饱和电子发光感
背景颜色：深空海军蓝，沉静宇宙感
设计风格：发光粒子散点，科技动感
```

### logo-rule-new.md 输出（Claude自由创作，实测示例）
```
主题概念：液体在失重状态下向内聚拢的瞬间张力
主体形状：内凹的球面碎裂成三片弧形镜面、向圆心塌陷
主体颜色：冷银白带蓝调，超镜面高反射金属感
背景颜色：饱和卡其黄，强烈暖调撞色底
设计风格：激光切割金属，精密工业锐利感
internal_logic：失重收缩的物理感 × 镜面弧面的视觉张力 × 冷暖对比的戏剧性，三者共同制造"高精密但情绪化"的视觉冲击
```
