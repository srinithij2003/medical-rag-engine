#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUN_DIR="$ROOT_DIR/.run"

show_status() {
  local label="$1"
  local file="$2"
  if [[ -f "$file" ]]; then
    local pid
    pid="$(cat "$file")"
    if kill -0 "$pid" 2>/dev/null; then
      echo "$label: running (PID $pid)"
      return
    fi
  fi
  echo "$label: not running"
}

show_status "backend" "$RUN_DIR/backend.pid"
show_status "frontend" "$RUN_DIR/frontend.pid"

echo ""
echo "Port checks:"
lsof -nP -iTCP:8000 -sTCP:LISTEN || true
lsof -nP -iTCP:3000 -sTCP:LISTEN || true
