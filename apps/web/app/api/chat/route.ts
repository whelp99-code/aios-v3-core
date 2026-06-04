import { NextRequest, NextResponse } from 'next/server';
import { getAIOS } from '@/lib/aios';
import type { AgentRole, TaskType } from '@aios/ai-core';

const VALID_ROLES: AgentRole[] = [
  'planner',
  'executor',
  'critic',
  'knowledge_updater',
  'self_corrector',
];
const VALID_TASKS: TaskType[] = ['chat', 'code', 'reasoning', 'embedding'];

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { messages, tools, stream } = body;

    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: 'messages is required' }, { status: 400 });
    }

    const role: AgentRole = VALID_ROLES.includes(body.role) ? body.role : 'executor';
    const taskType: TaskType = VALID_TASKS.includes(body.taskType) ? body.taskType : 'chat';

    const router = getAIOS().dynamicRouter;

    // Tool calls require the non-streaming tool-aware path.
    if (Array.isArray(tools) && tools.length > 0) {
      const { message, routing } = await router.routeAndChatWithTools(
        role,
        taskType,
        messages,
        tools
      );
      return NextResponse.json({
        choices: [{ index: 0, message, finish_reason: 'stop' }],
        provider: routing.provider,
        model: routing.modelId,
        routingReason: routing.reason,
      });
    }

    if (stream) {
      const encoder = new TextEncoder();
      const sse = new ReadableStream({
        async start(controller) {
          const send = (data: unknown) =>
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
          try {
            const generator = router.routeAndStream(role, taskType, messages);
            let next = await generator.next();
            while (!next.done) {
              send({ delta: next.value });
              next = await generator.next();
            }
            const routing = next.value;
            send({ done: true, provider: routing.provider, model: routing.modelId });
          } catch (error) {
            const message = error instanceof Error ? error.message : 'Stream failed';
            send({ error: message });
          } finally {
            controller.enqueue(encoder.encode('data: [DONE]\n\n'));
            controller.close();
          }
        },
      });

      return new Response(sse, {
        headers: {
          'Content-Type': 'text/event-stream; charset=utf-8',
          'Cache-Control': 'no-cache, no-transform',
          Connection: 'keep-alive',
        },
      });
    }

    const { content, routing } = await router.routeAndChat(role, taskType, messages);
    return NextResponse.json({
      choices: [{ index: 0, message: { role: 'assistant', content }, finish_reason: 'stop' }],
      provider: routing.provider,
      model: routing.modelId,
      routingReason: routing.reason,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to process chat request';
    console.error('Chat API error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
