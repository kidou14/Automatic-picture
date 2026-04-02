#!/bin/bash

# 颜色
GREEN='\033[0;32m'
RED='\033[0;31m'
CYAN='\033[0;36m'
RESET='\033[0m'

# 切换到脚本所在目录
cd "$(dirname "$0")"

echo ""
echo -e "${CYAN}正在启动 appstore-auto-screenshots...${RESET}"
echo ""

# 检查依赖
if ! node -e "require('playwright')" 2>/dev/null; then
  echo -e "${RED}❌ 缺少依赖，正在安装...${RESET}"
  npm install
  npx playwright install chromium
fi

# 启动 screenshot-server
echo -e "${CYAN}[screenshot-server] 启动中...${RESET}"
node scripts/screenshot-server.js &
SERVER_PID=$!

# 等待服务就绪（最多 10 秒）
for i in $(seq 1 10); do
  sleep 1
  if curl -s http://localhost:4317/health > /dev/null 2>&1; then
    echo -e "${GREEN}[screenshot-server] ✅ 已就绪 → http://localhost:4317${RESET}"
    break
  fi
  if [ $i -eq 10 ]; then
    echo -e "${RED}[screenshot-server] ❌ 启动超时，请检查报错信息${RESET}"
    kill $SERVER_PID 2>/dev/null
    exit 1
  fi
done

echo ""
echo -e "${GREEN}✅ 所有服务已就绪${RESET}"
echo -e "   截图服务：http://localhost:4317"
echo -e "   预览页面：用浏览器打开 preview.html"
echo ""
echo "按 Ctrl+C 关闭所有服务"
echo ""

# 捕获 Ctrl+C，优雅退出
trap "echo ''; echo '正在关闭...'; kill $SERVER_PID 2>/dev/null; echo '已关闭。'; exit 0" INT TERM

# 保持脚本运行
wait $SERVER_PID
