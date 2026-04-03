#!/bin/bash

# 颜色
GREEN='\033[0;32m'
RED='\033[0;31m'
CYAN='\033[0;36m'
RESET='\033[0m'

# 切换到脚本所在目录
cd "$(dirname "$0")"

echo ""
echo -e "${CYAN}✦ appstore-auto-screenshots-OneClick 启动中...${RESET}"
echo ""

# 检查依赖
if ! node -e "require('playwright')" 2>/dev/null; then
  echo -e "${RED}❌ 缺少依赖，正在安装...${RESET}"
  npm install
  npx playwright install chromium
fi

# 启动 screenshot-server
echo -e "${CYAN}[server] 启动中...${RESET}"
node scripts/screenshot-server.js &
SERVER_PID=$!

# 等待服务就绪（最多 10 秒）
for i in $(seq 1 10); do
  sleep 1
  if curl -s http://localhost:4318/health > /dev/null 2>&1; then
    echo -e "${GREEN}[server] ✅ 已就绪 → http://localhost:4318${RESET}"
    break
  fi
  if [ $i -eq 10 ]; then
    echo -e "${RED}[server] ❌ 启动超时，请检查报错信息${RESET}"
    kill $SERVER_PID 2>/dev/null
    exit 1
  fi
done

echo ""
echo -e "${GREEN}✅ 服务已就绪${RESET}"
echo -e "   打开浏览器访问 → ${CYAN}http://127.0.0.1:4318${RESET}"
echo ""
echo "按 Ctrl+C 关闭服务"
echo ""

# 捕获 Ctrl+C，优雅退出
trap "echo ''; echo '正在关闭...'; kill $SERVER_PID 2>/dev/null; echo '已关闭。'; exit 0" INT TERM

# 保持脚本运行
wait $SERVER_PID
