import { ChatCompletionRequest, ChatCompletionResponse, ProviderHealth } from '../types';
import { ILLMProvider } from './base-provider';
export interface AnthropicProviderConfig {
    apiKey?: string;
    baseURL?: string;
    timeout?: number;
}
export declare class AnthropicProvider implements ILLMProvider {
    readonly provider: "anthropic";
    private client;
    private apiKey;
    constructor(config?: AnthropicProviderConfig);
    isConfigured(): boolean;
    healthCheck(): Promise<ProviderHealth>;
    chatCompletion(request: ChatCompletionRequest): Promise<ChatCompletionResponse>;
    listModels(): Promise<{
        id: string;
    }[]>;
}
//# sourceMappingURL=anthropic-provider.d.ts.map