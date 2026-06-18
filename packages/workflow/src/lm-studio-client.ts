/**
 * LLM Studio Client
 * LM Studio API 클라이언트 (localhost:1234/v1)
 */

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatCompletionRequest {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  stop?: string | string[];
  stream?: boolean;
}

export interface ChatCompletionResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: {
    index: number;
    message: ChatMessage;
    finish_reason: string;
  }[];
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface ChatCompletionChunk {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: {
    index: number;
    delta: Partial<ChatMessage>;
    finish_reason: string | null;
  }[];
}

export interface LLMClientConfig {
  baseUrl?: string;
  timeout?: number;
  defaultModel?: string;
}

export class LLMClient {
  private baseUrl: string;
  private timeout: number;
  private defaultModel: string;

  constructor(config: LLMClientConfig = {}) {
    this.baseUrl = config.baseUrl ?? 'http://localhost:1234/v1';
    this.timeout = config.timeout ?? 60000;
    this.defaultModel = config.defaultModel ?? 'qwen/qwen3.5-9b';
  }

  /**
   * 채팅 완성 요청 전송
   */
  async chatCompletion(
    request: Omit<ChatCompletionRequest, 'model'> & { model?: string }
  ): Promise<ChatCompletionResponse> {
    const model = request.model ?? this.defaultModel;
    const url = `${this.baseUrl}/chat/completions`;

    const body: ChatCompletionRequest = {
      ...request,
      model,
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `LM Studio API error: ${response.status} ${response.statusText} - ${errorText}`
        );
      }

      const data = (await response.json()) as ChatCompletionResponse;
      return data;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`LM Studio request timeout after ${this.timeout}ms`);
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * 단일 메시지로 간편 채팅 요청
   */
  async chat(
    message: string,
    options: {
      model?: string;
      systemPrompt?: string;
      temperature?: number;
      maxTokens?: number;
    } = {}
  ): Promise<string> {
    const messages: ChatMessage[] = [];

    if (options.systemPrompt) {
      messages.push({ role: 'system', content: options.systemPrompt });
    }
    messages.push({ role: 'user', content: message });

    const response = await this.chatCompletion({
      model: options.model,
      messages,
      temperature: options.temperature,
      max_tokens: options.maxTokens,
    });

    return response.choices[0]?.message?.content ?? '';
  }

  /**
   * 스트리밍 채팅 완성 요청
   */
  async *chatCompletionStream(
    request: Omit<ChatCompletionRequest, 'model' | 'stream'> & { model?: string }
  ): AsyncGenerator<string, void, unknown> {
    const model = request.model ?? this.defaultModel;
    const url = `${this.baseUrl}/chat/completions`;

    const body: ChatCompletionRequest = {
      ...request,
      model,
      stream: true,
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `LM Studio API error: ${response.status} ${response.statusText} - ${errorText}`
        );
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body');
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith('data: ')) {
            const data = trimmed.slice(6);
            if (data === '[DONE]') return;

            try {
              const parsed = JSON.parse(data) as ChatCompletionChunk;
              const content = parsed.choices[0]?.delta?.content;
              if (content) {
                yield content;
              }
            } catch {
              // Skip malformed JSON
            }
          }
        }
      }
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * 사용 가능한 모델 목록 조회
   */
  async listModels(): Promise<string[]> {
    const url = `${this.baseUrl}/models`;

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to list models: ${response.status}`);
    }

    const data = (await response.json()) as {
      data: { id: string }[];
    };

    return data.data.map((m) => m.id);
  }

  /**
   * 연결 상태 확인
   */
  async healthCheck(): Promise<boolean> {
    try {
      const url = `${this.baseUrl.replace('/v1', '')}/v1/models`;
      const response = await fetch(url, { method: 'GET' });
      return response.ok;
    } catch {
      return false;
    }
  }
}

/**
 * 기본 LLMClient 인스턴스 생성
 */
export function createLLMClient(config?: LLMClientConfig): LLMClient {
  return new LLMClient(config);
}
