#!/usr/bin/env bash
# Fast live-readiness gate. Required services fail closed on NOT_CONFIGURED or non-2xx.
set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

PASS=0
FAIL=0
SKIP=0
NOT_CONFIGURED=0
RESULTS=()

check_endpoint() {
  local name="$1"
  local url="$2"
  local required="${3:-true}"
  local body status curl_exit

  body=$(curl -sS -w $'\n%{http_code}' --connect-timeout 5 --max-time 10 "$url" 2>/dev/null)
  curl_exit=$?
  status="${body##*$'\n'}"
  if [ "$curl_exit" -ne 0 ] || [ -z "$status" ]; then status="000"; fi

  if [ "$status" = "000" ]; then
    if [ "$required" = "true" ]; then
      echo "  ❌ $name — NOT_CONFIGURED (required)"
      FAIL=$((FAIL + 1))
      RESULTS+=("❌ $name: NOT_CONFIGURED (required)")
    else
      echo "  ⏭️  $name — NOT_CONFIGURED (optional)"
      NOT_CONFIGURED=$((NOT_CONFIGURED + 1))
      RESULTS+=("⏭️ $name: NOT_CONFIGURED (optional)")
    fi
    return
  fi

  if [ "$status" -ge 200 ] && [ "$status" -lt 400 ]; then
    echo "  ✅ $name — PASS (HTTP $status)"
    PASS=$((PASS + 1))
    RESULTS+=("✅ $name: PASS")
  else
    echo "  ❌ $name — DEGRADED (HTTP $status)"
    FAIL=$((FAIL + 1))
    RESULTS+=("❌ $name: DEGRADED (HTTP $status)")
  fi
}

if [ -f "$ROOT/.env" ]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT/.env"
  set +a
fi

echo "══════════════════════════════════════════"
echo "  AIOS Live Readiness Check"
echo "══════════════════════════════════════════"

check_endpoint "LM Studio /models" "${LM_STUDIO_URL:-http://localhost:1234/v1}/models" true
check_endpoint "LightRAG /health" "${LIGHTRAG_SERVER_URL:-http://localhost:3300}/health" "${REQUIRE_LIGHTRAG:-true}"
check_endpoint "Express API /api/health" "${AIOS_BASE_URL:-http://localhost:3201}/api/health" true
check_endpoint "Mail Portal Bridge /api/outlook/health" "${MAIL_INTELLIGENCE_URL:-http://localhost:3301}/api/outlook/health" true

if [ "${AIOS_LOCAL_ONLY:-true}" = "true" ] && [ "${LIVE_CLOUD_SMOKE:-0}" != "1" ]; then
  echo "  ⏭️  Cloud providers — SKIP (AIOS_LOCAL_ONLY=true)"
  SKIP=$((SKIP + 1))
  RESULTS+=("⏭️ Cloud providers: SKIP")
fi

if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
  echo "  ✅ Docker daemon — PASS"
  PASS=$((PASS + 1))
  RESULTS+=("✅ Docker daemon: PASS")
elif [ "${REQUIRE_DOCKER:-true}" = "true" ]; then
  echo "  ❌ Docker daemon — NOT_CONFIGURED (required)"
  FAIL=$((FAIL + 1))
  RESULTS+=("❌ Docker daemon: NOT_CONFIGURED (required)")
else
  echo "  ⏭️  Docker daemon — NOT_CONFIGURED (optional)"
  NOT_CONFIGURED=$((NOT_CONFIGURED + 1))
  RESULTS+=("⏭️ Docker daemon: NOT_CONFIGURED (optional)")
fi

if git ls-files --error-unmatch .env >/dev/null 2>&1; then
  echo "  ❌ Secret scan — tracked .env"
  FAIL=$((FAIL + 1))
  RESULTS+=("❌ Secret scan: tracked .env")
else
  SECRET_OUTPUT=$(rg -n "(api_key|secret|password)\s*[:=]\s*['\"][a-zA-Z0-9]{20,}" packages apps server --glob '*.ts' 2>/dev/null)
  RG_STATUS=$?
  if [ "$RG_STATUS" -eq 0 ]; then
    echo "  ❌ Secret scan — candidate found"
    echo "$SECRET_OUTPUT"
    FAIL=$((FAIL + 1))
    RESULTS+=("❌ Secret scan: candidate found")
  elif [ "$RG_STATUS" -eq 1 ]; then
    echo "  ✅ Secret scan — PASS"
    PASS=$((PASS + 1))
    RESULTS+=("✅ Secret scan: PASS")
  else
    echo "  ❌ Secret scan — execution failed"
    FAIL=$((FAIL + 1))
    RESULTS+=("❌ Secret scan: execution failed")
  fi
fi

echo "══════════════════════════════════════════"
echo "  Readiness: $PASS pass, $FAIL fail, $SKIP skip, $NOT_CONFIGURED optional-not-configured"
for result in "${RESULTS[@]}"; do echo "  $result"; done
echo "══════════════════════════════════════════"

if [ "$FAIL" -gt 0 ]; then exit 1; fi
