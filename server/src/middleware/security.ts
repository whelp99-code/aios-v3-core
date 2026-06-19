/**
 * F-aios-v3 Security Middleware
 *
 * Phase 1: Security and execution stability
 * - Zod request validation
 * - Rate limiting
 * - Restricted CORS
 * - Request size limit
 * - Trace ID injection
 */

import type { Request, Response, NextFunction } from 'express';
import { z, type ZodSchema } from 'zod';

// ──────────────────────────────────────────────
// Rate Limiter (in-memory, per-IP)
// ──────────────────────────────────────────────

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

export function createRateLimit({ windowMs = 60_000, max = 100 } = {}) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    const entry = rateLimitStore.get(ip);

    if (!entry || now > entry.resetAt) {
      rateLimitStore.set(ip, { count: 1, resetAt: now + windowMs });
      next();
      return;
    }

    entry.count++;
    if (entry.count > max) {
      res.status(429).json({
        error: 'Too many requests',
        retryAfter: Math.ceil((entry.resetAt - now) / 1000),
      });
      return;
    }

    next();
  };
}

// ──────────────────────────────────────────────
// Zod Request Validation Middleware
// ──────────────────────────────────────────────

export function validateBody<T>(schema: ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json({
        error: 'Validation failed',
        details: result.error.issues.map(i => ({
          path: i.path.join('.'),
          message: i.message,
        })),
      });
      return;
    }
    req.body = result.data;
    next();
  };
}

export function validateQuery<T>(schema: ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      res.status(400).json({
        error: 'Query validation failed',
        details: result.error.issues.map(i => ({
          path: i.path.join('.'),
          message: i.message,
        })),
      });
      return;
    }
    req.validatedQuery = result.data;
    next();
  };
}

// ──────────────────────────────────────────────
// Trace ID Injection
// ──────────────────────────────────────────────

export function traceIdMiddleware(req: Request, _res: Response, next: NextFunction): void {
  const traceId = (req.headers['x-trace-id'] as string) || `trace-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  req.traceId = traceId;
  next();
}

// ──────────────────────────────────────────────
// CORS Configuration
// ──────────────────────────────────────────────

export function createCorsOptions() {
  const allowedOrigins = (process.env.CORS_ORIGINS || 'http://localhost:3000,http://localhost:3200,http://localhost:3201')
    .split(',')
    .map(s => s.trim());

  return {
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      // Allow requests with no origin (same-origin, curl, etc.)
      if (!origin) {
        callback(null, true);
        return;
      }
      if (allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
        callback(null, true);
      } else {
        callback(new Error(`CORS: origin ${origin} not allowed`));
      }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'X-API-Key', 'X-Trace-Id', 'Idempotency-Key', 'X-Request-Id'],
    maxAge: 86400,
  };
}

// ──────────────────────────────────────────────
// Idempotency Middleware
// ──────────────────────────────────────────────

const idempotencyStore = new Map<string, { response: unknown; status: number; createdAt: number }>();

// Cleanup old entries every 10 minutes
const idempotencyCleanupTimer = setInterval(() => {
  const cutoff = Date.now() - 10 * 60 * 1000;
  for (const [key, entry] of idempotencyStore) {
    if (entry.createdAt < cutoff) {
      idempotencyStore.delete(key);
    }
  }
}, 10 * 60 * 1000);
idempotencyCleanupTimer.unref();

export function idempotencyMiddleware(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers['idempotency-key'] as string | undefined;
  const isMutation = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method);
  if (!header || !isMutation) {
    next();
    return;
  }

  const key = `${req.method}:${req.path}:${header}`;

  const existing = idempotencyStore.get(key);
  if (existing) {
    res.status(existing.status).json(existing.response);
    return;
  }

  // Store original json method to capture response
  const originalJson = res.json.bind(res);
  res.json = function (body: unknown) {
    idempotencyStore.set(key, {
      response: body,
      status: res.statusCode,
      createdAt: Date.now(),
    });
    return originalJson(body);
  };

  next();
}

// ──────────────────────────────────────────────
// Simulated Result Wrapper
// ──────────────────────────────────────────────

/**
 * Wraps a result as simulated/degraded instead of success.
 * Used when the actual service (LightRAG, MCP, etc.) is unavailable.
 */
export function simulatedResult(data: unknown, reason: string) {
  return {
    ...((typeof data === 'object' && data !== null) ? data : { data }),
    status: 'degraded' as const,
    mode: 'simulated' as const,
    message: reason,
  };
}
