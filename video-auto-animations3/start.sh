#!/bin/bash

GREEN='\033[0;32m'
RED='\033[0;31m'
CYAN='\033[0;36m'
RESET='\033[0m'

cd "$(dirname "$0")"

echo ""
echo -e "${CYAN}✦ video-auto-animations3 (Mockup Edition) 启动中...${RESET}"
echo ""

PORT=4322

stop_existing_server() {
  local pids
  pids=$(lsof -tiTCP:${PORT} -sTCP:LISTEN 2>/dev/null || true)
  if [ -z "$pids" ]; then return; fi
  echo -e "${CYAN}[server] 检测到 ${PORT} 端口已有旧进程，准备关闭...${RESET}"
  for pid in $pids; do kill "$pid" 2>/dev/null || true; done
  for _ in $(seq 1 20); do
    sleep 0.2
    if ! lsof -tiTCP:${PORT} -sTCP:LISTEN >/dev/null 2>&1; then
      echo -e "${GREEN}[server] ✅ 已释放旧端口 ${PORT}${RESET}"
      return
    fi
  done
  echo -e "${RED}[server] ❌ 无法释放端口 ${PORT}${RESET}"
  exit 1
}

if [ -z "$ANTHROPIC_API_KEY" ]; then
  if [ -f .env ]; then
    export $(grep -v '^#' .env | xargs)
  fi
fi

if [ -z "$ANTHROPIC_API_KEY" ]; then
  echo -e "${RED}❌ ANTHROPIC_API_KEY 未设置，请在 .env 文件中配置${RESET}"
  exit 1
fi

stop_existing_server

echo -e "${CYAN}[server] 启动中...${RESET}"
node server/server.js &
SERVER_PID=$!

for i in $(seq 1 15); do
  sleep 1
  if ! kill -0 $SERVER_PID 2>/dev/null; then
    echo -e "${RED}[server] ❌ 启动失败${RESET}"
    exit 1
  fi
  if curl -s http://localhost:${PORT}/ > /dev/null 2>&1; then
    echo -e "${GREEN}[server] ✅ 已就绪 → http://localhost:${PORT}${RESET}"
    break
  fi
done

echo ""
echo -e "${GREEN}✅ 服务已就绪${RESET}"
echo -e "   打开浏览器访问 → ${CYAN}http://localhost:${PORT}${RESET}"
echo ""
echo "按 Ctrl+C 关闭服务"
echo ""

trap "echo ''; echo '正在关闭...'; kill $SERVER_PID 2>/dev/null; echo '已关闭。'; exit 0" INT TERM
wait $SERVER_PID
