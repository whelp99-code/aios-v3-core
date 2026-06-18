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

export interface TraceContext {
  trace: any;
  span: any;
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
  metadata?: Record<string, any>;
}
