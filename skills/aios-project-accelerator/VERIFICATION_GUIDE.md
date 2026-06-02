# AIOS Project Accelerator Skill: Simulation & Verification Guide

## 1. 목적
이 문서는 `aios-project-accelerator` 스킬이 사용자로부터 단일 아이디어를 입력받아, 최종 프로젝트 계획, 아키텍처 설계, 개발 로드맵 및 관련 문서를 성공적으로 생성하는지 검증하기 위한 가이드라인을 제공합니다.

## 2. 검증 환경
*   **AIOS Engine**: `aios-project-accelerator` 스킬이 배포된 AIOS 엔진 (Rapid-MLX 기반 AI Core, Orchestration Layer 포함)
*   **CLI Tool**: `manus-mcp-cli` 또는 유사한 MCP 연동 CLI 도구
*   **Output Directory**: 생성된 문서들을 확인할 수 있는 로컬 파일 시스템

## 3. 시뮬레이션 단계

### 3.1. 스킬 호출
`manus-mcp-cli`를 사용하여 `aios-project-accelerator` 스킬을 호출합니다. `idea` 파라미터에는 프로젝트 아이디어를, `context` 파라미터에는 추가적인 제약사항이나 정보를 입력합니다.

**예시 1: 간단한 아이디어**
```bash
manus-mcp-cli tool call aios-project-accelerator --server aios-engine --input '{"idea": "AI 기반 고객 서비스 챗봇 개발"}'
```

**예시 2: 상세한 아이디어와 컨텍스트**
```bash
manus-mcp-cli tool call aios-project-accelerator --server aios-engine --input '{"idea": "데이터 분석 자동화 플랫폼 구축", "context": "M5 Pro 환경에서 동작하며, 실시간 데이터 처리 및 높은 안정성 요구"}'
```

### 3.2. AIOS 엔진 내부 작동 (모니터링)
스킬 호출 후, AIOS Command Center UI 또는 내부 로깅 시스템을 통해 스킬의 작동 과정을 모니터링합니다.

*   **Orchestration Layer**: Planner, Executor, Critic 에이전트 간의 상호작용 및 LangGraph 워크플로우 진행 상황을 확인합니다.
*   **AI Core Layer**: Rapid-MLX를 통한 LLM 추론 및 Tool Call Parser의 작동 여부를 확인합니다.
*   **Data & Knowledge Layer**: 연구 및 벤치마킹 과정에서 생성되는 임시 데이터 및 지식 축적 과정을 확인합니다.
*   **Sandbox Environment**: 스킬 내부에서 생성된 하위 스킬(sub-skills)이나 코드 모듈이 샌드박스에서 검증되는 과정을 확인합니다.

### 3.3. 사용자 개입 (필요 시)
만약 스킬 작동 중 `3단계 스킬 승인 루프`가 트리거되거나, 아이디어 명확화를 위한 질의가 발생하면, UI를 통해 적절히 응답합니다.

## 4. 검증 기준 및 절차

스킬 실행이 완료되면, 다음 기준에 따라 생성된 출력물들을 검증합니다.

### 4.1. 출력 문서 존재 여부 확인
스킬 실행 결과로 다음 파일들이 지정된 출력 디렉토리에 성공적으로 생성되었는지 확인합니다.

*   `ProjectPlan.md`
*   `ArchitectureDesign.md`
*   `DevelopmentRoadmap.md`
*   `SKILL.md` (sub-skills) - 최소 1개 이상 생성되었는지 확인
*   `VerificationReport.md`

### 4.2. 문서 내용의 적합성 및 품질 검증
각 생성된 문서의 내용을 상세히 검토하여 다음 사항들을 확인합니다.

*   **`ProjectPlan.md`**: 입력된 `idea`를 바탕으로 구체적인 목표, 단계, 필요한 역량 등이 명확하게 정의되어 있는가?
*   **`ArchitectureDesign.md`**: 모듈러 아키텍처의 레이어, 핵심 모듈, 인터페이스, 데이터 흐름이 논리적으로 설계되어 있는가? D2 다이어그램이 포함되어 있는가?
*   **`DevelopmentRoadmap.md`**: 현실적인 마일스톤과 기술 통합 지점이 제시되어 있는가? Rapid-MLX, AI-BI 프레임워크, 안정성 전략 등이 반영되어 있는가?
*   **`SKILL.md` (sub-skills)**: 생성된 하위 스킬들이 프로젝트의 특정 요구사항을 해결하기 위한 구체적인 지침을 포함하고 있는가? `SKILL.md` 표준을 준수하는가?
*   **`VerificationReport.md`**: 최신 연구 동향 및 오픈소스 벤치마킹 결과가 반영되어 있으며, AIOS 개발 계획의 타당성을 객관적으로 검증하고 있는가?

### 4.3. 일관성 및 정확성
*   모든 문서가 입력된 `idea`와 `context`를 일관되게 반영하고 있는가?
*   기술적 내용(예: Rapid-MLX, Medallion Architecture)이 정확하게 설명되어 있는가?
*   문서 간 내용의 중복이나 불일치가 없는가?

## 5. 예상 결과
성공적인 스킬 실행 시, AIOS는 단 한 문장의 아이디어만으로도 수많은 브레인스토밍과 리서치를 거친 것과 동일한 수준의 고품질 프로젝트 설계 문서를 자동으로 생성할 것입니다. 이는 향후 모든 프로젝트의 시작 단계를 획기적으로 단축하고, 시행착오를 최소화하여 성공적인 프로젝트 완수를 보장할 것입니다.

## 6. 문제 발생 시 조치
*   **스킬 실행 실패**: AIOS 엔진의 로그를 확인하여 오류 원인을 파악합니다. 주로 `input_schema` 불일치, 내부 모듈 오류, 또는 외부 API 연동 문제일 수 있습니다.
*   **문서 품질 미흡**: Critic 에이전트의 피드백 루프를 통해 `SKILL.md` 개선을 유도하거나, Planner/Executor의 로직을 재검토합니다.

## Version: 1.0
## Author: Manus AI
