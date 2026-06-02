# AIOS Customization & Extensibility Design

## 1. 개요
AIOS의 **사용자 맞춤형 환경 설정(Customization)**은 사용자가 자신의 특정 요구사항과 선호도에 맞춰 AIOS의 동작 방식을 조정할 수 있도록 하는 기능입니다. **확장성(Extensibility)**은 AIOS의 핵심 기능을 변경하지 않고도 새로운 기능, 스킬, 모델, 통합 요소를 쉽게 추가할 수 있는 아키텍처적 특성을 의미합니다. 이 두 가지는 AIOS가 다양한 사용자 환경과 변화하는 AI 생태계에 유연하게 대응하며 지속적으로 가치를 제공하는 데 필수적입니다.

## 2. 핵심 원칙
*   **Plug-and-Play**: 새로운 모듈이나 스킬, 모델을 최소한의 설정으로 쉽게 추가하고 제거할 수 있도록 합니다.
*   **Configuration-driven**: 대부분의 동작 방식은 코드 변경 없이 설정 파일(YAML, JSON) 수정을 통해 제어할 수 있도록 합니다.
*   **API-first**: 모든 핵심 기능은 표준화된 API를 통해 노출되어 외부 시스템이나 커스텀 모듈과의 연동을 용이하게 합니다.
*   **Community-driven**: 사용자들이 직접 스킬, 어댑터, 모델 설정을 공유하고 기여할 수 있는 생태계를 조성합니다.

## 3. 사용자 맞춤형 환경 설정 (Customization)

### 3.1. User Profile & Preferences
*   **개인 설정**: 사용자의 선호 모델(기본 LLM), 보안 수준(로컬 모델 우선 사용 여부), 비용 상한선, 알림 설정 등을 관리합니다.
*   **에이전트 페르소나**: 각 에이전트(Planner, Executor, Critic 등)의 기본 페르소나(예: 엄격한 코드 리뷰어, 창의적인 아이디어 제안자)를 사용자가 커스터마이징할 수 있도록 합니다.

### 3.2. Dynamic Configuration Files
*   **`config.yaml`**: AIOS의 전역 설정(예: 데이터베이스 연결, 로깅 레벨, 기본 모델 라우팅 정책)을 관리합니다. 이 파일은 UI를 통해서도 쉽게 편집 가능하도록 합니다.
*   **`skills/*.md`**: 각 스킬의 동작 방식, 사용 도구, 성공/실패 조건 등을 정의합니다. 사용자는 이 파일을 직접 수정하거나, AIOS의 `Skill Approval Flow`를 통해 AI가 제안한 개선안을 승인하여 커스터마이징할 수 있습니다.
*   **`model_registry.json`**: `Hybrid AI Core`에서 관리하는 모델들의 메타데이터를 포함합니다. 사용자는 새로운 로컬 모델을 추가하거나 클라우드 모델의 API 키를 설정할 수 있습니다.

### 3.3. UI Customization
*   **대시보드 위젯**: 사용자가 AIOS Command Center의 대시보드에 표시할 위젯(예: 특정 앱의 매출 현황, 에이전트 작업 성공률, 지식 DB 업데이트 현황)을 선택하고 배치할 수 있도록 합니다.
*   **테마 및 레이아웃**: UI의 시각적 테마나 레이아웃을 사용자가 선호하는 방식으로 변경할 수 있는 옵션을 제공합니다.

## 4. 확장성 강화 방안 (Extensibility)

### 4.1. Modular Architecture (재강조)
*   **Layered Design**: UI, Orchestration, AI Core, Data & Knowledge, Integration & System Services의 5개 레이어는 독립적인 모듈로 구성되어, 특정 레이어의 변경이 다른 레이어에 미치는 영향을 최소화합니다.
*   **Well-defined Interfaces**: 각 모듈 간의 통신은 명확하게 정의된 API를 통해 이루어져, 새로운 모듈을 개발하여 기존 시스템에 쉽게 통합할 수 있습니다.

### 4.2. Plugin & Extension System
*   **Skill Plugin**: `SKILL.md` 외에, 더 복잡한 로직이나 외부 라이브러리 연동이 필요한 경우를 위해 Python 또는 TypeScript 기반의 플러그인 형태로 스킬을 개발하고 로드할 수 있는 시스템을 제공합니다.
*   **MCP Adapter SDK**: 새로운 외부 서비스(앱, API)와의 연동을 위한 MCP 어댑터를 쉽게 개발할 수 있도록 SDK(Software Development Kit)를 제공합니다. 이는 표준화된 인터페이스와 템플릿을 포함합니다.
*   **Model Adapter Interface**: 새로운 LLM을 AIOS에 통합하기 위한 표준 인터페이스를 제공하여, 사용자가 직접 선호하는 모델의 어댑터를 구현하고 `Model Registry`에 등록할 수 있도록 합니다.

### 4.3. API Gateway & Webhooks
*   **External API Exposure**: AIOS의 핵심 기능(예: 스킬 실행, 지식 DB 질의, 에이전트 상태 조회)을 외부 시스템에서 호출할 수 있는 RESTful API 또는 GraphQL API를 제공합니다.
*   **Event-driven Architecture**: AIOS 내부에서 발생하는 주요 이벤트(예: 작업 완료, 에러 발생, 스킬 업데이트)를 외부에 Webhook으로 발행하여, 다른 시스템이 AIOS의 상태 변화에 반응할 수 있도록 합니다.

## 5. 통합 및 시너지
사용자 맞춤형 환경 설정과 확장성 강화는 AIOS의 자가 진화형 커널 및 하이브리드 AI 코어 전략과 시너지를 창출합니다. 예를 들어, 사용자가 새로운 모델 어댑터를 추가하면 `Hybrid AI Core`의 `Model Registry`에 자동으로 등록되고, `Self-Evolving Kernel`은 이 새로운 모델의 성능 데이터를 학습하여 `Dynamic Router`의 라우팅 정책을 최적화할 수 있습니다. 이는 AIOS가 사용자 환경에 완벽하게 적응하고 지속적으로 발전하는 기반이 됩니다.

## Version: 1.0
## Author: Manus AI
