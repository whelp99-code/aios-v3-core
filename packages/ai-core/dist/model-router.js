export class ModelRouter {
    constructor(client, config) {
        this.client = client;
        // M5 Pro 24GB 환경에 최적화된 Rapid-MLX 모델 매핑
        this.modelConfig = {
            chat: config?.chat || 'qwen3.5-9b-4bit', // 24GB 최적 범용 모델 (108 tok/s)
            code: config?.code || 'qwen3.5-9b-4bit', // 코딩 겸용
            reasoning: config?.reasoning || 'deepseek-r1-14b-4bit', // 추론 필요 시
            embedding: config?.embedding || 'nomic-embed-text',
        };
    }
    getModelForTask(taskType) {
        return this.modelConfig[taskType];
    }
    getModelForRole(role) {
        const roleToTask = {
            planner: 'reasoning',
            executor: 'code',
            critic: 'chat',
            knowledge_updater: 'chat',
            self_corrector: 'reasoning',
        };
        return this.getModelForTask(roleToTask[role]);
    }
    async routeAndChat(taskType, messages, options = {}) {
        const model = this.getModelForTask(taskType);
        console.log(`[Rapid-MLX] Routing to model: ${model} for task: ${taskType}`);
        try {
            const response = await this.client.chatCompletion({
                model,
                messages,
                ...options,
            });
            return response.choices[0].message.content;
        }
        catch (error) {
            console.error(`Error chatting with model ${model}:`, error);
            throw error;
        }
    }
    // 도구 호출이 포함된 채팅
    async routeAndChatWithTools(taskType, messages, tools) {
        const model = this.getModelForTask(taskType);
        try {
            const response = await this.client.chatCompletion({
                model,
                messages,
                tools,
                tool_choice: 'auto',
            });
            return response.choices[0].message;
        }
        catch (error) {
            console.error(`Error in tool-enabled chat with model ${model}:`, error);
            throw error;
        }
    }
}
export default ModelRouter;
//# sourceMappingURL=model-router.js.map