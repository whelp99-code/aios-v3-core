/**
 * Logging Contract
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface Logger {
  debug(message: string, meta?: Record<string, unknown>): void;
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
}

/** Console logger implementation */
export class ConsoleLogger implements Logger {
  constructor(private context: string) {}

  debug(message: string, meta?: Record<string, unknown>): void {
    console.debug(`[${this.context}] ${message}`, meta);
  }

  info(message: string, meta?: Record<string, unknown>): void {
    console.log(`[${this.context}] ${message}`, meta);
  }

  warn(message: string, meta?: Record<string, unknown>): void {
    console.warn(`[${this.context}] ${message}`, meta);
  }

  error(message: string, meta?: Record<string, unknown>): void {
    console.error(`[${this.context}] ${message}`, meta);
  }
}

/** No-op logger for testing */
export class NullLogger implements Logger {
  debug(): void {}
  info(): void {}
  warn(): void {}
  error(): void {}
}
