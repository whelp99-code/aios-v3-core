
import type { UseCase } from '../index.js';

export interface GenerateProjectTasksInput {
  projectId: string;
  template?: string;
}

export interface TaskDefinition {
  title: string;
  description?: string;
  assignee?: string;
}

export interface GenerateProjectTasksOutput {
  projectId: string;
  tasks: TaskDefinition[];
}

/**
 * GenerateProjectTasks
 * Generates task cards for a project based on template or analysis.
 */
export class GenerateProjectTasks implements UseCase<GenerateProjectTasksInput, GenerateProjectTasksOutput> {
  async execute(input: GenerateProjectTasksInput): Promise<GenerateProjectTasksOutput> {
    const defaultTasks: TaskDefinition[] = [
      { title: '요구사항 분석', description: '프로젝트 요구사항 상세 분석' },
      { title: '기술 설계', description: '기술 아키텍처 및 상세 설계' },
      { title: '구현', description: '기능 구현 및 단위 테스트' },
      { title: '검증', description: '통합 테스트 및 사용자 검증' },
      { title: '배포', description: '운영 환경 배포 및 모니터링' },
    ];

    return {
      projectId: input.projectId,
      tasks: defaultTasks,
    };
  }
}
