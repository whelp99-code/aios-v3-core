/**
 * ReportGenerator
 * 리포트 생성기
 */

import { BenchmarkResult, BenchmarkReport } from './types.js';

export class ReportGenerator {
  /**
   * 벤치마크 리포트 생성
   */
  generateReport(results: BenchmarkResult[]): BenchmarkReport {
    const taskCount = results.length;
    const successCount = results.filter(r => r.success).length;
    const successRate = taskCount > 0 ? successCount / taskCount : 0;

    const averageLatency =
      results.length > 0
        ? results.reduce((sum, r) => sum + r.durationMs, 0) / results.length
        : 0;

    const averageReward =
      results.length > 0
        ? results.reduce((sum, r) => sum + r.evolution.reward, 0) / results.length
        : 0;

    const summary = this.generateSummary(
      taskCount,
      successRate,
      averageLatency,
      averageReward
    );

    return {
      taskCount,
      successRate,
      averageLatency,
      averageReward,
      results,
      summary,
    };
  }

  /**
   * 요약 생성
   */
  private generateSummary(
    taskCount: number,
    successRate: number,
    averageLatency: number,
    averageReward: number
  ): string {
    return `
## 벤치마크 리포트 요약

- **총 태스크 수**: ${taskCount}
- **성공률**: ${(successRate * 100).toFixed(1)}%
- **평균 지연 시간**: ${averageLatency.toFixed(0)}ms
- **평균 보상**: ${averageReward.toFixed(3)}

### 평가

${successRate >= 0.9 ? '✅ 우수: 높은 성공률을 달성했습니다.' : ''}
${successRate >= 0.7 && successRate < 0.9 ? '🔶 양호: 보통 수준의 성공률입니다.' : ''}
${successRate < 0.7 ? '🔴 개선 필요: 성공률이 낮습니다.' : ''}

${averageReward >= 0.8 ? '✅ 우수: 높은 보상을 달성했습니다.' : ''}
${averageReward >= 0.5 && averageReward < 0.8 ? '🔶 양호: 보통 수준의 보상입니다.' : ''}
${averageReward < 0.5 ? '🔴 개선 필요: 보상이 낮습니다.' : ''}
    `.trim();
  }

  /**
   * JSON 리포트 생성
   */
  generateJSONReport(results: BenchmarkResult[]): string {
    const report = this.generateReport(results);
    return JSON.stringify(report, null, 2);
  }

  /**
   * 마크다운 리포트 생성
   */
  generateMarkdownReport(results: BenchmarkResult[]): string {
    const report = this.generateReport(results);

    let md = `# 벤치마크 리포트\n\n`;
    md += `## 요약\n\n`;
    md += report.summary + '\n\n';

    md += `## 상세 결과\n\n`;
    md += `| 태스크 | 성공 | 지연 시간 | 보상 |\n`;
    md += `|--------|------|----------|------|\n`;

    for (const result of results) {
      md += `| ${result.taskName} | ${result.success ? '✅' : '❌'} | ${result.durationMs}ms | ${result.evolution.reward.toFixed(3)} |\n`;
    }

    return md;
  }
}
