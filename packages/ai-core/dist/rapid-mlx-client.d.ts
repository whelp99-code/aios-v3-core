export interface LMStudioConfig {
    baseURL: string;
    timeout: number;
}
/** @deprecated Use LMStudioConfig. */
export type RapidMLXConfig = LMStudioConfig;
export interface ChatMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}
export interface ChatCompletionRequest {
    model: string;
    messages: ChatMessage[];
    stream?: boolean;
    temperature?: number;
    max_tokens?: number;
    tools?: unknown[];
    tool_choice?: string;
}
export interface ChatCompletionResponse {
    id: string;
    object: string;
    created: number;
    model: string;
    choices: Array<{
        index: number;
        message: {
            role: string;
            content: string;
            tool_calls?: unknown[];
        };
        finish_reason: string;
    }>;
    usage: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
    };
}
export declare class LMStudioClient {
    private client;
    private config;
    constructor(config?: LMStudioConfig);
    chatCompletion(request: ChatCompletionRequest): Promise<ChatCompletionResponse>;
    listModels(): Promise<Array<{
        id: string;
    }>>;
    healthCheck(): Promise<boolean>;
    chatWithToolRecovery(request: ChatCompletionRequest): Promise<ChatCompletionResponse>;
}
/** @deprecated Use LMStudioClient. */
export { LMStudioClient as RapidMLXClient };
export default LMStudioClient;
//# sourceMappingURL=rapid-mlx-client.d.ts.map