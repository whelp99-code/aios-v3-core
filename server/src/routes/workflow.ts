import { Router, type IRouter } from 'express';
import { WorkflowEngine } from 'aios-workflow';
import { DockerExecutor } from '@aios/sandbox';
import { randomUUID } from 'node:crypto';
import { validateBody } from '../middleware/security.js';
import {
  WorkflowCreateRequestSchema,
  WorkflowExecuteRequestSchema,
  WorkflowLegacyExecuteRequestSchema,
  type Workflow,
  type WorkflowLegacyExecuteRequest,
} from '../schemas/api-contract.js';

// 인메모리 워크플로우 저장소
const workflowStore = new Map<string, Workflow>();

// 기본 워크플로우 등록
const defaultWorkflows: Workflow[] = [
  {
    id: 'wf-001',
    name: 'Sangfor 정책 점검',
    description: 'Sangfor 장비 보안 정책 자동 점검',
    category: '보안',
    favorite: true,
    steps: [
      { name: '정책 로드', code: "return { ...input, policies: [{id: 'POL-001', name: '비밀번호 정책', status: '준수'}, {id: 'POL-002', name: '방화벽 규칙', status: '위반'}, {id: 'POL-003', name: '접근 제어', status: '준수'}] }" },
      { name: '위반 분석', code: "const violations = input.policies.filter(p => p.status === '위반'); return { ...input, violations }" },
      { name: '리포트 생성', code: "return { total: input.policies.length, violations: input.violations.length, compliance: ((input.policies.length - input.violations.length) / input.policies.length * 100).toFixed(1) + '%' }" }
    ],
    lastRun: null,
    runCount: 0
  },
  {
    id: 'wf-002',
    name: '메일 분석',
    description: '이메일 내용 분석 및 요약',
    category: '분석',
    favorite: false,
    steps: [
      { name: '메일 읽기', code: "return { ...input, content: '重要 내용이 담긴 메일' }" },
      { name: '분석', code: "return { ...input, analysis: { priority: '높음', category: '업무' } }" },
      { name: '요약', code: "return { ...input, summary: '메일 내용 요약 완료' }" }
    ],
    lastRun: null,
    runCount: 0
  },
  {
    id: 'wf-003',
    name: '코드 리뷰',
    description: '코드 품질 자동 리뷰',
    category: '개발',
    favorite: true,
    steps: [
      { name: '코드 분석', code: "return { ...input, issues: ['보안 취약점', '성능 이슈'] }" },
      { name: '점수 계산', code: "return { ...input, score: 85 }" },
      { name: '리포트', code: "return { score: input.score, issues: input.issues, recommendation: '수정 권고' }" }
    ],
    lastRun: null,
    runCount: 0
  },
  {
    id: 'wf-004',
    name: '서버 모니터링',
    description: '서버 상태 실시간 모니터링',
    category: '운영',
    favorite: false,
    steps: [
      { name: 'CPU 체크', code: "return { ...input, cpu: { usage: 45, status: '정상' } }" },
      { name: '메모리 체크', code: "return { ...input, memory: { usage: 62, status: '정상' } }" },
      { name: '디스크 체크', code: "return { ...input, disk: { usage: 78, status: '주의' } }" },
      { name: '종합 리포트', code: "return { cpu: input.cpu, memory: input.memory, disk: input.disk, overall: '정상' }" }
    ],
    lastRun: null,
    runCount: 0
  }
];

defaultWorkflows.forEach(wf => workflowStore.set(wf.id, wf));

export function createWorkflowRouter(
  sandboxExecutor: Pick<DockerExecutor, 'executeNode'> = new DockerExecutor()
): IRouter {
  const workflowRouter = Router();

// 워크플로우 리스트 조회
workflowRouter.get('/api/workflows', (req, res) => {
  res.json(Array.from(workflowStore.values()));
});

// 워크플로우 단건 조회
workflowRouter.get('/api/workflows/:id', (req, res) => {
  const wf = workflowStore.get(req.params.id);
  if (!wf) {
    res.status(404).json({ error: 'Workflow not found' });
    return;
  }
  res.json(wf);
});

// 워크플로우 저장
workflowRouter.post('/api/workflows', validateBody(WorkflowCreateRequestSchema), (req, res) => {
  const { name, description, category, steps } = req.body;
  if (!name || !steps || !Array.isArray(steps)) {
    res.status(400).json({ error: 'Invalid request. Required: name, steps' });
    return;
  }
  const newWf = {
    id: `wf-${randomUUID()}`,
    name,
    description: description || '',
    category: category || '기타',
    favorite: false,
    steps,
    lastRun: null,
    runCount: 0
  };
  workflowStore.set(newWf.id, newWf);
  res.json(newWf);
});

// 워크플로우 삭제
workflowRouter.delete('/api/workflows/:id', (req, res) => {
  if (!workflowStore.has(req.params.id)) {
    res.status(404).json({ error: 'Workflow not found' });
    return;
  }
  workflowStore.delete(req.params.id);
  res.json({ success: true });
});

// 워크플로우 실행 (v2 프록시 호환: POST /api/workflows/:id/execute)
workflowRouter.post(
  '/api/workflows/:id/execute',
  validateBody(WorkflowExecuteRequestSchema),
  async (req, res) => {
  try {
    const workflowId = String(req.params.id);
    const wf = workflowStore.get(workflowId);
    if (!wf) {
      res.status(404).json({ error: 'Workflow not found' });
      return;
    }

    const { input } = req.body;
    const executionId = `exec-${randomUUID()}`;
    const createdAt = new Date().toISOString();

    // 기존 /api/workflow/execute와 동일한 엔진 사용
    const engine = new WorkflowEngine({ name: wf.name });

    for (const step of wf.steps) {
      const sandboxStep = async (stepInput: unknown): Promise<unknown> => {
        const wrappedCode = `
          const input = JSON.parse(process.env.SANDBOX_INPUT || '{}');
          (async () => {
            ${step.code}
          })().then(result => {
            process.stdout.write(JSON.stringify(result));
          }).catch(err => {
            process.stderr.write(JSON.stringify({ error: err.message }));
            process.exit(1);
          });
        `;
        const result = await sandboxExecutor.executeNode(wrappedCode, {
          env: { SANDBOX_INPUT: JSON.stringify(stepInput) },
          timeout: 30_000,
        });
        if (!result.success) {
          throw new Error(
            `Sandbox execution failed for step "${step.name}": ${result.stderr || result.stdout}`
          );
        }
        return JSON.parse(result.stdout);
      };
      engine.addStep(step.name, sandboxStep);
    }

    const result = await engine.execute(input || {});

    // 실행 횟수 업데이트
    wf.lastRun = Date.now();
    wf.runCount = (wf.runCount || 0) + 1;

    res.json({
      executionId,
      workflowId,
      workflow: wf.name,
      status: 'completed',
      mode: 'live',
      createdAt,
      result,
    });
  } catch (error) {
    console.error('Workflow execution error:', error);
    res.status(500).json({
      error: 'Workflow execution failed',
      details: error instanceof Error ? error.message : String(error),
    });
  }
  }
);

// 워크플로우 실행 (레거시 경로 유지)
workflowRouter.post(
  '/api/workflow/execute',
  validateBody(WorkflowLegacyExecuteRequestSchema),
  async (req, res) => {
  try {
    const { name, steps, input } = req.body as WorkflowLegacyExecuteRequest;

    if (!name || !steps || !Array.isArray(steps)) {
      res.status(400).json({
        error: 'Invalid request. Required: name (string), steps (array)',
      });
      return;
    }

    const engine = new WorkflowEngine({ name });

    for (const step of steps) {
      // 각 스텝의 코드를 Docker 샌드박스에서 안전하게 실행
      const sandboxStep = async (stepInput: unknown): Promise<unknown> => {
        const wrappedCode = `
          const input = JSON.parse(process.env.SANDBOX_INPUT || '{}');
          (async () => {
            ${step.code}
          })().then(result => {
            process.stdout.write(JSON.stringify(result));
          }).catch(err => {
            process.stderr.write(JSON.stringify({ error: err.message }));
            process.exit(1);
          });
        `;
        const result = await sandboxExecutor.executeNode(wrappedCode, {
          env: { SANDBOX_INPUT: JSON.stringify(stepInput) },
          timeout: 30_000,
        });
        if (!result.success) {
          throw new Error(
            `Sandbox execution failed for step "${step.name}": ${result.stderr || result.stdout}`
          );
        }
        return JSON.parse(result.stdout);
      };
      engine.addStep(step.name, sandboxStep);
    }

    const result = await engine.execute(input);

    // 실행 횟수 업데이트
    for (const [_id, wf] of workflowStore) {
      if (wf.name === name) {
        wf.lastRun = Date.now();
        wf.runCount = (wf.runCount || 0) + 1;
        break;
      }
    }

    res.json({ workflow: name, result });
  } catch (error) {
    console.error('Workflow execution error:', error);
    res.status(500).json({
      error: 'Workflow execution failed',
      details: error instanceof Error ? error.message : String(error),
    });
  }
  }
);

  return workflowRouter;
}
