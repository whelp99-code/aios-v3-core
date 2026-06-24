import axios, { AxiosInstance } from 'axios';
import { ChatCompletionRequest, ChatCompletionResponse, ChatMessage, ProviderHealth } from '../types';
import { ILLMProvider } from './base-provider';

export interface AnthropicProviderConfig {
  apiKey?: string;
  baseURL?: string;
  timeout?: number;
}

export class AnthropicProvider implements ILLMProvider {
  readonly provider = 'anthropic' as const;
  private client: AxiosInstance | null = null;
  private apiKey: string;

  constructor(config: AnthropicProviderConfig = {}) {
    this.apiKey = config.apiKey ?? process.env.ANTHROPIC_API_KEY ?? '';
    if (this.apiKey) {
      this.client = axios.create({
        baseURL: config.baseURL ?? 'https://api.anthropic.com/v1',
        timeout: config.timeout ?? 60000,
        headers: {
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json',
        },
      });
    }
  }

  isConfigured(): boolean {
    return Boolean(this.apiKey && this.client);
  }

  async healthCheck(): Promise<ProviderHealth> {
    if (!this.isConfigured()) {
      return { provider: 'anthropic', healthy: false, error: 'ANTHROPIC_API_KEY not configured' };
    }
    return { provider: 'anthropic', healthy: true, latencyMs: 0 };
  }

  async chatCompletion(request: ChatCompletionRequest): Promise<ChatCompletionResponse> {
    if (!this.client) throw new Error('Anthropic provider not configured');

    const systemMsg = request.messages.find((m) => m.role === 'system');
    const nonSystem = request.messages.filter((m) => m.role !== 'system');

    const response = await this.client.post<{
      id: string;
      model: string;
      content: Array<{ type: string; text: string }>;
      usage: { input_tokens: number; output_tokens: number };
    }>('/messages', {
      model: request.model,
      max_tokens: request.max_tokens ?? 4096,
      system: systemMsg?.content,
      messages: nonSystem.map((m: ChatMessage) => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content,
      })),
    });

    const text = response.data.content.map((c) => c.text).join('\\n');
    return {
      id: response.data.id,
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: response.data.model,
      choices: [
        {
          index: 0,
          message: { role: 'assistant', content: text },
        },
      ],
      usage: {
        prompt_tokens: response.data.usage.input_tokens,
        completion_tokens: response.data.usage.output_tokens,
        total_tokens: response.data.usage.input_tokens + response.data.usage.output_tokens,
      },
    } as any;
  }

  async listModels(): Promise<{ id: string }[]> {
    return [
      { id: 'claude-3-5-haiku-20241022' },
      { id: 'claude-3-5-sonnet-20241022' },
    ];
  }
}
