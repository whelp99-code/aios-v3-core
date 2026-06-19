#!/usr/bin/env bash
# C2: Live Readiness Check — 각 연동별 빠른 상태 확인
# 실제 연결 없이 설정과 엔드포인트 가용성만 검증
set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

PASS=0
FAIL=0
SKIP=0
NOT_CONFIGURED=0
RESULTS=()

NOW=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
echo "══════════════════════════════════════════"
echo "  AIOS Live Readiness Check"
echo "  $NOW"
echo "══════════════════════════════════════════"

# ── Helper ──────────────────────────────────────────────────────────
check_endpoint() {
  local name="$1"
  local url="$2"
  local timeout="${3:-3}"
  local start end elapsed status

  start=$(python3 -c "import time; print(int(time.time()*1000))" 2>/dev/null || date +%s)
  body=$(curl -s -w $'\n%{http_code}' --connect-timeout "$timeout" --max-time "$timeout" "$url" 2>/dev/null)
  curl_exit=$?
  end=$(python3 -c "import time; print(int(time.time()*1000))" 2>/dev/null || date +%s)
  elapsed=$(( (end - start) ))

  if [ "$curl_exit" -ne 0 ] || [ -z "$status" ]; then
    status="000"
  fi

  if [ "$status" = "000" ]; then
    echo "  ⏭️  $name — NOT_CONFIGURED (connection failed, ${elapsed}ms)"
    NOT_CONFIGURED=$((NOT_CONFIGURED + 1))
    RESULTS+=("⏭️ $name: NOT_CONFIGURED")
    return 2
  elif [ "$status" -ge 200 ] && [ "$status" -lt 400 ]; then
    echo "  ✅ $name — PASS (HTTP $status, ${elapsed}ms)"
    PASS=$((PASS + 1))
    RESULTS+=("✅ $name: PASS (HTTP $status)")
    return 0
  else
    echo "  ❌ $name — FAIL (HTTP $status, ${elapsed}ms)"
    FAIL=$((FAIL + 1))
    RESULTS+=("❌ $name: FAIL (HTTP $status)")
    return 1
  fi
}

check_config() {
  local name="$1"
  local var="$2"
  local required="${3:-false}"

  if [ -n "${!var:-}" ]; then
    echo "  ✅ $name — configured"
    PASS=$((PASS + 1))
    RESULTS+=("✅ $name: configured")
    return 0
  elif [ "$required" = "true" ]; then
    echo "  ❌ $name — NOT_CONFIGURED (required, env $var empty)"
    FAIL=$((FAIL + 1))
    RESULTS+=("❌ $name: NOT_CONFIGURED (required)")
    return 1
  else
    echo "  ⏭️  $name — NOT_CONFIGURED (optional, env $var empty)"
    NOT_CONFIGURED=$((NOT_CONFIGURED + 1))
    RESULTS+=("⏭️ $name: NOT_CONFIGURED (optional)")
    return 2
  fi
}

# ── Load .env if exists ────────────────────────────────────────────
if [ -f "$ROOT/.env" ]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT/.env" 2>/dev/null || true
  set +a
fi

# ── 1. LM Studio (Local) ──────────────────────────────────────────
echo ""
echo "▶ LM Studio (Local)"
check_endpoint "LM Studio health" "${LM_STUDIO_URL:-http://localhost:1234/v1}/models" 5

# ── 2. Mimo Cloud (Optional) ──────────────────────────────────────
echo ""
echo "▶ Mimo Cloud"
check_config "MIMO_API_KEY" "MIMO_API_KEY" false
if [ -n "${MIMO_BASE_URL:-}" ]; then
  check_endpoint "Mimo endpoint" "${MIMO_BASE_URL}" 5
fi

# ── 3. LightRAG ───────────────────────────────────────────────────
echo ""
echo "▶ LightRAG"
LIGHTRAG_URL="${LIGHTRAG_SERVER_URL:-http://localhost:3300}"
check_endpoint "LightRAG health" "${LIGHTRAG_URL}/health" 5

# ── 4. Langfuse (Optional) ────────────────────────────────────────
echo ""
echo "▶ Langfuse"
check_config "LANGFUSE_SECRET_KEY" "LANGFUSE_SECRET_KEY" false
check_config "LANGFUSE_PUBLIC_KEY" "LANGFUSE_PUBLIC_KEY" false
if [ -n "${LANGFUSE_HOST:-}" ]; then
  check_endpoint "Langfuse health" "${LANGFUSE_HOST}/api/public/health" 5
fi

# ── 5. Docker Sandbox ─────────────────────────────────────────────
echo ""
echo "▶ Docker Sandbox"
if command -v docker &>/dev/null; then
  if docker info &>/dev/null; then
    echo "  ✅ Docker daemon — running"
    PASS=$((PASS + 1))
    RESULTS+=("✅ Docker daemon: running")

    # Check if sandbox images exist
    if docker image inspect node:20-alpine &>/dev/null; then
      echo "  ✅ Node sandbox image — available"
      PASS=$((PASS + 1))
      RESULTS+=("✅ Node sandbox image: available")
    else
      echo "  ⏭️  Node sandbox image — NOT_CONFIGURED (will build on demand)"
      NOT_CONFIGURED=$((NOT_CONFIGURED + 1))
      RESULTS+=("⏭️ Node sandbox image: NOT_CONFIGURED")
    fi

    if docker image inspect python:3.11-slim &>/dev/null; then
      echo "  ✅ Python sandbox image — available"
      PASS=$((PASS + 1))
      RESULTS+=("✅ Python sandbox image: available")
    else
      echo "  ⏭️  Python sandbox image — NOT_CONFIGURED (will build on demand)"
      NOT_CONFIGURED=$((NOT_CONFIGURED + 1))
      RESULTS+=("⏭️ Python sandbox image: NOT_CONFIGURED")
    fi
  else
    echo "  ❌ Docker daemon — not running"
    FAIL=$((FAIL + 1))
    RESULTS+=("❌ Docker daemon: not running")
  fi
else
  echo "  ⏭️  Docker — not installed"
  NOT_CONFIGURED=$((NOT_CONFIGURED + 1))
  RESULTS+=("⏭️ Docker: not installed")
fi

# ── 6. Express API ────────────────────────────────────────────────
echo ""
echo "▶ Express API"
API_BASE="${AIOS_BASE_URL:-http://localhost:3201}"
check_endpoint "Express API health" "${API_BASE}/api/health" 5

# ── 7. Electron (build check) ─────────────────────────────────────
echo ""
echo "▶ Electron Desktop"
if [ -d "$ROOT/apps/desktop" ]; then
  if [ -f "$ROOT/apps/desktop/package.json" ]; then
    echo "  ✅ Desktop package.json — exists"
    PASS=$((PASS + 1))
    RESULTS+=("✅ Desktop package.json: exists")
  else
    echo "  ❌ Desktop package.json — missing"
    FAIL=$((FAIL + 1))
    RESULTS+=("❌ Desktop package.json: missing")
  fi
else
  echo "  ⏭️  Desktop app — not present"
  NOT_CONFIGURED=$((NOT_CONFIGURED + 1))
  RESULTS+=("⏭️ Desktop app: not present")
fi

# ── 8. Secret masking check ───────────────────────────────────────
echo ""
echo "▶ Security: Secret Masking"
MASKING_PASS=true

# Check if any .env files are tracked by git
if git ls-files --error-unmatch .env 2>/dev/null; then
  echo "  ❌ .env is tracked by git!"
  FAIL=$((FAIL + 1))
  RESULTS+=("❌ .env tracked by git")
  MASKING_PASS=false
fi

# Check for hardcoded secrets in source (basic pattern)
HARDCODED=$(rg -n "(api_key|secret|password)\s*[:=]\s*['\"][a-zA-Z0-9]{20,}" packages/*/src server/src --type ts 2>/dev/null | head -5 || true)
if [ -n "$HARDCODED" ]; then
  echo "  ❌ Potential hardcoded secrets found:"
  echo "$HARDCODED" | head -3
  FAIL=$((FAIL + 1))
  RESULTS+=("❌ Hardcoded secrets detected")
  MASKING_PASS=false
fi

if [ "$MASKING_PASS" = true ]; then
  echo "  ✅ No obvious secret leaks in source"
  PASS=$((PASS + 1))
  RESULTS+=("✅ Secret masking: OK")
fi

# ── Summary ────────────────────────────────────────────────────────
echo ""
echo "══════════════════════════════════════════"
echo "  Readiness: $PASS pass, $FAIL fail, $SKIP skip, $NOT_CONFIGURED not_configured"
echo "══════════════════════════════════════════"
for r in "${RESULTS[@]}"; do echo "  $r"; done
echo ""

if [ "$FAIL" -gt 0 ]; then exit 1; fi
