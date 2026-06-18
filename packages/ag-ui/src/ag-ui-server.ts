/**
 * AGUIServer - Server-side AG-UI protocol implementation
 *
 * Creates SSE ReadableStreams for real-time UI streaming.
 * Designed for Next.js App Router route handlers (POST → NextResponse with SSE headers).
 */

import type {
  AGUIEvent,
  AGUIServerConfig,
  AGUIState,
} from './types.js';
import { EventBuilder, formatSSE, formatSSEComment } from './event-builder.js';

export type TaskExecutor = (input: string, sendEvent: (event: AGUIEvent) => void) => Promise<string>;

export interface PipelineStep {
  name: 'planner' | 'executor' | 'critic';
  execute: (
    input: string,
    context: AGUIState,
    sendEvent: (event: AGUIEvent) => void,
  ) => Promise<{ output: string; nextAction: 'continue' | 'revise' | 'done' | 'fail' }>;
}

export class AGUIServer {
  private config: Required<AGUIServerConfig>;

  constructor(config: AGUIServerConfig = {}) {
    this.config = {
      basePath: config.basePath ?? '/api/ag-ui',
      headers: config.headers ?? {},
      maxReconnectAttempts: config.maxReconnectAttempts ?? 5,
      heartbeatInterval: config.heartbeatInterval ?? 30_000,
    };
  }

  /**
   * Create an SSE ReadableStream that sends AG-UI events.
   *
   * Usage in a Next.js App Router route handler:
   *
   * ```ts
   * // app/api/ag-ui/route.ts
   * import { AGUIServer } from '@aios/ag-ui';
   *
   * const server = new AGUIServer();
   *
   * export async function POST(req: Request) {
   *   return server.handleRequest(req, async (input, sendEvent) => {
   *     // Your AI pipeline here
   *     sendEvent({ type: 'TEXT_MESSAGE_START', ... });
   *     sendEvent({ type: 'TEXT_MESSAGE_CONTENT', content: 'Hello!' });
   *     sendEvent({ type: 'TEXT_MESSAGE_END', ... });
   *     return 'done';
   *   });
   * }
   * ```
   */
  async handleRequest(
    req: Request,
    executor: TaskExecutor,
  ): Promise<Response> {
    const body = await req.json().catch(() => ({}));
    const input = (body as Record<string, unknown>).input as string ?? '';

    const stream = this.createEventStream(input, executor);

    return new Response(stream, {
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no', // Disable nginx buffering
        ...this.config.headers,
      },
    });
  }

  /**
   * Create an SSE ReadableStream from a task executor function.
   */
  createEventStream(
    input: string,
    executor: TaskExecutor,
  ): ReadableStream<Uint8Array> {
    const encoder = new TextEncoder();
    let heartbeatTimer: ReturnType<typeof setInterval> | undefined;

    return new ReadableStream({
      start: async (controller) => {
        const taskId = EventBuilder.generateId('task');
        const sendEvent = (event: AGUIEvent) => {
          try {
            controller.enqueue(encoder.encode(formatSSE(event)));
          } catch {
            // Stream may be closed
          }
        };

        // Start heartbeat if configured
        if (this.config.heartbeatInterval > 0) {
          heartbeatTimer = setInterval(() => {
            try {
              controller.enqueue(
                encoder.encode(formatSSEComment('heartbeat')),
              );
            } catch {
              // Stream closed
            }
          }, this.config.heartbeatInterval);
        }

        try {
          sendEvent(EventBuilder.taskStarted(taskId, input));
          const result = await executor(input, sendEvent);
          sendEvent(EventBuilder.taskCompleted(taskId, result, Date.now()));
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          sendEvent(EventBuilder.taskFailed(taskId, message));
        } finally {
          if (heartbeatTimer) clearInterval(heartbeatTimer);
          try {
            controller.close();
          } catch {
            // Already closed
          }
        }
      },

      cancel: () => {
        if (heartbeatTimer) clearInterval(heartbeatTimer);
      },
    });
  }

  /**
   * Execute a planner → executor → critic pipeline with SSE streaming.
   *
   * This is a higher-level helper that runs a multi-phase pipeline
   * and streams all phase events to the client.
   */
  async handlePipelineRequest(
    req: Request,
    steps: {
      planner: PipelineStep['execute'];
      executor: PipelineStep['execute'];
      critic: PipelineStep['execute'];
    },
    maxIterations = 3,
  ): Promise<Response> {
    const body = await req.json().catch(() => ({}));
    const input = (body as Record<string, unknown>).input as string ?? '';

    const stream = this.createPipelineStream(input, steps, maxIterations);

    return new Response(stream, {
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
        ...this.config.headers,
      },
    });
  }

  /**
   * Create a pipeline SSE stream (planner → executor → critic loop).
   */
  private createPipelineStream(
    input: string,
    steps: {
      planner: PipelineStep['execute'];
      executor: PipelineStep['execute'];
      critic: PipelineStep['execute'];
    },
    maxIterations: number,
  ): ReadableStream<Uint8Array> {
    const encoder = new TextEncoder();
    let heartbeatTimer: ReturnType<typeof setInterval> | undefined;

    return new ReadableStream({
      start: async (controller) => {
        const taskId = EventBuilder.generateId('task');
        const sendEvent = (event: AGUIEvent) => {
          try {
            controller.enqueue(encoder.encode(formatSSE(event)));
          } catch {
            // Stream closed
          }
        };

        if (this.config.heartbeatInterval > 0) {
          heartbeatTimer = setInterval(() => {
            try {
              controller.enqueue(encoder.encode(formatSSEComment('heartbeat')));
            } catch {
              // Stream closed
            }
          }, this.config.heartbeatInterval);
        }

        const state: AGUIState = {
          taskId,
          status: 'planning',
          messages: [],
          toolCalls: [],
          pipeline: { planner: [], executor: [], critic: null },
          metadata: {},
          version: 0,
        };

        try {
          sendEvent(EventBuilder.taskStarted(taskId, input));

          let iteration = 0;
          let currentInput = input;
          let finalOutput = '';

          while (iteration < maxIterations) {
            iteration++;
            state.version++;

            // ── Planner Phase ───────────────────────────────
            state.status = 'planning';
            sendEvent({
              type: 'STATE_UPDATE',
              stateId: taskId,
              patch: { status: 'planning' },
              version: state.version,
              timestamp: Date.now(),
            });

            const plannerResult = await steps.planner(currentInput, state, sendEvent);
            state.pipeline.planner.push(plannerResult.output);
            sendEvent(EventBuilder.plannerOutput(taskId, state.pipeline.planner, plannerResult.output));

            if (plannerResult.nextAction === 'done') {
              finalOutput = plannerResult.output;
              break;
            }

            // ── Executor Phase ──────────────────────────────
            state.status = 'executing';
            sendEvent({
              type: 'STATE_UPDATE',
              stateId: taskId,
              patch: { status: 'executing' },
              version: state.version,
              timestamp: Date.now(),
            });

            const executorResult = await steps.executor(plannerResult.output, state, sendEvent);
            state.pipeline.executor.push({ step: iteration, result: executorResult.output });
            sendEvent(EventBuilder.executorOutput(taskId, iteration, executorResult.output));

            currentInput = executorResult.output;

            // ── Critic Phase ────────────────────────────────
            state.status = 'critiquing';
            sendEvent({
              type: 'STATE_UPDATE',
              stateId: taskId,
              patch: { status: 'critiquing' },
              version: state.version,
              timestamp: Date.now(),
            });

            const criticResult = await steps.critic(executorResult.output, state, sendEvent);
            state.pipeline.critic = {
              assessment: criticResult.nextAction,
              feedback: criticResult.output,
            };
            sendEvent(EventBuilder.criticOutput(
              taskId,
              criticResult.nextAction === 'done' ? 'pass' : criticResult.nextAction === 'continue' ? 'revise' : 'fail',
              criticResult.output,
            ));

            if (criticResult.nextAction === 'done') {
              finalOutput = executorResult.output;
              break;
            }

            if (criticResult.nextAction === 'fail') {
              throw new Error(`Critic rejected output: ${criticResult.output}`);
            }

            // Prepare next iteration with critic feedback
            currentInput = `${currentInput}\n\n--- Critic Feedback ---\n${criticResult.output}\n\nPlease revise based on the feedback.`;
          }

          state.status = 'completed';
          sendEvent({
            type: 'STATE_UPDATE',
            stateId: taskId,
            patch: { status: 'completed' },
            version: state.version + 1,
            timestamp: Date.now(),
          });

          sendEvent(EventBuilder.taskCompleted(taskId, finalOutput, Date.now()));
        } catch (error) {
          state.status = 'failed';
          const message = error instanceof Error ? error.message : String(error);
          sendEvent(EventBuilder.taskFailed(taskId, message));
        } finally {
          if (heartbeatTimer) clearInterval(heartbeatTimer);
          try {
            controller.close();
          } catch {
            // Already closed
          }
        }
      },

      cancel: () => {
        if (heartbeatTimer) clearInterval(heartbeatTimer);
      },
    });
  }
}
