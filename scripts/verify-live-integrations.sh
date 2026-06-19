#!/usr/bin/env bash
# Full live integration smoke. Required services fail closed on NOT_CONFIGURED and DEGRADED.
set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

PASS=0
FAIL=0
SKIP=0
NOT_CONFIGURED=0
DEGRADED=0
REQUIRED_FAILURES=0
RESULTS=()
EVIDENCE_DIR="$ROOT/docs/evidence"
EVIDENCE_FILE="$EVIDENCE_DIR/phase6-live-integration-$(date +%Y%m%d-%H%M%S).md"

if [ -f "$ROOT/.env" ]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT/.env"
  set +a
fi

probe() {
  local name="$1"
  local endpoint="$2"
  local method="${3:-GET}"
  local data="${4:-}"
  local required="${5:-true}"
  local response curl_exit http_code

  if [ "$method" = "GET" ]; then
    response=$(curl -sS -w $'\n%{http_code}' --connect-timeout 5 --max-time 15 "$endpoint" 2>/dev/null)
    curl_exit=$?
  else
    response=$(curl -sS -w $'\n%{http_code}' --connect-timeout 5 --max-time 30 \
      -X "$method" -H 'Content-Type: application/json' -d "$data" "$endpoint" 2>/dev/null)
    curl_exit=$?
  fi
  http_code="${response##*$'\n'}"
  if [ "$curl_exit" -ne 0 ] || [ -z "$http_code" ]; then http_code="000"; fi

  if [ "$http_code" = "000" ]; then
    echo "  ⏭️  $name — NOT_CONFIGURED"
    NOT_CONFIGURED=$((NOT_CONFIGURED + 1))
    RESULTS+=("⏭️ $name: NOT_CONFIGURED | endpoint=$endpoint")
    if [ "$required" = "true" ]; then REQUIRED_FAILURES=$((REQUIRED_FAILURES + 1)); fi
    return 2
  fi
  if [ "$http_code" -ge 200 ] && [ "$http_code" -lt 400 ]; then
    echo "  ✅ $name — PASS (HTTP $http_code)"
    PASS=$((PASS + 1))
    RESULTS+=("✅ $name: PASS | HTTP $http_code | endpoint=$endpoint")
    return 0
  fi
  if [ "$http_code" -ge 400 ] && [ "$http_code" -lt 500 ]; then
    echo "  ⚠️  $name — DEGRADED (HTTP $http_code)"
    DEGRADED=$((DEGRADED + 1))
    RESULTS+=("⚠️ $name: DEGRADED | HTTP $http_code | endpoint=$endpoint")
    if [ "$required" = "true" ]; then REQUIRED_FAILURES=$((REQUIRED_FAILURES + 1)); fi
    return 3
  fi
  echo "  ❌ $name — FAIL (HTTP $http_code)"
  FAIL=$((FAIL + 1))
  RESULTS+=("❌ $name: FAIL | HTTP $http_code | endpoint=$endpoint")
  return 1
}

echo "══════════════════════════════════════════"
echo "  AIOS Live Integration Smoke"
echo "══════════════════════════════════════════"

LM_URL="${LM_STUDIO_URL:-http://localhost:1234/v1}"
probe "LM Studio /models" "$LM_URL/models" GET '' true
LM_STATUS=$?
if [ "$LM_STATUS" -eq 0 ]; then
  MODELS_JSON=$(curl -fsS --connect-timeout 5 --max-time 15 "$LM_URL/models" 2>/dev/null)
  LM_MODEL=$(node -e "const p=JSON.parse(process.argv[1]); const id=p.data?.find(x=>typeof x.id==='string')?.id; if(!id) process.exit(2); process.stdout.write(id)" "$MODELS_JSON" 2>/dev/null)
  MODEL_STATUS=$?
  if [ "$MODEL_STATUS" -ne 0 ] || [ -z "$LM_MODEL" ]; then
    echo "  ❌ LM Studio model selection — DEGRADED (no model id)"
    DEGRADED=$((DEGRADED + 1))
    REQUIRED_FAILURES=$((REQUIRED_FAILURES + 1))
    RESULTS+=("❌ LM Studio model selection: DEGRADED")
  else
    LM_BODY=$(node -e "process.stdout.write(JSON.stringify({model:process.argv[1],messages:[{role:'user',content:'Reply with ok.'}],max_tokens:8}))" "$LM_MODEL")
    probe "LM Studio completion" "$LM_URL/chat/completions" POST "$LM_BODY" true
  fi
fi

probe "LightRAG /health" "${LIGHTRAG_SERVER_URL:-http://localhost:3300}/health" GET '' "${REQUIRE_LIGHTRAG:-true}"
probe "Express API /api/health" "${AIOS_BASE_URL:-http://localhost:3201}/api/health" GET '' true
probe "Mail Portal Bridge /api/outlook/health" "${MAIL_INTELLIGENCE_URL:-http://localhost:3301}/api/outlook/health" GET '' true

if [ "${AIOS_LOCAL_ONLY:-true}" = "true" ] && [ "${LIVE_CLOUD_SMOKE:-0}" != "1" ]; then
  echo "  ⏭️  Cloud providers — SKIP (AIOS_LOCAL_ONLY=true)"
  SKIP=$((SKIP + 1))
  RESULTS+=("⏭️ Cloud providers: SKIP")
fi

if ! command -v docker >/dev/null 2>&1 || ! docker info >/dev/null 2>&1; then
  echo "  ⏭️  Docker sandbox — NOT_CONFIGURED"
  NOT_CONFIGURED=$((NOT_CONFIGURED + 1))
  RESULTS+=("⏭️ Docker sandbox: NOT_CONFIGURED")
  if [ "${REQUIRE_DOCKER:-true}" = "true" ]; then REQUIRED_FAILURES=$((REQUIRED_FAILURES + 1)); fi
elif docker run --rm --cpus=0.5 --memory=64m alpine:latest echo sandbox-ok >/dev/null 2>&1; then
  echo "  ✅ Docker sandbox — PASS"
  PASS=$((PASS + 1))
  RESULTS+=("✅ Docker sandbox: PASS")
else
  echo "  ❌ Docker sandbox — FAIL"
  FAIL=$((FAIL + 1))
  RESULTS+=("❌ Docker sandbox: FAIL")
fi

if [ -f "$ROOT/apps/desktop/package.json" ] && rg -q 'electron-builder' "$ROOT/apps/desktop/package.json"; then
  echo "  ✅ Electron desktop configuration — PASS"
  PASS=$((PASS + 1))
  RESULTS+=("✅ Electron desktop configuration: PASS")
else
  echo "  ⚠️  Electron desktop configuration — DEGRADED"
  DEGRADED=$((DEGRADED + 1))
  RESULTS+=("⚠️ Electron desktop configuration: DEGRADED (optional)")
fi

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

mkdir -p "$EVIDENCE_DIR"
{
  echo '# Phase 6 Live Integration Evidence'
  echo
  echo "> Generated: $(date -u +'%Y-%m-%dT%H:%M:%SZ')"
  echo "> Branch: $(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo unknown)"
  echo "> Commit: $(git rev-parse --short HEAD 2>/dev/null || echo unknown)"
  echo
  echo '## Summary'
  echo
  echo '| Metric | Count |'
  echo '|---|---:|'
  echo "| PASS | $PASS |"
  echo "| FAIL | $FAIL |"
  echo "| DEGRADED | $DEGRADED |"
  echo "| SKIP | $SKIP |"
  echo "| NOT_CONFIGURED | $NOT_CONFIGURED |"
  echo "| Required failures | $REQUIRED_FAILURES |"
  echo
  echo '## Results'
  echo
  for result in "${RESULTS[@]}"; do echo "- $result"; done
  echo
  echo 'Required services do not pass when they are NOT_CONFIGURED or DEGRADED.'
} > "$EVIDENCE_FILE"

echo "══════════════════════════════════════════"
echo "  Results: $PASS pass, $FAIL fail, $DEGRADED degraded, $SKIP skip, $NOT_CONFIGURED not-configured"
echo "  Required failures: $REQUIRED_FAILURES"
echo "  Evidence: $EVIDENCE_FILE"
echo "══════════════════════════════════════════"

if [ "$FAIL" -gt 0 ] || [ "$REQUIRED_FAILURES" -gt 0 ]; then exit 1; fi
