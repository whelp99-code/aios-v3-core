# Phase 6 release evidence correction

**Corrected**: 2026-06-19
**Affected release**: `v0.6.1`
**Status**: Incomplete release evidence; not a valid production-readiness record

## Invalidated claims

The previous version of this document claimed release readiness based on a stale test total and mock-only lifecycle coverage. Those claims are withdrawn because the validation did not prove:

- Portal Bridge response compatibility through the runtime adapter;
- PostgreSQL migrations and Prisma repositories;
- API authentication principal propagation;
- approval authorization, concurrent decision safety, and unique outbox creation;
- a real Portal Bridge fixture → API → PostgreSQL E2E path;
- required live services failing on `NOT_CONFIGURED` or `DEGRADED`.

The historical `v0.6.1` tag and files are retained. They are not moved or deleted.

## Replacement evidence

The corrective work is split into three stacked draft pull requests:

1. `codex/v0.6.2-core-correction`
2. `codex/v0.6.2-lifecycle-persistence`
3. `codex/v0.6.2-release-validation`

Current validation results and remaining gates are recorded in `docs/evidence/v0.6.2-release-validation.md`.
