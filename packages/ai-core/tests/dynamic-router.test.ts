import { describe, expect, it, vi } from 'vitest';
import { DynamicRouter } from '../src/dynamic-router';
import type { ILLMProvider } from '../src/providers/base-provider';
import type {
  ChatCompletionRequest,
  ChatCompletionResponse,
  ModelProvider,
  ProviderHealth,
} from '../src/types';

class FakeProvider implements ILLMProvider {
  readonly chatCompletion = vi.fn(
    async (_request: ChatCompletionRequest): Promise<ChatCompletionResponse> => ({
      id: `response-${this.provider}`,
      choices: [{ message: { role: 'assistant', content: this.provider }, finish_reason: 'stop' }],
      usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
    })
  );

  constructor(
    readonly provider: ModelProvider,
    private readonly healthy = true,
    private readonly configured = true
  ) {}

  isConfigured(): boolean {
    return this.configured;
  }

  async healthCheck(): Promise<ProviderHealth> {
    return { provider: this.provider, healthy: this.healthy };
  }

  async listModels(): Promise<{ id: string }[]> {
    return [];
  }
}

function createProviders() {
  return {
    local: new FakeProvider('local'),
    mimo: new FakeProvider('mimo'),
    openai: new FakeProvider('openai'),
    anthropic: new FakeProvider('anthropic', false, false),
    huggingface: new FakeProvider('huggingface', false, false),
  };
}

describe('DynamicRouter policy boundaries', () => {
  it('keeps complex tasks local under local_only security', async () => {
    const providers = createProviders();
    const router = new DynamicRouter({
      providers,
      preferences: { mode: 'auto', securityLevel: 'local_only' },
    });

    await expect(router.route('planner', 'reasoning')).resolves.toMatchObject({ provider: 'local' });
  });

  it('does not fall back to cloud when local_only execution fails', async () => {
    const providers = createProviders();
    providers.local.chatCompletion.mockRejectedValueOnce(new Error('local unavailable'));
    const router = new DynamicRouter({
      providers,
      preferences: { mode: 'auto', securityLevel: 'local_only' },
    });

    await expect(
      router.routeAndChat('planner', 'reasoning', [{ role: 'user', content: 'plan' }])
    ).rejects.toThrow('All providers in fallback chain failed');
    expect(providers.mimo.chatCompletion).not.toHaveBeenCalled();
    expect(providers.openai.chatCompletion).not.toHaveBeenCalled();
  });

  it('uses a healthy cloud provider for simple work in explicit cloud mode', async () => {
    const providers = createProviders();
    const router = new DynamicRouter({ providers, preferences: { mode: 'cloud' } });

    await expect(router.route('executor', 'chat')).resolves.toMatchObject({ provider: 'mimo' });
  });

  it('uses a local model id when a cloud tool call falls back', async () => {
    const providers = createProviders();
    providers.mimo.chatCompletion.mockRejectedValueOnce(new Error('cloud unavailable'));
    const router = new DynamicRouter({ providers, preferences: { mode: 'cloud' } });

    const result = await router.routeAndChatWithTools(
      'planner',
      'reasoning',
      [{ role: 'user', content: 'plan' }],
      []
    );

    expect(result.routing.provider).toBe('local');
    expect(result.routing.modelId).toBe('google/gemma-4-26b-a4b');
    expect(providers.local.chatCompletion).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'google/gemma-4-26b-a4b' })
    );
  });

  it('ignores a cloud role override under local_only security', async () => {
    const providers = createProviders();
    const router = new DynamicRouter({
      providers,
      preferences: {
        mode: 'auto',
        securityLevel: 'local_only',
        roleOverrides: { planner: { provider: 'mimo', modelId: 'mimo-v2.5-pro' } },
      },
    });

    await expect(router.route('planner', 'reasoning')).resolves.toMatchObject({ provider: 'local' });
  });

  it('does not add cloud reviewers to local_only consensus', async () => {
    const providers = createProviders();
    const router = new DynamicRouter({
      providers,
      preferences: { mode: 'auto', securityLevel: 'local_only' },
    });

    const result = await router.routeMulti('planner', 'reasoning', [
      { role: 'user', content: 'review' },
    ]);

    expect(result.map((item) => item.provider)).toEqual(['local']);
    expect(providers.mimo.chatCompletion).not.toHaveBeenCalled();
  });
});
