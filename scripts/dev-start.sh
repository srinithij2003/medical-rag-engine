#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUN_DIR="$ROOT_DIR/.run"
LOG_DIR="$ROOT_DIR/.logs"
BACKEND_PID_FILE="$RUN_DIR/backend.pid"
FRONTEND_PID_FILE="$RUN_DIR/frontend.pid"

mkdir -p "$RUN_DIR" "$LOG_DIR"

for port in 3000 8000; do
  pids="$(lsof -tiTCP:"$port" -sTCP:LISTEN || true)"
  if [[ -n "$pids" ]]; then
    echo "$pids" | xargs kill -9
    echo "Freed port $port"
  fi
done

if [[ ! -d "$ROOT_DIR/.venv" ]]; then
  echo "Missing Python venv at $ROOT_DIR/.venv"
  echo "Run: python3.11 -m venv .venv && source .venv/bin/activate && pip install -r backend/requirements.txt"
  exit 1
fi

if [[ ! -d "$ROOT_DIR/frontend/node_modules" ]]; then
  echo "Installing frontend dependencies..."
  (cd "$ROOT_DIR/frontend" && npm install)
fi

if [[ -f "$BACKEND_PID_FILE" ]] && kill -0 "$(cat "$BACKEND_PID_FILE")" 2>/dev/null; then
  echo "Backend already running (PID $(cat "$BACKEND_PID_FILE"))"
else
  echo "Starting backend on :8000"
  (
    cd "$ROOT_DIR"
    source .venv/bin/activate
    nohup uvicorn backend.main:app --host 0.0.0.0 --port 8000 >"$LOG_DIR/backend.log" 2>&1 &
    echo $! >"$BACKEND_PID_FILE"
  )
fi

if [[ -f "$FRONTEND_PID_FILE" ]] && kill -0 "$(cat "$FRONTEND_PID_FILE")" 2>/dev/null; then
  echo "Frontend already running (PID $(cat "$FRONTEND_PID_FILE"))"
else
  echo "Starting frontend on :3000"
  (
    cd "$ROOT_DIR/frontend"
    rm -rf .next
    nohup npm run dev -- -p 3000 >"$LOG_DIR/frontend.log" 2>&1 &
    echo $! >"$FRONTEND_PID_FILE"
  )
fi

sleep 2

if [[ ! -f "$BACKEND_PID_FILE" ]] || ! kill -0 "$(cat "$BACKEND_PID_FILE")" 2>/dev/null; then
  echo "Backend failed to stay up. See $LOG_DIR/backend.log"
  exit 1
fi

if [[ ! -f "$FRONTEND_PID_FILE" ]] || ! kill -0 "$(cat "$FRONTEND_PID_FILE")" 2>/dev/null; then
  echo "Frontend failed to stay up. See $LOG_DIR/frontend.log"
  exit 1
fi

echo "Backend health:"
curl -sS http://localhost:8000/health || true

echo
echo "Frontend response:"
curl -I -sS http://localhost:3000 | head -n 1 || true

echo
echo "Logs:"
echo "  backend:  $LOG_DIR/backend.log"
echo "  frontend: $LOG_DIR/frontend.log"
