/**
 * AgentFactory
 * Mastra 에이전트 팩토리 - LLM Client 통합
 */

import { LLMClient, LLMClientConfig, createLLMClient } from '../lm-studio-client.js';
import { LLMAgent, AgentConfig, AgentPresets, createLLMAgent } from './llm-agent.js';

export interface Agent {
  id: string;
  name: string;
  execute: (input: unknown) => Promise<unknown>;
}

export class AgentFactory {
  private static defaultLLMClient: LLMClient | null = null;

  /**
   * 기본 LLM 클라이언트 설정
   */
  static setDefaultLLMClient(config: LLMClientConfig): void {
    AgentFactory.defaultLLMClient = createLLMClient(config);
  }

  /**
   * 기본 LLM 클라이언트 가져오기
   */
  static getDefaultLLMClient(): LLMClient {
    if (!AgentFactory.defaultLLMClient) {
      AgentFactory.defaultLLMClient = createLLMClient();
    }
    return AgentFactory.defaultLLMClient;
  }

  /**
   * LLM 기반 에이전트 생성 (새로운 방식)
   */
  static createLLMAgent(
    config: AgentConfig,
    llmConfig?: LLMClientConfig
  ): LLMAgent {
    return createLLMAgent({
      ...config,
      llmConfig: llmConfig ?? config.llmConfig,
    });
  }

  /**
   * 프리셋을 사용한 LLM 에이전트 생성
   */
  static createPresetAgent(
    preset: keyof typeof AgentPresets,
    model?: string,
    llmConfig?: LLMClientConfig
  ): LLMAgent {
    const config = AgentPresets[preset](model);
    return AgentFactory.createLLMAgent(config, llmConfig);
  }

  /**
   * Planner 에이전트 생성 (레거시 호환 + LLM 지원)
   */
  static createPlanner(model?: string, useLLM: boolean = false): Agent | LLMAgent {
    if (useLLM) {
      return AgentFactory.createPresetAgent('planner', model);
    }
    return {
      id: 'planner',
      name: 'Planner Agent',
      execute: async (input: unknown) => {
        return {
          plan: `Plan for: ${JSON.stringify(input).slice(0, 100)}`,
          steps: ['analyze', 'design', 'implement'],
          model: model ?? 'qwen/qwen3.5-9b',
        };
      },
    };
  }

  /**
   * Executor 에이전트 생성 (레거시 호환 + LLM 지원)
   */
  static createExecutor(model?: string, useLLM: boolean = false): Agent | LLMAgent {
    if (useLLM) {
      return AgentFactory.createPresetAgent('executor', model);
    }
    return {
      id: 'executor',
      name: 'Executor Agent',
      execute: async (input: unknown) => {
        return {
          result: `Executed: ${JSON.stringify(input).slice(0, 100)}`,
          status: 'completed',
          model: model ?? 'qwen/qwen3.5-9b',
        };
      },
    };
  }

  /**
   * Critic 에이전트 생성 (레거시 호환 + LLM 지원)
   */
  static createCritic(model?: string, useLLM: boolean = false): Agent | LLMAgent {
    if (useLLM) {
      return AgentFactory.createPresetAgent('critic', model);
    }
    return {
      id: 'critic',
      name: 'Critic Agent',
      execute: async (input: unknown) => {
        return {
          score: 0.85,
          feedback: 'Good quality output',
          suggestions: ['Consider edge cases', 'Add more tests'],
          model: model ?? 'qwen/qwen3.5-9b',
        };
      },
    };
  }

  /**
   * Coder 에이전트 생성 (LLM 전용)
   */
  static createCoder(model?: string): LLMAgent {
    return AgentFactory.createPresetAgent('coder', model);
  }

  /**
   * Analyst 에이전트 생성 (LLM 전용)
   */
  static createAnalyst(model?: string): LLMAgent {
    return AgentFactory.createPresetAgent('analyst', model);
  }

  /**
   * 커스텀 에이전트 생성
   */
  static createCustom(config: AgentConfig): LLMAgent {
    return AgentFactory.createLLMAgent(config);
  }
}
