import type { EngineMode } from '@aios/ai-core';

/** Default runtime: local Rapid-MLX (not cloud APIs). Override with AIOS_ENGINE_MODE. */
export const DEFAULT_ENGINE_MODE: EngineMode =
  (process.env.AIOS_ENGINE_MODE as EngineMode | undefined) ?? 'local';

export const DEFAULT_SECURITY_LEVEL = (
  DEFAULT_ENGINE_MODE === 'local' ? 'local_only' : 'cloud_secure'
) as 'local_only' | 'cloud_secure';
