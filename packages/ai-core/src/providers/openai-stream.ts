import { AxiosInstance } from 'axios';

/**
 * Stream content deltas from an OpenAI-compatible /chat/completions SSE endpoint.
 * Yields incremental text chunks (choices[0].delta.content).
 */
export async function* streamOpenAICompatible(
  client: AxiosInstance,
  body: Record<string, unknown>,
  path = '/chat/completions'
): AsyncGenerator<string> {
  const response = await client.post(path, { ...body, stream: true }, { responseType: 'stream' });
  const stream = response.data as NodeJS.ReadableStream;

  let buffer = '';
  for await (const chunk of stream) {
    buffer += chunk.toString('utf-8');
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.startsWith('data:')) continue;
      const payload = trimmed.slice(5).trim();
      if (payload === '[DONE]') return;
      try {
        const parsed = JSON.parse(payload);
        const delta = parsed?.choices?.[0]?.delta?.content;
        if (typeof delta === 'string' && delta.length) yield delta;
      } catch {
        // Ignore keep-alive / non-JSON lines
      }
    }
  }
}
