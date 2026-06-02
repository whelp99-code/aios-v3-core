export interface RapidMLXConfig {
    baseURL: string;
    timeout: number;
}
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
    tools?: any[];
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
            tool_calls?: any[];
        };
        finish_reason: string;
    }>;
    usage: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
    };
}
export declare class RapidMLXClient {
    private client;
    private config;
    constructor(config?: RapidMLXConfig);
    chatCompletion(request: ChatCompletionRequest): Promise<ChatCompletionResponse>;
    listModels(): Promise<any[]>;
    healthCheck(): Promise<boolean>;
    chatWithToolRecovery(request: ChatCompletionRequest): Promise<ChatCompletionResponse>;
}
export default RapidMLXClient;
//# sourceMappingURL=rapid-mlx-client.d.ts.map