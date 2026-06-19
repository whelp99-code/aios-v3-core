/**
 * @aios/domain
 * Domain layer — pure business entities, value objects, and domain events.
 * NO external dependencies (no Prisma, no Express, no LLM SDKs).
 */

export * from './entities/index.js';
export * from './value-objects/index.js';
export * from './events/index.js';
export * from './mail/index.js';
export * from './customer/index.js';
export * from './project/index.js';
export * from './estimate/index.js';
export * from './proposal/index.js';
export * from './lifecycle/index.js';
