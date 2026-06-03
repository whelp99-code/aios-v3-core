import RapidMLXClient from './rapid-mlx-client';

export type TaskType = 'chat' | 'code' | 'reasoning' | 'embedding';

export type AgentRole = 'planner' | 'executor' | 'critic' | 'knowledge_updater' | 'self_corrector';

export interface ModelConfig {
  chat: string;
  code: string;
  reasoning: string;
  embedding: string;
}

export class ModelRouter {
  private client: RapidMLXClient;
  private modelConfig: ModelConfig;

  constructor(client: RapidMLXClient, config?: Partial<ModelConfig>) {
    this.client = client;
    // M5 Pro 24GB 환경에 최적화된 Rapid-MLX 모델 매핑
    this.modelConfig = {
      chat: config?.chat || 'qwen3.5-9b-4bit',      // 24GB 최적 범용 모델 (108 tok/s)
      code: config?.code || 'qwen3.5-9b-4bit',      // 코딩 겸용
      reasoning: config?.reasoning || 'deepseek-r1-14b-4bit', // 추론 필요 시
      embedding: config?.embedding || 'nomic-embed-text',
    };
  }

  getModelForTask(taskType: TaskType): string {
    return this.modelConfig[taskType];
  }

  getModelForRole(role: AgentRole): string {
    const roleToTask: Record<AgentRole, TaskType> = {
      planner: 'reasoning',
      executor: 'code',
      critic: 'chat',
      knowledge_updater: 'chat',
      self_corrector: 'reasoning',
    };
    return this.getModelForTask(roleToTask[role]);
  }

  async routeAndChat(taskType: TaskType, messages: any[], options: any = {}): Promise<string> {
    const model = this.getModelForTask(taskType);
    console.log(`[Rapid-MLX] Routing to model: ${model} for task: ${taskType}`);

    try {
      const response = await this.client.chatCompletion({
        model,
        messages,
        ...options,
      });
      return response.choices[0].message.content;
    } catch (error) {
      console.error(`Error chatting with model ${model}:`, error);
      throw error;
    }
  }

  // 도구 호출이 포함된 채팅
  async routeAndChatWithTools(taskType: TaskType, messages: any[], tools: any[]): Promise<any> {
    const model = this.getModelForTask(taskType);
    
    try {
      const response = await this.client.chatCompletion({
        model,
        messages,
        tools,
        tool_choice: 'auto',
      });
      return response.choices[0].message;
    } catch (error) {
      console.error(`Error in tool-enabled chat with model ${model}:`, error);
      throw error;
    }
  }
}

export default ModelRouter;
