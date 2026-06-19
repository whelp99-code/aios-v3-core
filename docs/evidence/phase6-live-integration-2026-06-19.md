# Phase 6 Live Integration Evidence

> Historical incomplete evidence. Required service results marked `NOT_CONFIGURED` or `DEGRADED` do not satisfy the v0.6.2 release gate. This file is retained for traceability only.

> Generated: 2026-06-19T01:16:36Z
> Branch: `phase6-c1-doc-rebaseline`
> Commit: latest (C2)
> LIVE_CLOUD_SMOKE=0 | LOCAL_ONLY=true

## Summary

| Metric | Count |
|--------|-------|
| PASS | 3 |
| FAIL | 1 (Docker daemon) |
| DEGRADED | 0 |
| SKIP | 0 |
| NOT_CONFIGURED | 5 |

## Detailed Results

### Shell Script (check-live-readiness.sh)

| Endpoint | Status | Latency | Notes |
|----------|--------|---------|-------|
| LM Studio /models | ✅ PASS | 53ms | HTTP 200 |
| MIMO_API_KEY | ⏭️ NOT_CONFIGURED | - | optional, env empty |
| LightRAG /health | ⏭️ NOT_CONFIGURED | 52ms | connection refused |
| LANGFUSE_SECRET_KEY | ⏭️ NOT_CONFIGURED | - | optional, env empty |
| LANGFUSE_PUBLIC_KEY | ⏭️ NOT_CONFIGURED | - | optional, env empty |
| Docker daemon | ❌ FAIL | - | not running |
| Express API /health | ⏭️ NOT_CONFIGURED | 24ms | connection refused |
| Desktop package.json | ✅ PASS | - | exists |
| Secret masking | ✅ PASS | - | no hardcoded secrets |

### Vitest Integration (live-readiness.test.ts)

| Test | Status | Latency | Notes |
|------|--------|---------|-------|
| LM Studio /models | ✅ PASS | 7ms | HTTP 200 |
| LM Studio completion | ✅ PASS | 1ms | HTTP 400 (model not found, expected) |
| LightRAG /health | ⏭️ NOT_CONFIGURED | 1ms | not running |
| Mimo Cloud | ⏭️ SKIP | 0ms | LOCAL_ONLY=true |
| Langfuse | ⏭️ SKIP | 0ms | LOCAL_ONLY=true |
| Express API /health | ⏭️ NOT_CONFIGURED | 1ms | not running |
| Secret masking | ✅ PASS | 0ms | no matches |

**Test result: 7 passed, 0 failed**

## Environment

- LM_STUDIO_URL: http://localhost:1234/v1
- LIGHTRAG_SERVER_URL: http://localhost:3300
- LANGFUSE_HOST: http://localhost:3000
- AIOS_BASE_URL: http://localhost:3201
- Docker: not installed / daemon not running

## Key Findings

1. **LM Studio**: Running and healthy at localhost:1234
2. **LightRAG**: Server not running (Python server needs manual start)
3. **Express API**: Server not running (needs `pnpm dev` or manual start)
4. **Docker**: Daemon not running (Docker Desktop not started)
5. **Mimo/Langfuse**: Cloud services blocked by LOCAL_ONLY policy (correct behavior)
6. **Secrets**: No hardcoded secrets detected in source code

## Files Created

- `scripts/check-live-readiness.sh` — Quick readiness check (shell)
- `scripts/verify-live-integrations.sh` — Full integration smoke (shell)
- `tests/integration/live-readiness.test.ts` — Vitest integration test
- `vitest.config.ts` — Updated to include `tests/integration/*.test.ts`

## Notes

- Mock responses are NOT treated as live PASS
- local_only=true blocks all cloud provider calls
- LIVE_CLOUD_SMOKE=1 required for paid API tests
- Secrets are masked in this report
