/**
 * 타입 정의
 */

export interface LangfuseConfig {
  publicKey: string;
  secretKey: string;
  baseUrl: string;
  flushAt?: number;
  flushInterval?: number;
}

/** Langfuse 트레이스 인터페이스 */
export interface LangfuseTrace {
  id: string;
  name: string;
  input?: unknown;
  metadata?: Record<string, unknown>;
  span: (params: { name: string; input?: unknown; metadata?: Record<string, unknown> }) => LangfuseSpan;
  event: (params: { name: string; input?: unknown; metadata?: Record<string, unknown> }) => void;
  end: (output?: unknown, metadata?: Record<string, unknown>) => void;
}

/** Langfuse 스팬 인터페이스 */
export interface LangfuseSpan {
  id: string;
  traceId?: string;
  name: string;
  input?: unknown;
  metadata?: Record<string, unknown>;
  end: (output?: unknown, metadata?: Record<string, unknown>) => void;
  update: (data: Record<string, unknown>) => void;
}

export interface TraceContext {
  trace: LangfuseTrace;
  span: LangfuseSpan;
}

export interface TokenUsage {
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  costUSD: number;
  costKRW: number;
  timestamp: Date;
}

export interface AlertConfig {
  enabled: boolean;
  errorThreshold?: number;    // 에러율 임계값 (%)
  latencyThreshold?: number;  // 지연 시간 임계값 (ms)
  costThreshold?: number;     // 비용 임계값 (KRW)
}

export interface Alert {
  id: string;
  type: 'error' | 'latency' | 'cost';
  message: string;
  severity: 'low' | 'medium' | 'high';
  timestamp: Date;
  metadata?: Record<string, unknown>;
}
