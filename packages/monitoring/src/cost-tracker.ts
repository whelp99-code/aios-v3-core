/**
 * CostTracker
 * 토큰/비용 추적
 */

import { TokenUsage } from './types.js';

export class CostTracker {
  private usageHistory: TokenUsage[] = [];

  // 모델별 비용 단가 (USD per 1M tokens)
  private modelPricing: Record<string, { input: number; output: number }> = {
    'qwen3.5-9b': { input: 0.0, output: 0.0 },        // 로컬 (무료)
    'gemma-4-26b-a4b': { input: 0.0, output: 0.0 },    // 로컬 (무료)
    'claude-sonnet-4': { input: 3.0, output: 15.0 },
    'gpt-4o': { input: 2.5, output: 10.0 },
    'gpt-4o-mini': { input: 0.15, output: 0.6 },
  };

  // 환율 (USD → KRW)
  private exchangeRate = 1350;

  /**
   * 토큰 사용량 기록
   */
  recordUsage(params: {
    model: string;
    promptTokens: number;
    completionTokens: number;
  }): TokenUsage {
    const pricing = this.modelPricing[params.model] ?? { input: 0, output: 0 };

    const costUSD =
      (params.promptTokens / 1_000_000) * pricing.input +
      (params.completionTokens / 1_000_000) * pricing.output;

    const usage: TokenUsage = {
      model: params.model,
      promptTokens: params.promptTokens,
      completionTokens: params.completionTokens,
      totalTokens: params.promptTokens + params.completionTokens,
      costUSD,
      costKRW: costUSD * this.exchangeRate,
      timestamp: new Date(),
    };

    this.usageHistory.push(usage);
    return usage;
  }

  /**
   * 세션별 비용 집계
   */
  getSessionCost(sessionId: string): {
    totalTokens: number;
    totalCostUSD: number;
    totalCostKRW: number;
    byModel: Record<string, { tokens: number; cost: number }>;
  } {
    const sessionUsage = this.usageHistory.filter(
      u => u.timestamp.getTime() > Date.now() - 3600_000  // 최근 1시간
    );

    const byModel: Record<string, { tokens: number; cost: number }> = {};

    for (const usage of sessionUsage) {
      if (!byModel[usage.model]) {
        byModel[usage.model] = { tokens: 0, cost: 0 };
      }
      byModel[usage.model].tokens += usage.totalTokens;
      byModel[usage.model].cost += usage.costKRW;
    }

    return {
      totalTokens: sessionUsage.reduce((sum, u) => sum + u.totalTokens, 0),
      totalCostUSD: sessionUsage.reduce((sum, u) => sum + u.costUSD, 0),
      totalCostKRW: sessionUsage.reduce((sum, u) => sum + u.costKRW, 0),
      byModel,
    };
  }

  /**
   * 일일 비용 리포트
   */
  getDailyReport(): {
    date: string;
    totalTokens: number;
    totalCostKRW: number;
    topModels: Array<{ model: string; tokens: number; cost: number }>;
  } {
    const today = new Date().toISOString().split('T')[0];
    const todayUsage = this.usageHistory.filter(
      u => u.timestamp.toISOString().startsWith(today!)
    );

    const modelMap: Record<string, { tokens: number; cost: number }> = {};

    for (const usage of todayUsage) {
      if (!modelMap[usage.model]) {
        modelMap[usage.model] = { tokens: 0, cost: 0 };
      }
      modelMap[usage.model].tokens += usage.totalTokens;
      modelMap[usage.model].cost += usage.costKRW;
    }

    const topModels = Object.entries(modelMap)
      .map(([model, data]) => ({ model, ...data }))
      .sort((a, b) => b.tokens - a.tokens)
      .slice(0, 5);

    return {
      date: today,
      totalTokens: todayUsage.reduce((sum, u) => sum + u.totalTokens, 0),
      totalCostKRW: todayUsage.reduce((sum, u) => sum + u.costKRW, 0),
      topModels,
    };
  }

  /**
   * 사용 이력 조회
   */
  getHistory(): TokenUsage[] {
    return [...this.usageHistory];
  }

  /**
   * 사용 이력 초기화
   */
  clearHistory(): void {
    this.usageHistory = [];
  }
}
