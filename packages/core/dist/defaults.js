"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_SECURITY_LEVEL = exports.DEFAULT_ENGINE_MODE = void 0;
/** Default runtime: local Rapid-MLX (not cloud APIs). Override with AIOS_ENGINE_MODE. */
exports.DEFAULT_ENGINE_MODE = process.env.AIOS_ENGINE_MODE ?? 'local';
exports.DEFAULT_SECURITY_LEVEL = (exports.DEFAULT_ENGINE_MODE === 'local' ? 'local_only' : 'cloud_secure');
//# sourceMappingURL=defaults.js.map