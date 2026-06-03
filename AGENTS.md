# AGENTS.md

## Cursor Cloud specific instructions

### Product overview

AIOS v3 Core is a pnpm monorepo: **Next.js Command Center** (`apps/web`), optional **Electron desktop** (`apps/desktop`), and libraries `packages/ai-core` and `packages/orchestrator`. End-to-end chat requires the web app plus an OpenAI-compatible **Rapid-MLX** server (default `http://localhost:8000/v1`). See `PROJECT_SETUP.md` and `RAPID_MLX_SETUP.md` for product context.

### Standard commands (repo root)

| Task | Command |
|------|---------|
| Install | `pnpm install` |
| Dev (web) | `pnpm dev` → http://localhost:3000 |
| Lint (web only) | `pnpm --filter web lint` |
| Build web | `pnpm --filter web build` |
| Build ai-core | `pnpm --filter @aios/ai-core build` |
| Desktop dev | `pnpm desktop` (needs web on :3000; Electron) |

There are **no automated test scripts** in `package.json` today; verify with `/api/health`, `/api/chat`, and the UI chat.

### Linux / Cloud Agent: Rapid-MLX substitute

Real **Rapid-MLX** targets macOS Apple Silicon and is **not** available on typical Linux cloud VMs. For API and UI E2E without MLX, run a minimal OpenAI-compatible mock on port 8000 before `pnpm dev`:

```bash
# In a dedicated terminal or tmux session (mock-rapid-mlx)
node --input-type=module -e "
import http from 'http';
const server = http.createServer((req, res) => {
  const url = new URL(req.url || '/', 'http://localhost');
  if (req.method === 'GET' && url.pathname === '/v1/models') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ data: [{ id: 'qwen3.5-9b-4bit', object: 'model' }] }));
    return;
  }
  if (req.method === 'POST' && url.pathname === '/v1/chat/completions') {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      const parsed = JSON.parse(body || '{}');
      const msgs = parsed.messages || [];
      const last = msgs[msgs.length - 1]?.content || 'hello';
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        id: 'chatcmpl-mock',
        object: 'chat.completion',
        model: parsed.model || 'qwen3.5-9b-4bit',
        choices: [{ index: 0, message: { role: 'assistant', content: 'Mock Rapid-MLX reply: ' + last }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 5, completion_tokens: 8, total_tokens: 13 }
      }));
    });
    return;
  }
  res.writeHead(404); res.end('not found');
});
server.listen(8000, () => console.log('Mock Rapid-MLX on http://localhost:8000/v1'));
"
```

Then start the web app (`pnpm dev`) and confirm `curl http://localhost:3000/api/health` returns `"status":"healthy"`.

Optional env overrides: `RAPID_MLX_BASE_URL`, `RAPID_MLX_MODEL` (used by `apps/web/app/api/*`).

### Gotchas

- **Node.js ≥ 22** is required (`package.json` `engines`).
- **`apps/web` must declare `axios`** (API routes import it). If `next build` fails with "Can't resolve 'axios'", run `pnpm add axios --filter web`.
- **pnpm ignored build scripts** for `electron`, `sharp`, and `unrs-resolver` after install. Do **not** run interactive `pnpm approve-builds` in automation. Desktop/Electron packaging may be incomplete until those scripts are allowed; web dev does not need them.
- **Duplicate lockfile warning**: `apps/web/pnpm-workspace.yaml` triggers a Next.js turbopack root warning; harmless for dev.
- **ESLint** may report pre-existing `@typescript-eslint/no-explicit-any` issues in `apps/web`; lint is not clean until those are fixed.
- **Orchestrator** is a library with placeholder graph nodes—not wired to the web UI for current E2E.

### Services to run for full web chat E2E

1. Mock or real Rapid-MLX on **:8000** (`/v1/models`, `/v1/chat/completions`)
2. **Next.js** on **:3000** (`pnpm dev`)

Desktop (`pnpm desktop`) is optional and depends on Electron + web.
