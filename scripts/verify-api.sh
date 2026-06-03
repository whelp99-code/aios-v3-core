#!/usr/bin/env bash
set -uo pipefail

BASE="${AIOS_BASE_URL:-http://localhost:3000}"
PASS=0
FAIL=0

check() {
  local name="$1"
  local method="$2"
  local path="$3"
  local data="${4:-}"
  local expect="${5:-}"
  local allow_codes="${6:-200}"

  local body http_code response
  if [ "$method" = "GET" ]; then
    body=$(curl -s -w "\n%{http_code}" "$BASE$path" 2>/dev/null || echo -e "\n000")
  else
    body=$(curl -s -w "\n%{http_code}" -X "$method" -H "Content-Type: application/json" -d "$data" "$BASE$path" 2>/dev/null || echo -e "\n000")
  fi

  http_code=$(echo "$body" | tail -1)
  response=$(echo "$body" | sed '$d')

  if [ "$http_code" = "000" ]; then
    echo "  ❌ $name — connection failed"
    FAIL=$((FAIL + 1))
    return 1
  fi

  if ! echo ",$allow_codes," | grep -q ",$http_code,"; then
    echo "  ❌ $name — HTTP $http_code (allowed: $allow_codes)"
    FAIL=$((FAIL + 1))
    return 1
  fi

  if [ -n "$expect" ] && ! echo "$response" | grep -q "$expect"; then
    echo "  ❌ $name — expected '$expect' in response"
    echo "     $(echo "$response" | head -c 120)"
    FAIL=$((FAIL + 1))
    return 1
  fi

  echo "  ✅ $name — HTTP $http_code"
  PASS=$((PASS + 1))
  echo "$response"
  return 0
}

echo "══════════════════════════════════════════"
echo "  AIOS API 통합 검증 ($BASE)"
echo "══════════════════════════════════════════"

echo ""
echo "▶ Health & Status"
HEALTH_BODY=$(curl -s -w "\n%{http_code}" "$BASE/api/health" 2>/dev/null || echo -e "\n000")
HEALTH_CODE=$(echo "$HEALTH_BODY" | tail -1)
HEALTH_RESP=$(echo "$HEALTH_BODY" | sed '$d')
if { [ "$HEALTH_CODE" = "200" ] || [ "$HEALTH_CODE" = "503" ]; } && echo "$HEALTH_RESP" | grep -q "rapid-mlx"; then
  echo "  ✅ GET /api/health — HTTP $HEALTH_CODE (Rapid-MLX $(echo "$HEALTH_RESP" | grep -o '"status":"[^"]*"' | head -1))"
  PASS=$((PASS + 1))
else
  echo "  ❌ GET /api/health — HTTP $HEALTH_CODE"
  FAIL=$((FAIL + 1))
fi
check "GET /api/mcp/status" GET "/api/mcp/status" "" "adapters"
check "GET /api/stats" GET "/api/stats" "" "knowledge"

echo ""
echo "▶ Knowledge Graph"
check "POST /api/knowledge ingest" POST "/api/knowledge" \
  '{"action":"ingest","source":{"type":"skill","data":{"name":"verify-skill","description":"Verification skill"}}}' \
  "ingested"
check "POST /api/knowledge query" POST "/api/knowledge" \
  '{"action":"query","question":"verification skill"}' \
  "answer"
check "GET /api/knowledge" GET "/api/knowledge" "" "nodeCount"

echo ""
echo "▶ Workflow (Swarm)"
WF=$(curl -sf -X POST -H "Content-Type: application/json" \
  -d '{"taskInput":"Verify AIOS integration test","autoApprove":true}' \
  "$BASE/api/workflow" 2>/dev/null || echo '{}')
SESSION=$(echo "$WF" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{console.log(JSON.parse(d).sessionId||'')}catch{console.log('')}})" 2>/dev/null)

if [ -n "$SESSION" ]; then
  echo "  ✅ POST /api/workflow — sessionId=$SESSION"
  PASS=$((PASS + 1))

  echo "  ⏳ Waiting for workflow completion..."
  for i in $(seq 1 30); do
    STATUS=$(curl -sf "$BASE/api/workflow?sessionId=$SESSION" 2>/dev/null | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{console.log(JSON.parse(d).status||'')}catch{console.log('')}})" 2>/dev/null)
    if [ "$STATUS" = "completed" ] || [ "$STATUS" = "failed" ]; then
      echo "  ✅ Workflow finished — status=$STATUS (${i}s)"
      PASS=$((PASS + 1))
      curl -sf "$BASE/api/workflow?sessionId=$SESSION" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{const j=JSON.parse(d);console.log('     steps:',j.steps?.length,'agent:',j.state?.currentAgent,'kg:',j.state?.knowledgeGraphUpdates?.length)})" 2>/dev/null
      break
    fi
    sleep 1
  done
  if [ "$STATUS" != "completed" ] && [ "$STATUS" != "failed" ]; then
    echo "  ❌ Workflow timeout"
    FAIL=$((FAIL + 1))
  fi
else
  echo "  ❌ POST /api/workflow — no sessionId"
  FAIL=$((FAIL + 1))
fi

echo ""
echo "▶ Evolution & Community"
check "GET /api/evolution" GET "/api/evolution" "" "proposals"
check "GET /api/community" GET "/api/community" "" "contributions"
check "POST /api/webhooks subscribe" POST "/api/webhooks" \
  '{"url":"http://localhost:9999/hook","events":["workflow.completed"]}' \
  "subscription"

echo ""
echo "▶ Evolution approve → apply"
EVO=$(curl -s "$BASE/api/evolution" 2>/dev/null)
PID=$(echo "$EVO" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{const p=JSON.parse(d).proposals?.[0];console.log(p?.id||'')}catch{console.log('')}})" 2>/dev/null)
if [ -n "$PID" ]; then
  curl -sf -X POST -H "Content-Type: application/json" -d "{\"proposalId\":\"$PID\",\"action\":\"approve\"}" "$BASE/api/evolution" > /dev/null
  APPLY=$(curl -s -X POST -H "Content-Type: application/json" -d "{\"proposalId\":\"$PID\",\"action\":\"apply\"}" "$BASE/api/evolution")
  if echo "$APPLY" | grep -q '"status":"applied"'; then
    echo "  ✅ Evolution Hot-Patch applied — $PID"
    PASS=$((PASS + 1))
  else
    echo "  ❌ Evolution apply failed"
    FAIL=$((FAIL + 1))
  fi
else
  echo "  ⚠️  No evolution proposal to test (skipped)"
fi

echo ""
echo "══════════════════════════════════════════"
echo "  API 검증 결과: $PASS passed, $FAIL failed"
echo "══════════════════════════════════════════"

[ "$FAIL" -eq 0 ]
