import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: false,
    environment: 'node',
    include: [
      'packages/*/tests/*.test.ts',
      'server/src/**/__tests__/*.test.ts',
      'server/tests/*.test.ts',
      'tests/integration/*.test.ts',
      'tests/e2e/*.test.ts',
    ],
    testTimeout: 30_000,
    hookTimeout: 10_000,
    isolate: true,
    passWithNoTests: false,
    typecheck: {
      enabled: false,
    },
    deps: {
      optimizer: {
        ssr: {
          include: ['vitest'],
        },
      },
    },
  },
  resolve: {
    alias: {
      // Each package resolves to its own src
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
