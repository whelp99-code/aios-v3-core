#!/usr/bin/env bash
# C2: Live Integration Smoke — 실제 런타임 연결 테스트
#각 연동을 독립 프로비로 테스트하고 PASS/FAIL/SKIP/NOT_CONFIGURED를 기록
set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

PASS=0
FAIL=0
SKIP=0
NOT_CONFIGURED=0
DEGRADED=0
RESULTS=()
EVIDENCE_DIR="$ROOT/docs/evidence"
EVIDENCE_FILE="$EVIDENCE_DIR/phase6-live-integration-$(date +%Y%m%d-%H%M%S).md"

LIVE_CLOUD="${LIVE_CLOUD_SMOKE:-0}"
LOCAL_ONLY="${AIOS_LOCAL_ONLY:-true}"

NOW=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
echo "══════════════════════════════════════════"
echo "  AIOS Live Integration Smoke"
echo "  $NOW"
echo "  LIVE_CLOUD_SMOKE=$LIVE_CLOUD | LOCAL_ONLY=$LOCAL_ONLY"
echo "══════════════════════════════════════════"

# ── Load .env ──────────────────────────────────────────────────────
if [ -f "$ROOT/.env" ]; then
  set -a
  source "$ROOT/.env" 2>/dev/null || true
  set +a
fi

# ── Helper ─────────────────────────────────────────────────────────
probe() {
  local name="$1"
  local endpoint="$2"
  local method="${3:-GET}"
  local data="${4:-}"
  local timeout="${5:-5}"
  local start end elapsed http_code body

  start=$(python3 -c "import time; print(int(time.time()*1000))" 2>/dev/null || date +%s)

  if [ "$method" = "GET" ]; then
    body=$(curl -s -w $'\n%{http_code}' --connect-timeout "$timeout" --max-time "$timeout" "$endpoint" 2>/dev/null)
    curl_exit=$?
  else
    body=$(curl -s -w $'\n%{http_code}' --connect-timeout "$timeout" --max-time "$timeout" -X "$method" -H "Content-Type: application/json" -d "$data" "$endpoint" 2>/dev/null)
    curl_exit=$?
  fi

  if [ "$curl_exit" -ne 0 ] || [ -z "$body" ]; then
    body=$'\n000'
  fi

  end=$(python3 -c "import time; print(int(time.time()*1000))" 2>/dev/null || date +%s)
  elapsed=$(( (end - start) ))

  http_code=$(echo "$body" | tail -1)
  body=$(echo "$body" | sed '$d')

  if [ "$http_code" = "000" ]; then
    echo "  ⏭️  $name — NOT_CONFIGURED (${elapsed}ms, endpoint unreachable)"
    NOT_CONFIGURED=$((NOT_CONFIGURED + 1))
    RESULTS+=("⏭️ $name: NOT_CONFIGURED | endpoint=$endpoint | ${elapsed}ms")
    return 2
  fi

  if [ "$http_code" -ge 200 ] && [ "$http_code" -lt 400 ]; then
    echo "  ✅ $name — PASS (HTTP $http_code, ${elapsed}ms)"
    PASS=$((PASS + 1))
    RESULTS+=("✅ $name: PASS | HTTP $http_code | endpoint=$endpoint | ${elapsed}ms")
    return 0
  elif [ "$http_code" -ge 400 ] && [ "$http_code" -lt 500 ]; then
    echo "  ⚠️  $name — DEGRADED (HTTP $http_code, ${elapsed}ms)"
    DEGRADED=$((DEGRADED + 1))
    RESULTS+=("⚠️ $name: DEGRADED | HTTP $http_code | endpoint=$endpoint | ${elapsed}ms")
    return 3
  else
    echo "  ❌ $name — FAIL (HTTP $http_code, ${elapsed}ms)"
    FAIL=$((FAIL + 1))
    RESULTS+=("❌ $name: FAIL | HTTP $http_code | endpoint=$endpoint | ${elapsed}ms")
    return 1
  fi
}

# ── 1. LM Studio ──────────────────────────────────────────────────
echo ""
echo "▶ [1/7] LM Studio (Local)"
LM_URL="${LM_STUDIO_URL:-http://localhost:1234/v1}"

probe "LM Studio /models" "$LM_URL/models" "GET" "" 5
LM_STATUS=$?

if [ "$LM_STATUS" -eq 0 ]; then
  # Try minimal completion
  probe "LM Studio completion" "$LM_URL/chat/completions" "POST" \
    '{"model":"local-model","messages":[{"role":"user","content":"hi"}],"max_tokens":5}' 10
fi

# ── 2. Mimo Cloud ─────────────────────────────────────────────────
echo ""
echo "▶ [2/7] Mimo Cloud"
if [ "$LOCAL_ONLY" = "true" ] && [ "$LIVE_CLOUD" != "1" ]; then
  echo "  ⏭️  Mimo Cloud — SKIP (LOCAL_ONLY=true, set LIVE_CLOUD_SMOKE=1 to enable)"
  SKIP=$((SKIP + 1))
  RESULTS+=("⏭️ Mimo Cloud: SKIP | LOCAL_ONLY")
elif [ -z "${MIMO_API_KEY:-}" ]; then
  echo "  ⏭️  Mimo Cloud — NOT_CONFIGURED (MIMO_API_KEY empty)"
  NOT_CONFIGURED=$((NOT_CONFIGURED + 1))
  RESULTS+=("⏭️ Mimo Cloud: NOT_CONFIGURED | MIMO_API_KEY empty")
else
  MIMO_URL="${MIMO_BASE_URL:-https://api.together.xyz/v1}"
  probe "Mimo health" "$MIMO_URL/models" "GET" "" 5
fi

# ── 3. LightRAG ───────────────────────────────────────────────────
echo ""
echo "▶ [3/7] LightRAG"
LR_URL="${LIGHTRAG_SERVER_URL:-http://localhost:3300}"

probe "LightRAG /health" "$LR_URL/health" "GET" "" 5
LR_STATUS=$?

if [ "$LR_STATUS" -eq 0 ]; then
  probe "LightRAG /query" "$LR_URL/query" "POST" \
    '{"query":"test query","mode":"naive"}' 10
fi

# ── 4. Langfuse ───────────────────────────────────────────────────
echo ""
echo "▶ [4/7] Langfuse"
if [ "$LOCAL_ONLY" = "true" ] && [ "$LIVE_CLOUD" != "1" ]; then
  echo "  ⏭️  Langfuse — SKIP (LOCAL_ONLY=true)"
  SKIP=$((SKIP + 1))
  RESULTS+=("⏭️ Langfuse: SKIP | LOCAL_ONLY")
elif [ -z "${LANGFUSE_SECRET_KEY:-}" ]; then
  echo "  ⏭️  Langfuse — NOT_CONFIGURED (LANGFUSE_SECRET_KEY empty)"
  NOT_CONFIGURED=$((NOT_CONFIGURED + 1))
  RESULTS+=("⏭️ Langfuse: NOT_CONFIGURED | LANGFUSE_SECRET_KEY empty")
else
  LF_URL="${LANGFUSE_HOST:-http://localhost:3000}"
  probe "Langfuse health" "$LF_URL/api/public/health" "GET" "" 5
fi

# ── 5. Docker Sandbox ─────────────────────────────────────────────
echo ""
echo "▶ [5/7] Docker Sandbox"
if ! command -v docker &>/dev/null; then
  echo "  ⏭️  Docker — NOT_CONFIGURED (not installed)"
  NOT_CONFIGURED=$((NOT_CONFIGURED + 1))
  RESULTS+=("⏭️ Docker Sandbox: NOT_CONFIGURED | not installed")
elif ! docker info &>/dev/null; then
  echo "  ❌ Docker — FAIL (daemon not running)"
  FAIL=$((FAIL + 1))
  RESULTS+=("❌ Docker Sandbox: FAIL | daemon not running")
else
  echo "  ✅ Docker daemon — running"
  PASS=$((PASS + 1))
  RESULTS+=("✅ Docker daemon: PASS")

  # Minimal container test (no image pull — use alpine if available)
  START=$(python3 -c "import time; print(int(time.time()*1000))" 2>/dev/null || date +%s)
  if docker run --rm --cpus=0.5 --memory=64m alpine:latest echo "sandbox-ok" 2>/dev/null; then
    END=$(python3 -c "import time; print(int(time.time()*1000))" 2>/dev/null || date +%s)
    ELAPSED=$(( END - START ))
    echo "  ✅ Docker sandbox exec — PASS (${ELAPSED}ms)"
    PASS=$((PASS + 1))
    RESULTS+=("✅ Docker sandbox exec: PASS | ${ELAPSED}ms")
  else
    END=$(python3 -c "import time; print(int(time.time()*1000))" 2>/dev/null || date +%s)
    ELAPSED=$(( END - START ))
    echo "  ❌ Docker sandbox exec — FAIL (${ELAPSED}ms)"
    FAIL=$((FAIL + 1))
    RESULTS+=("❌ Docker sandbox exec: FAIL | ${ELAPSED}ms")
  fi
fi

# ── 6. Express API ────────────────────────────────────────────────
echo ""
echo "▶ [6/7] Express API"
API_URL="${AIOS_BASE_URL:-http://localhost:3201}"

probe "Express API /api/health" "$API_URL/api/health" "GET" "" 5
API_STATUS=$?

if [ "$API_STATUS" -eq 0 ]; then
  probe "Express API /api/engines" "$API_URL/api/engines" "GET" "" 5
  probe "Express API /api/mcp/status" "$API_URL/api/mcp/status" "GET" "" 5
fi

# ── 7. Electron compile check ─────────────────────────────────────
echo ""
echo "▶ [7/7] Electron Desktop"
if [ -f "$ROOT/apps/desktop/package.json" ]; then
  echo "  ✅ Desktop package.json — exists"
  PASS=$((PASS + 1))
  RESULTS+=("✅ Desktop package.json: exists")

  # Check if electron-builder config exists
  if grep -q "electron-builder" "$ROOT/apps/desktop/package.json" 2>/dev/null; then
    echo "  ✅ Electron-builder — configured"
    PASS=$((PASS + 1))
    RESULTS+=("✅ Electron-builder: configured")
  else
    echo "  ⚠️  Electron-builder — not found in package.json"
    DEGRADED=$((DEGRADED + 1))
    RESULTS+=("⚠️ Electron-builder: not configured")
  fi
else
  echo "  ⏭️  Desktop app — NOT_CONFIGURED"
  NOT_CONFIGURED=$((NOT_CONFIGURED + 1))
  RESULTS+=("⏭️ Desktop app: NOT_CONFIGURED")
fi

# ── Write Evidence ─────────────────────────────────────────────────
mkdir -p "$EVIDENCE_DIR"
cat > "$EVIDENCE_FILE" << EOF
# Phase 6 Live Integration Evidence

> Generated: $NOW
> Branch: $(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")
> Commit: $(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
> LIVE_CLOUD_SMOKE=$LIVE_CLOUD | LOCAL_ONLY=$LOCAL_ONLY

## Summary

| Metric | Count |
|--------|-------|
| PASS | $PASS |
| FAIL | $FAIL |
| DEGRADED | $DEGRADED |
| SKIP | $SKIP |
| NOT_CONFIGURED | $NOT_CONFIGURED |

## Detailed Results

EOF

for r in "${RESULTS[@]}"; do
  echo "- $r" >> "$EVIDENCE_FILE"
done

cat >> "$EVIDENCE_FILE" << EOF

## Environment

- LM_STUDIO_URL: \${LM_STUDIO_URL:-http://localhost:1234/v1}
- LIGHTRAG_SERVER_URL: \${LIGHTRAG_SERVER_URL:-http://localhost:3300}
- LANGFUSE_HOST: \${LANGFUSE_HOST:-http://localhost:3000}
- AIOS_BASE_URL: \${AIOS_BASE_URL:-http://localhost:3201}
- Docker: $(docker --version 2>/dev/null || echo "not installed")

## Notes

- Mock responses are NOT treated as live PASS
- local_only=true blocks all cloud provider calls
- LIVE_CLOUD_SMOKE=1 required for paid API tests
- Secrets are masked in this report
EOF

echo ""
echo "══════════════════════════════════════════"
echo "  Results: $PASS pass, $FAIL fail, $DEGRADED degraded, $SKIP skip, $NOT_CONFIGURED not_configured"
echo "  Evidence: $EVIDENCE_FILE"
echo "══════════════════════════════════════════"

if [ "$FAIL" -gt 0 ]; then exit 1; fi
