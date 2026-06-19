import { createVitestConfig } from './vitest.config.shared';

export default createVitestConfig([
  'packages/*/tests/*.test.ts',
  'server/src/**/__tests__/*.test.ts',
  'server/tests/*.test.ts',
]);
