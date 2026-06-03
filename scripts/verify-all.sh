#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

PASS=0
FAIL=0
RESULTS=()

log() { echo ""; echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"; echo "▶ $1"; echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"; }
pass() { PASS=$((PASS + 1)); RESULTS+=("✅ $1"); echo "  ✅ PASS: $1"; }
fail() { FAIL=$((FAIL + 1)); RESULTS+=("❌ $1"); echo "  ❌ FAIL: $1"; [ -n "${2:-}" ] && echo "     $2"; }

log "1/7 패키지 빌드 (build:packages)"
if pnpm build:packages > /tmp/aios-build.log 2>&1; then
  pass "pnpm build:packages"
else
  fail "pnpm build:packages" "$(tail -5 /tmp/aios-build.log)"
fi

log "2/7 Hybrid AI Core smoke test"
if node packages/ai-core/scripts/smoke-test.js > /tmp/aios-hybrid.log 2>&1; then
  pass "Hybrid AI Core (registry + router + multi-engine)"
else
  fail "Hybrid AI Core" "$(tail -3 /tmp/aios-hybrid.log)"
fi

log "3/7 MCP Adapters smoke test"
if node packages/mcp-adapters/scripts/smoke-test.js > /tmp/aios-mcp.log 2>&1; then
  pass "MCP adapters (3 apps, tool call)"
else
  fail "MCP adapters" "$(tail -3 /tmp/aios-mcp.log)"
fi

log "4/7 Knowledge Graph smoke test"
if node packages/knowledge-graph/scripts/smoke-test.js > /tmp/aios-kg.log 2>&1; then
  pass "Knowledge Graph (ingest + GraphRAG)"
else
  fail "Knowledge Graph" "$(tail -3 /tmp/aios-kg.log)"
fi

log "5/7 Orchestrator smoke test"
if node packages/orchestrator/scripts/smoke-test.js > /tmp/aios-orch.log 2>&1; then
  if grep -q "Final Agent: completed" /tmp/aios-orch.log; then
    pass "Orchestrator workflow → completed"
  else
    fail "Orchestrator workflow" "Did not reach completed state"
  fi
else
  fail "Orchestrator" "$(tail -3 /tmp/aios-orch.log)"
fi

log "6/7 Self-Evolution unit checks"
if node -e "
const { EvolutionKernel } = require('./packages/self-evolution/dist/index');
(async () => {
  const k = new EvolutionKernel();
  const p = await k.proposals.generate('needs correction: missing error handler', 'FILE: src/a.ts', [{ filePath: 'src/a.ts', diff: '+export {}' }]);
  k.hotPatch.approve(p.id);
  const applied = k.hotPatch.apply(p.id);
  if (!applied || applied.status !== 'applied') process.exit(1);
  k.experience.add({ taskInput: 't', plan: null, executionResult: null, review: null, success: true, reward: 1 });
  console.log('ok');
})();
" > /tmp/aios-evo.log 2>&1; then
  pass "Self-Evolution (proposal → approve → apply)"
else
  fail "Self-Evolution" "$(tail -3 /tmp/aios-evo.log)"
fi

log "7/7 Web App build"
if cd apps/web && pnpm build > /tmp/aios-web.log 2>&1; then
  pass "Next.js production build"
else
  fail "Web build" "$(tail -5 /tmp/aios-web.log)"
fi

echo ""
echo "══════════════════════════════════════════"
echo "  AIOS 검증 결과: $PASS passed, $FAIL failed"
echo "══════════════════════════════════════════"
for r in "${RESULTS[@]}"; do echo "  $r"; done
echo ""

if [ "$FAIL" -gt 0 ]; then exit 1; fi
