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

PORT=4318

stop_existing_server() {
  local pids
  pids=$(lsof -tiTCP:${PORT} -sTCP:LISTEN 2>/dev/null || true)
  if [ -z "$pids" ]; then
    return
  fi

  echo -e "${CYAN}[server] 检测到 ${PORT} 端口已有旧进程，准备关闭...${RESET}"
  for pid in $pids; do
    kill "$pid" 2>/dev/null || true
  done

  for _ in $(seq 1 20); do
    sleep 0.2
    if ! lsof -tiTCP:${PORT} -sTCP:LISTEN >/dev/null 2>&1; then
      echo -e "${GREEN}[server] ✅ 已释放旧端口 ${PORT}${RESET}"
      return
    fi
  done

  echo -e "${RED}[server] ❌ 无法释放端口 ${PORT}，请手动检查占用进程${RESET}"
  exit 1
}

# 检查依赖
if ! node -e "require('playwright')" 2>/dev/null; then
  echo -e "${RED}❌ 缺少依赖，正在安装...${RESET}"
  npm install
  npx playwright install chromium
fi

stop_existing_server

# 启动 screenshot-server
echo -e "${CYAN}[server] 启动中...${RESET}"
node scripts/screenshot-server.js &
SERVER_PID=$!

# 等待服务就绪（最多 10 秒）
for i in $(seq 1 10); do
  sleep 1
  if ! kill -0 $SERVER_PID 2>/dev/null; then
    echo -e "${RED}[server] ❌ 启动失败，请检查上方报错信息${RESET}"
    exit 1
  fi
  if curl -s http://localhost:${PORT}/health > /dev/null 2>&1; then
    if curl -s -o /dev/null -w "%{http_code}" "http://localhost:${PORT}/api/suggest-app-logo?url=https%3A%2F%2Fexample.com" | grep -qv '^404$'; then
      echo -e "${GREEN}[server] ✅ 已就绪 → http://localhost:${PORT}${RESET}"
      break
    fi
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
