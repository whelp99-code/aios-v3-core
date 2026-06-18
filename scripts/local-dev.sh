#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ ! -f .env ]]; then
  echo "Creating .env from .env.example — edit API keys if needed."
  cp .env.example .env
fi

echo "AIOS local dev (Mac primary)"
echo "  Repo:    $ROOT"
echo "  Branch:  $(git branch --show-current 2>/dev/null || echo '?')"
echo "  Commit:  $(git rev-parse --short HEAD 2>/dev/null || echo '?')"
echo ""
echo "Starting web (:3000) + server (:3201)..."
echo "  LM Studio:  \${LM_STUDIO_URL:-http://localhost:1234/v1}"
echo "  Mock MLX:   python mock_server.py  (port 8000, optional)"
echo ""

exec pnpm dev
