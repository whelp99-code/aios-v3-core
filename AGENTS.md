# AGENTS.md

## Primary work location: local Mac

**Default development happens on the local machine** (Apple Silicon Mac), not in Cursor Cloud.

| Location | Path / branch | Role |
|----------|---------------|------|
| **Local (primary)** | `/Users/jmpark/Documents/Playground/F - aios-v3-core` · `codex/phase5-review-hardening` | Day-to-day coding, `pnpm install`, Rapid-MLX / LM Studio |
| **GitHub (source of truth)** | `origin/codex/phase5-review-hardening` @ `c1eeaaf` | Shared commits; push from local |
| **Cursor Cloud (optional)** | Linux VM clone | PR review, CI-like checks; not for MLX inference |

Cloud Agents should treat **local + pushed branch** as authoritative. Do not commit `node_modules` or `.bin` shim path changes.

---

## Local setup (Mac)

```bash
cd "/Users/jmpark/Documents/Playground/F - aios-v3-core"
git checkout codex/phase5-review-hardening
git pull origin codex/phase5-review-hardening
pnpm install
cp -n .env.example .env   # edit API keys as needed
```

### Start dev stack

```bash
./scripts/local-dev.sh
```

Or manually:

```bash
pnpm dev                    # web :3000 + server :3201
pnpm desktop                # optional Electron (web must be up)
```

### AI backends (pick one)

1. **Rapid-MLX** (recommended on Mac) — see `RAPID_MLX_SETUP.md`
2. **LM Studio** — set `LM_STUDIO_URL` in `.env` (default `http://localhost:1234/v1`)
3. **Mock** — `python mock_server.py` on port 8000 for smoke tests without MLX

---

## Standard commands (repo root)

| Task | Command |
|------|---------|
| Install | `pnpm install` |
| Dev | `pnpm dev` |
| Typecheck | `pnpm typecheck` |
| Test | `pnpm test` |
| Verify | `pnpm verify` |
| Desktop | `pnpm desktop` |

---

## Git workflow (local-first)

1. Work on `codex/phase5-review-hardening` (or feature branch off it).
2. Commit **source** only — never `node_modules/`.
3. `git push origin <branch>` before asking Cloud Agent to review or open PR.
4. Ignore `node_modules/.bin/*` diffs after `pnpm install`; they are machine-specific shims.

### Sync check

```bash
git branch --show-current
git log -1 --oneline
git status --short
git rev-parse HEAD origin/codex/phase5-review-hardening
```

All four should show `codex/phase5-review-hardening` and the same SHA when fully synced.

---

## Cursor Cloud limitations

- **No Rapid-MLX** on Linux — use `mock_server.py` or skip inference tests.
- Cloud workspace may lag local until you `git push`.
- Prefer opening Cloud tasks with: branch name, last commit SHA, and what to verify.
