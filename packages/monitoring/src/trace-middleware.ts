/**
 * TraceMiddleware
 * 워크플로우 트레이싱 미들웨어
 */

import { LangfuseClient } from './langfuse-client.js';
import { TraceContext } from './types.js';

export class TraceMiddleware {
  constructor(private client: LangfuseClient) {}

  /**
   * 워크플로우 전체 트레이싱
   */
  async traceWorkflow<T>(
    name: string,
    input: any,
    fn: (ctx: TraceContext) => Promise<T>
  ): Promise<T> {
    const trace = this.client.createTrace({
      name,
      input,
      metadata: {
        version: process.env.APP_VERSION ?? 'unknown',
        environment: process.env.NODE_ENV ?? 'development',
      },
    });

    const ctx: TraceContext = {
      trace,
      span: this.client.createSpan(trace, { name: `${name}-root` }),
    };

    try {
      const result = await fn(ctx);
      ctx.span.end({ output: result });
      return result;
    } catch (error) {
      ctx.span.end({
        output: { error: String(error) },
        metadata: { level: 'ERROR' },
      });
      throw error;
    } finally {
      await this.client.flush();
    }
  }

  /**
   * 개별 스텝 트레이싱
   */
  async traceStep<T>(
    ctx: TraceContext,
    stepName: string,
    input: any,
    fn: () => Promise<T>
  ): Promise<T> {
    const childSpan = this.client.createSpan(ctx.trace, {
      name: stepName,
      input,
    });

    const startTime = Date.now();

    try {
      const result = await fn();
      childSpan.end({
        output: result,
        metadata: { durationMs: Date.now() - startTime },
      });
      return result;
    } catch (error) {
      childSpan.end({
        output: { error: String(error) },
        metadata: {
          durationMs: Date.now() - startTime,
          level: 'ERROR',
        },
      });
      throw error;
    }
  }

  /**
   * LLM 호출 트레이싱
   */
  async traceLLMCall<T>(
    ctx: TraceContext,
    params: {
      model: string;
      messages: any[];
      temperature?: number;
    },
    fn: () => Promise<T>
  ): Promise<T> {
    const span = this.client.createSpan(ctx.trace, {
      name: `llm-${params.model}`,
      input: {
        model: params.model,
        messageCount: params.messages.length,
        temperature: params.temperature,
      },
    });

    const startTime = Date.now();

    try {
      const result = await fn();
      span.end({
        output: result,
        metadata: {
          durationMs: Date.now() - startTime,
          model: params.model,
        },
      });
      return result;
    } catch (error) {
      span.end({
        output: { error: String(error) },
        metadata: { durationMs: Date.now() - startTime },
      });
      throw error;
    }
  }

  /**
   * MCP 도구 호출 트레이싱
   */
  async traceToolCall<T>(
    ctx: TraceContext,
    params: {
      toolName: string;
      arguments: any;
    },
    fn: () => Promise<T>
  ): Promise<T> {
    const span = this.client.createSpan(ctx.trace, {
      name: `tool-${params.toolName}`,
      input: params.arguments,
    });

    const startTime = Date.now();

    try {
      const result = await fn();
      span.end({
        output: result,
        metadata: { durationMs: Date.now() - startTime },
      });
      return result;
    } catch (error) {
      span.end({
        output: { error: String(error) },
        metadata: { durationMs: Date.now() - startTime },
      });
      throw error;
    }
  }
}
