/**
 * LLMAdapter
 * Thin adapter for LLM inference (LM Studio, Mimo, etc.)
 * Respects LOCAL_ONLY policy.
 */

export type LLMProvider = 'lmstudio' | 'mimo' | 'gemini';

export interface LLMAdapterConfig {
  provider: LLMProvider;
  baseUrl: string;
  model: string;
  apiKey?: string;
  localOnly?: boolean;
}

export interface LLMCompletionRequest {
  messages: Array<{ role: string; content: string }>;
  temperature?: number;
  maxTokens?: number;
}

export interface LLMCompletionResponse {
  content: string;
  model: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export class LLMAdapter {
  private config: LLMAdapterConfig;

  constructor(config: LLMAdapterConfig) {
    this.config = {
      localOnly: true,
      ...config,
    };
  }

  /**
   * Get a completion from the LLM
   */
  async complete(request: LLMCompletionRequest): Promise<LLMCompletionResponse> {
    // Block cloud providers when local_only
    if (this.config.localOnly && this.config.provider !== 'lmstudio') {
      throw new Error(
        `Cloud provider ${this.config.provider} blocked by LOCAL_ONLY policy. ` +
        `Set LIVE_CLOUD_SMOKE=1 to enable.`
      );
    }

    const response = await fetch(`${this.config.baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(this.config.apiKey ? { 'Authorization': `Bearer ${this.config.apiKey}` } : {}),
      },
      body: JSON.stringify({
        model: this.config.model,
        messages: request.messages,
        temperature: request.temperature ?? 0.7,
        max_tokens: request.maxTokens ?? 1024,
      }),
    });

    if (!response.ok) {
      throw new Error(`LLM API error: ${response.status}`);
    }

    const data = await response.json() as {
      choices: Array<{ message: { content: string } }>;
      usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
      model: string;
    };

    return {
      content: data.choices[0]?.message?.content ?? '',
      model: data.model ?? this.config.model,
      usage: {
        promptTokens: data.usage?.prompt_tokens ?? 0,
        completionTokens: data.usage?.completion_tokens ?? 0,
        totalTokens: data.usage?.total_tokens ?? 0,
      },
    };
  }

  /**
   * Health check
   */
  async isHealthy(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/v1/models`);
      return response.ok;
    } catch {
      return false;
    }
  }
}
