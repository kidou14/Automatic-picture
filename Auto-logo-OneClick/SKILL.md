# Auto-logo-OneClick

一键生成 512×512 App 图标的技能。

## 启动方式

```bash
cd Auto-logo-OneClick
bash start.sh
```

服务启动后访问 → http://127.0.0.1:4319

## 使用方式

1. 在输入框填入 App 的 URL（如 `https://your-app.com`）
2. 点击 **Generate**
3. 等待 15–30 秒，图标生成后可直接下载 PNG

## 前置条件

- Node.js 18+（需支持原生 `fetch`）
- `.env.local` 中配置 `DASHSCOPE_API_KEY`（Qwen 图像生成 API Key）

## 风格定义

固定风格：霓虹发光效果 · 深色背景 · 柔和外发光 · 赛博朋克 × Apple 设计 · 最多3色 · 交易场景

如需修改风格，编辑 `scripts/logo-server.js` 中的 `prompt` 变量。

## API

| 端点 | 说明 |
|------|------|
| `GET /health` | 健康检查 |
| `GET /api/generate-logo?url=<url>` | 生成 logo，返回 `{appName, imageDataUrl}` |
