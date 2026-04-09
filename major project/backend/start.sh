#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

if [[ ! -d "python_app/.venv" ]]; then
  python3 -m venv python_app/.venv
fi
# shellcheck disable=SC1091
source python_app/.venv/bin/activate
pip install -q -r python_app/requirements.txt

if [[ ! -d "node_app/node_modules" ]]; then
  (cd node_app && npm install)
fi

export PYTHON_SERVICE_URL="${PYTHON_SERVICE_URL:-http://127.0.0.1:8000}"
export NODE_SERVICE_URL="${NODE_SERVICE_URL:-http://127.0.0.1:3001}"
export GO_SERVICE_URL="${GO_SERVICE_URL:-http://127.0.0.1:8082}"

cleanup() {
  [[ -n "${GO_PID:-}" ]] && kill "$GO_PID" 2>/dev/null || true
  [[ -n "${NODE_PID:-}" ]] && kill "$NODE_PID" 2>/dev/null || true
  [[ -n "${PY_PID:-}" ]] && kill "$PY_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

(cd go_app && go run .) &
GO_PID=$!
sleep 0.3
(cd node_app && npm start) &
NODE_PID=$!
sleep 0.3
(cd python_app && uvicorn main:app --reload --host 127.0.0.1 --port 8000) &
PY_PID=$!

echo "Python API:  http://127.0.0.1:8000/docs"
echo "Node:        http://127.0.0.1:3001/health"
echo "Go:          http://127.0.0.1:8082/health"
wait
