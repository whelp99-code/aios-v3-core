export interface RetryOptions {
  retries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  /** Decide if an error is retryable. Defaults to network + 429 + 5xx. */
  isRetryable?: (error: unknown) => boolean;
  onRetry?: (attempt: number, delayMs: number, error: unknown) => void;
}

function statusOf(error: unknown): number | undefined {
  if (typeof error === 'object' && error) {
    const e = error as { response?: { status?: number }; status?: number };
    return e.response?.status ?? e.status;
  }
  return undefined;
}

function codeOf(error: unknown): string | undefined {
  if (typeof error === 'object' && error) {
    return (error as { code?: string }).code;
  }
  return undefined;
}

/** Default: retry on transient network errors, 408, 429, and 5xx. */
export function defaultIsRetryable(error: unknown): boolean {
  const status = statusOf(error);
  if (status !== undefined) {
    return status === 408 || status === 429 || (status >= 500 && status <= 599);
  }
  const code = codeOf(error);
  return (
    code === 'ECONNRESET' ||
    code === 'ETIMEDOUT' ||
    code === 'ECONNABORTED' ||
    code === 'ENOTFOUND' ||
    code === 'EAI_AGAIN'
  );
}

/** Honor Retry-After header (seconds or HTTP date) when present. */
function retryAfterMs(error: unknown): number | undefined {
  if (typeof error === 'object' && error) {
    const headers = (error as { response?: { headers?: Record<string, string> } }).response?.headers;
    const raw = headers?.['retry-after'] ?? headers?.['Retry-After'];
    if (raw) {
      const secs = Number(raw);
      if (!Number.isNaN(secs)) return secs * 1000;
      const date = Date.parse(raw);
      if (!Number.isNaN(date)) return Math.max(0, date - Date.now());
    }
  }
  return undefined;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Run an async function with exponential backoff + jitter.
 * Retries transient failures (network, 429, 5xx) and respects Retry-After.
 */
export async function withRetry<T>(fn: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const retries = options.retries ?? 3;
  const baseDelay = options.baseDelayMs ?? 500;
  const maxDelay = options.maxDelayMs ?? 8000;
  const isRetryable = options.isRetryable ?? defaultIsRetryable;

  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt === retries || !isRetryable(error)) break;

      const expDelay = Math.min(maxDelay, baseDelay * 2 ** attempt);
      const jitter = Math.random() * expDelay * 0.25;
      const delay = retryAfterMs(error) ?? expDelay + jitter;

      options.onRetry?.(attempt + 1, delay, error);
      await sleep(delay);
    }
  }
  throw lastError;
}
