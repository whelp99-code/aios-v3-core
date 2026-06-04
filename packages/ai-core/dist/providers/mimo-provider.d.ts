import { ChatCompletionRequest, ChatCompletionResponse, ProviderHealth } from '../types';
import { ILLMProvider } from './base-provider';
export interface MimoProviderConfig {
    apiKey?: string;
    /** Pay-as-you-go: https://api.xiaomimimo.com/v1 — Token Plan uses cluster URL from console */
    baseURL?: string;
    timeout?: number;
}
/**
 * Xiaomi MiMo API — OpenAI-compatible chat/completions with `api-key` header.
 * @see https://platform.xiaomimimo.com/docs/en-US/quick-start/model
 */
export declare class MimoProvider implements ILLMProvider {
    readonly provider: "mimo";
    private client;
    private apiKey;
    constructor(config?: MimoProviderConfig);
    isConfigured(): boolean;
    healthCheck(): Promise<ProviderHealth>;
    chatCompletion(request: ChatCompletionRequest): Promise<ChatCompletionResponse>;
    listModels(): Promise<{
        id: string;
    }[]>;
}
//# sourceMappingURL=mimo-provider.d.ts.map