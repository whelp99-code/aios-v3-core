import axios, { AxiosInstance } from 'axios';
import { ChatCompletionRequest, ChatCompletionResponse, ProviderHealth } from '../types';
import { ILLMProvider } from './base-provider';
import { withRetry } from '../retry';
import { streamOpenAICompatible } from './openai-stream';

export interface GoogleProviderConfig {
  apiKey?: string;
  /** Gemini OpenAI-compatible endpoint */
  baseURL?: string;
  timeout?: number;
}

const DEFAULT_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/openai/';

/**
 * Google Gemini via OpenAI-compatible chat/completions.
 * @see https://ai.google.dev/gemini-api/docs/openai
 */
export class GoogleProvider implements ILLMProvider {
  readonly provider = 'google' as const;
  private client: AxiosInstance | null = null;
  private apiKey: string;

  constructor(config: GoogleProviderConfig = {}) {
    this.apiKey =
      config.apiKey ??
      process.env.GEMINI_API_KEY ??
      process.env.GOOGLE_API_KEY ??
      '';
    if (this.apiKey) {
      this.client = axios.create({
        baseURL: config.baseURL ?? process.env.GEMINI_BASE_URL ?? DEFAULT_BASE_URL,
        timeout: config.timeout ?? 120000,
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
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
      return {
        provider: 'google',
        healthy: false,
        error: 'GEMINI_API_KEY or GOOGLE_API_KEY not configured',
      };
    }
    if (process.env.GOOGLE_SKIP_HEALTH_PING === '1' || process.env.GEMINI_SKIP_HEALTH_PING === '1') {
      return { provider: 'google', healthy: true, latencyMs: 0 };
    }
    const start = Date.now();
    try {
      await this.client!.post('/chat/completions', {
        model: 'gemini-2.5-flash',
        messages: [{ role: 'user', content: 'ping' }],
        max_tokens: 4,
      });
      return { provider: 'google', healthy: true, latencyMs: Date.now() - start };
    } catch (error) {
      return {
        provider: 'google',
        healthy: false,
        latencyMs: Date.now() - start,
        error: error instanceof Error ? error.message : 'Gemini unreachable',
      };
    }
  }

  async chatCompletion(request: ChatCompletionRequest): Promise<ChatCompletionResponse> {
    if (!this.client) throw new Error('Google Gemini provider not configured');
    const body: Record<string, unknown> = {
      model: request.model,
      messages: request.messages,
      stream: false,
      temperature: request.temperature,
    };
    if (request.max_tokens !== undefined) body.max_tokens = request.max_tokens;
    if (request.tools?.length) {
      body.tools = request.tools;
      body.tool_choice = request.tool_choice ?? 'auto';
    }
    return withRetry(async () => {
      const response = await this.client!.post<ChatCompletionResponse>('/chat/completions', body);
      return response.data;
    });
  }

  async *chatCompletionStream(request: ChatCompletionRequest): AsyncIterable<string> {
    if (!this.client) throw new Error('Google Gemini provider not configured');
    const body: Record<string, unknown> = {
      model: request.model,
      messages: request.messages,
      temperature: request.temperature,
    };
    if (request.max_tokens !== undefined) body.max_tokens = request.max_tokens;
    yield* streamOpenAICompatible(this.client, body);
  }

  async listModels(): Promise<{ id: string }[]> {
    return [
      { id: 'gemini-2.5-pro' },
      { id: 'gemini-2.5-flash' },
      { id: 'gemini-2.0-flash' },
      { id: 'gemini-3.5-flash' },
    ];
  }
}
