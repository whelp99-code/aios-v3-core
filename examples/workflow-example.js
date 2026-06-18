/**
 * 예제: 워크플로우 엔진 사용법
 * 
 * 실행 방법:
 * cd /Users/jmpark/Documents/Playground/F\ -\ aios-v3-core
 * node examples/workflow-example.js
 */

// ============================================
// 워크플로우 엔진 (직접 구현)
// ============================================
class WorkflowEngine {
  constructor(config) {
    this.config = config;
    this.steps = [];
  }

  addStep(name, execute) {
    this.steps.push({ name, execute });
  }

  async execute(input) {
    const startTime = Date.now();
    const executedSteps = [];
    let currentInput = input;

    try {
      for (const step of this.steps) {
        currentInput = await step.execute(currentInput);
        executedSteps.push(step.name);
      }

      return {
        success: true,
        output: currentInput,
        steps: executedSteps,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        output: null,
        steps: executedSteps,
        duration: Date.now() - startTime,
      };
    }
  }
}

// ============================================
// 에이전트 팩토리
// ============================================
class AgentFactory {
  static createPlanner(model) {
    return {
      id: 'planner',
      name: 'Planner Agent',
      execute: async (input) => ({
        plan: `Plan for: ${JSON.stringify(input).slice(0, 100)}`,
        steps: ['analyze', 'design', 'implement'],
        model: model || 'qwen/qwen3.5-9b',
      }),
    };
  }

  static createExecutor(model) {
    return {
      id: 'executor',
      name: 'Executor Agent',
      execute: async (input) => ({
        result: `Executed: ${JSON.stringify(input).slice(0, 100)}`,
        status: 'completed',
        model: model || 'qwen/qwen3.5-9b',
      }),
    };
  }

  static createCritic(model) {
    return {
      id: 'critic',
      name: 'Critic Agent',
      execute: async (input) => ({
        score: 0.85,
        feedback: 'Good quality output',
        suggestions: ['Consider edge cases', 'Add more tests'],
        model: model || 'qwen/qwen3.5-9b',
      }),
    };
  }
}

// ============================================
// 예제 1: 기본 워크플로우
// ============================================
async function basicWorkflowExample() {
  console.log('\n📌 예제 1: 기본 워크플로우\n');

  const engine = new WorkflowEngine({
    name: '메일 분석 워크플로우',
    model: 'qwen/qwen3.5-9b',
  });

  // 스텝 추가
  engine.addStep('1단계: 메일 읽기', async (input) => {
    console.log('  📧 메일 읽는 중...');
    return { ...input, mailContent: '중요 내용이 담긴 메일' };
  });

  engine.addStep('2단계: 분석', async (input) => {
    console.log('  🔍 분석 중...');
    return { ...input, analysis: { priority: '높음', category: '업무' } };
  });

  engine.addStep('3단계: 요약', async (input) => {
    console.log('  📝 요약 중...');
    return { ...input, summary: '메일 내용 요약 완료' };
  });

  // 실행
  const result = await engine.execute({ source: 'test@example.com' });
  console.log('\n  ✅ 결과:', JSON.stringify(result, null, 2));
}

// ============================================
// 예제 2: 에이전트 팩토리 사용
// ============================================
async function agentFactoryExample() {
  console.log('\n📌 예제 2: 에이전트 팩토리\n');

  // 에이전트 생성
  const planner = AgentFactory.createPlanner('qwen/qwen3.5-9b');
  const executor = AgentFactory.createExecutor('qwen/qwen3.5-9b');
  const critic = AgentFactory.createCritic('qwen/qwen3.5-9b');

  // Planner 실행
  console.log('  🎯 Planner 에이전트 실행...');
  const plan = await planner.execute({ task: '코드 리뷰' });
  console.log('  📋 계획:', JSON.stringify(plan, null, 2));

  // Executor 실행
  console.log('\n  ⚡ Executor 에이전트 실행...');
  const execution = await executor.execute(plan);
  console.log('  📤 실행 결과:', JSON.stringify(execution, null, 2));

  // Critic 실행
  console.log('\n  🔍 Critic 에이전트 실행...');
  const evaluation = await critic.execute(execution);
  console.log('  ⭐ 평가:', JSON.stringify(evaluation, null, 2));
}

// ============================================
// 예제 3: Sangfor 보안 정책 워크플로우
// ============================================
async function sangforWorkflowExample() {
  console.log('\n📌 예제 3: Sangfor 보안 정책 워크플로우\n');

  const engine = new WorkflowEngine({
    name: 'Sangfor 정책 점검',
    model: 'qwen/qwen3.5-9b',
  });

  engine.addStep('1단계: 정책 로드', async (input) => {
    console.log('  📄 정책 문서 로드 중...');
    return {
      ...input,
      policies: [
        { id: 'POL-001', name: '비밀번호 정책', status: '준수' },
        { id: 'POL-002', name: '방화벽 규칙', status: '위반' },
        { id: 'POL-003', name: '접근 제어', status: '준수' },
      ],
    };
  });

  engine.addStep('2단계: 위반 분석', async (input) => {
    console.log('  🔍 위반 사항 분석 중...');
    const violations = input.policies.filter((p) => p.status === '위반');
    return { ...input, violations };
  });

  engine.addStep('3단계: 리포트 생성', async (input) => {
    console.log('  📊 리포트 생성 중...');
    return {
      ...input,
      report: {
        total: input.policies.length,
        violations: input.violations.length,
        compliance: ((input.policies.length - input.violations.length) / input.policies.length * 100).toFixed(1) + '%',
      },
    };
  });

  const result = await engine.execute({ device: 'EPP-10.80.1.106' });
  console.log('\n  ✅ 점검 결과:', JSON.stringify(result.output.report, null, 2));
}

// ============================================
// 실행
// ============================================
async function main() {
  console.log('🚀 AIOS v3 Workflow 예제 실행\n');
  console.log('='.repeat(50));

  await basicWorkflowExample();
  await agentFactoryExample();
  await sangforWorkflowExample();

  console.log('\n' + '='.repeat(50));
  console.log('✅ 모든 예제 실행 완료!\n');
}

main().catch(console.error);
