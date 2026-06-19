/**
 * LangfuseClient
 * Langfuse 연결 관리 및 폴백 로직
 */

import { LangfuseConfig } from './types.js';

export class LangfuseClient {
  private config: LangfuseConfig;
  private isHealthy: boolean = false;
  private traceIdCounter: number = 0;

  constructor(config: LangfuseConfig) {
    this.config = {
      flushAt: 10,
      flushInterval: 1000,
      ...config,
    };
    this.healthCheck();
  }

  private async healthCheck(): Promise<void> {
    try {
      const response = await fetch(`${this.config.baseUrl}/api/public/health`);
      this.isHealthy = response.ok;
      console.log('[Langfuse] 연결 성공');
    } catch {
      this.isHealthy = false;
      console.warn('[Langfuse] 연결 실패, 폴백 모드');
    }
  }

  /**
   * 트레이스 생성
   */
  createTrace(params: {
    name: string;
    input?: any;
    metadata?: Record<string, any>;
    userId?: string;
    sessionId?: string;
  }): any {
    if (!this.isHealthy) {
      return this.createMockTrace(params.name);
    }

    // 실제 Langfuse 호출 시 구현
    // const trace = this.langfuse.trace(params);
    return {
      id: `trace-${++this.traceIdCounter}`,
      name: params.name,
      input: params.input,
      metadata: params.metadata,
    };
  }

  /**
   * 스팬 생성
   */
  createSpan(trace: any, params: {
    name: string;
    input?: any;
    metadata?: Record<string, any>;
  }): any {
    if (!this.isHealthy) {
      return this.createMockSpan(params.name);
    }

    return {
      id: `span-${Date.now()}`,
      traceId: trace.id,
      name: params.name,
      input: params.input,
      metadata: params.metadata,
      end: (output?: any, metadata?: Record<string, any>) => {
        console.log(`[Span] ${params.name} 종료`, { output, metadata });
      },
    };
  }

  /**
   * 이벤트 생성
   */
  createEvent(trace: any, params: {
    name: string;
    input?: any;
    metadata?: Record<string, any>;
  }): void {
    if (!this.isHealthy) return;

    console.log(`[Event] ${params.name}`, params.input);
  }

  /**
   * 플러시
   */
  async flush(): Promise<void> {
    if (!this.isHealthy) return;
    // 실제 Langfuse 호출 시 구현
    await Promise.resolve();
  }

  /**
   * 연결 상태
   */
  get connected(): boolean {
    return this.isHealthy;
  }

  private createMockTrace(name: string): any {
    return {
      id: `mock-trace-${++this.traceIdCounter}`,
      name,
      span: (params: any) => this.createMockSpan(params.name),
      event: () => {},
      end: () => {},
    };
  }

  private createMockSpan(name: string): any {
    return {
      id: `mock-span-${Date.now()}`,
      name,
      end: () => {},
      update: () => {},
    };
  }
}
