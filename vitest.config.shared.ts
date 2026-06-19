import path from 'node:path';
import { defineConfig } from 'vitest/config';

export function createVitestConfig(include: string[]) {
  return defineConfig({
    test: {
      globals: false,
      environment: 'node',
      include,
      testTimeout: 30_000,
      hookTimeout: 30_000,
      isolate: true,
      passWithNoTests: false,
      typecheck: { enabled: false },
      deps: { optimizer: { ssr: { include: ['vitest'] } } },
    },
    resolve: {
      alias: {
        '@aios/application': path.resolve(__dirname, 'packages/application/src'),
        '@aios/domain': path.resolve(__dirname, 'packages/domain/src'),
        '@aios/infrastructure': path.resolve(__dirname, 'packages/infrastructure/src'),
        '@aios/monitoring': path.resolve(__dirname, 'packages/monitoring/src'),
        '@aios/benchmark': path.resolve(__dirname, 'packages/benchmark/src'),
        '@aios/workflow': path.resolve(__dirname, 'packages/workflow/src'),
        '@aios/sandbox': path.resolve(__dirname, 'packages/sandbox/src'),
        '@aios/evolution': path.resolve(__dirname, 'packages/evolution/src'),
        '@aios/ag-ui': path.resolve(__dirname, 'packages/ag-ui/src'),
        '@aios/a2a': path.resolve(__dirname, 'packages/a2a/src'),
        '@aios/karpathy-loop': path.resolve(__dirname, 'packages/karpathy-loop/src'),
        '@aios/hyperagents': path.resolve(__dirname, 'packages/hyperagents/src'),
      },
    },
  });
}
