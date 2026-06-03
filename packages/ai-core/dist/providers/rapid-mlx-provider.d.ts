import RapidMLXClient from '../rapid-mlx-client';
import { ChatCompletionRequest, ChatCompletionResponse, ProviderHealth } from '../types';
import { ILLMProvider } from './base-provider';
export declare class RapidMLXProvider implements ILLMProvider {
    readonly provider: "local";
    private client;
    constructor(client: RapidMLXClient);
    isConfigured(): boolean;
    healthCheck(): Promise<ProviderHealth>;
    chatCompletion(request: ChatCompletionRequest): Promise<ChatCompletionResponse>;
    listModels(): Promise<{
        id: string;
    }[]>;
}
//# sourceMappingURL=rapid-mlx-provider.d.ts.map