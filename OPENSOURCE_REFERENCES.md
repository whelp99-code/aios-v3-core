# AIOS v3 Core 개선을 위한 오픈소스 참고 자료

**작성일**: 2026-06-07  
**목적**: AIOS v3 Core 개선 작업에 참고할 수 있는 오픈소스 프로젝트 조사

---

## 1. Rapid-MLX 관련 오픈소스

### 1.1 MLX 프레임워크 (Apple)
- **GitHub**: https://github.com/ml-explore/mlx
- **Stars**: 26.6k
- **설명**: Apple Silicon을 위한 배열 프레임워크. NumPy와 유사한 Python API 제공
- **주요 특징**:
  - 통합 메모리 모델 (CPU/GPU 간 데이터 전송 불필요)
  - 지연 계산 (Lazy computation)
  - 동적 그래프 구성
  - 자동 미분, 벡터화, 계산 그래프 최적화
- **AIOS 적용 방안**: Rapid-MLX의 기본 프레임워크로 사용, 모델 추론 엔진의 핵심

### 1.2 MLX Examples
- **GitHub**: https://github.com/ml-explore/mlx-examples
- **Stars**: 8.7k
- **설명**: MLX 프레임워크의 다양한 예제 모음
- **주요 모델**:
  - LLM: LLaMA, Mistral, Mixtral 8x7B, Qwen
  - 이미지: Stable Diffusion, FLUX, CLIP
  - 오디오: Whisper, EnCodec, MusicGen
  - 비디오: Wan2.1
- **AIOS 적용 방안**: 다양한 모델 통합 시 참고, LoRA 파인튜닝 구현

### 1.3 LM Studio MLX Engine
- **GitHub**: https://github.com/lmstudio-ai/mlx-engine
- **Stars**: 1.1k
- **설명**: LM Studio를 위한 Apple MLX LLM 엔진
- **주요 특징**:
  - mlx-lm 기반 추론 엔진
  - 구조화된 출력 지원 (Outlines)
  - 비전 모델 지원 (mlx-vlm)
  - 스페큘러 디코딩 지원
- **AIOS 적용 방안**: OpenAI 호환 API 서버 구현 참고, 모델 로딩 및 추론 최적화

---

## 2. 오케스트레이터 관련 오픈소스

### 2.1 LangGraph
- **GitHub**: https://github.com/langchain-ai/langgraph
- **Stars**: 34k
- **설명**: 상태 기반 에이전트를 구축하기 위한 저수준 오케스트레이션 프레임워크
- **주요 특징**:
  - 내구성 있는 실행 (Durable execution)
  - 인간-in-the-Loop (Human-in-the-loop)
  - 포괄적인 메모리 (단기/장기)
  - 프로덕션 준비 배포
  - LangSmith을 통한 디버깅
- **AIOS 적용 방안**: 
  - `StateGraph` 기반 워크플로우 구현
  - 에이전트 간 상태 전이 관리
  - 체크포인트를 통한 안정적인 상태 저장
  - 사이클(Loop) 제어 로직

### 2.2 ChatDev
- **GitHub**: https://github.com/OpenBMB/ChatDev
- **Stars**: 33.3k
- **설명**: LLM 기반 멀티 에이전트 협업 플랫폼
- **주요 특징**:
  - 제로코드 멀티 에이전트 오케스트레이션
  - YAML 기반 워크플로우 정의
  - 다양한 에이전트 역할 (CEO, CTO, Programmer 등)
  - Experiential Co-Learning (경험 기반 공동 학습)
  - MacNet: DAG 기반 에이전트 협업
- **AIOS 적용 방안**:
  - 에이전트 역할 정의 및 분업 구조
  - 워크플로우 YAML 설정 참고
  - 경험 기반 학습 메커니즘

---

## 3. 지식 그래프/GraphRAG 관련 오픈소스

### 3.1 Microsoft GraphRAG
- **GitHub**: https://github.com/microsoft/graphrag
- **Stars**: 33.5k
- **설명**: 그래프 기반 Retrieval-Augmented Generation (RAG) 시스템
- **주요 특징**:
  - 비정형 텍스트에서 구조화된 데이터 추출
  - LLM을 활용한 엔티티/관계 추출
  - 계층적 지식 그래프 구축
  - 커뮤니티 요약 기능
- **AIOS 적용 방안**:
  - 지식 그래프 구축 파이프라인
  - 엔티티/관계 추출 알고리즘
  - GraphRAG 쿼리 엔진
  - 프로젝트 간 지식 전이

---

## 4. 자가 진화 에이전트 관련 오픈소스

### 4.1 OpenHands (구 OpenDevin)
- **GitHub**: https://github.com/OpenHands/OpenHands
- **Stars**: 76k
- **설명**: AI 기반 소프트웨어 개발 에이전트
- **주요 특징**:
  - EventStream 기반 작업 기록
  - 샌드박스 내 코드 실행
  - 에러 감지 및 피드백 루프
  - SWE-bench 77.6% 달성
  - SDK, CLI, GUI, Cloud 다양한 인터페이스
- **AIOS 적용 방안**:
  - 자가 수정 에이전트 구현 참고
  - 코드 실행 및 검증 파이프라인
  - 에이전트-컴퓨터 인터페이스 설계

### 4.2 SWE-agent
- **GitHub**: https://github.com/SWE-agent/SWE-agent
- **Stars**: 19.4k
- **설명**: GitHub 이슈를 자동으로 수정하는 에이전트
- **주요 특징**:
  - 자유 흐름 에이전트 설계
  - YAML 기반 설정
  - SWE-bench 벤치마크 최고 성능
  - 공격적 사이버보안 모드 (EnIGMA)
  - Mini-SWE-agent: 100줄 Python으로 65% 달성
- **AIOS 적용 방안**:
  - 코드 수정 및 패치 로직
  - 이슈 분석 및 해결 전략
  - 벤치마크 및 평가 체계

---

## 5. 통합 활용 가이드

### 5.1 우선 적용 대상
| 우선순위 | 오픈소스 | 적용 영역 | 기대 효과 |
|---------|---------|----------|----------|
| P0 | MLX + mlx-engine | Rapid-MLX 클라이언트 | 실제 서버 통합, 성능 최적화 |
| P1 | LangGraph | 오케스트레이터 | 안정적인 워크플로우 관리 |
| P1 | GraphRAG | 지식 그래프 | 구조화된 지식 구축 |
| P2 | OpenHands/SWE-agent | 자가 진화 | 코드 수정 및 검증 자동화 |

### 5.2 기술 통합 전략
1. **MLX 생태계 통합**
   - `mlx` 프레임워크를 기본으로 사용
   - `mlx-lm`으로 LLM 추론
   - `mlx-vlm`으로 비전 모델 지원
   - `mlx-engine`의 OpenAI 호환 API 차용

2. **LangGraph 기반 오케스트레이션**
   - `StateGraph`로 에이전트 워크플로우 정의
   - 체크포인트로 상태 저장 및 복구
   - 조건부 엣지로 분기 로직 구현

3. **GraphRAG 지식 그래프**
   - 프로젝트 문서에서 엔티티/관계 추출
   - 계층적 커뮤니티 구조 구축
   - 쿼리 기반 지식 검색

4. **OpenHands/SWE-agent 패턴**
   - EventStream 기반 작업 기록
   - 샌드박스 검증 환경
   - 경험 기반 학습 메커니즘

### 5.3 참고 문서
- MLX 공식 문서: https://ml-explore.github.io/mlx/
- LangGraph 문서: https://docs.langchain.com/oss/python/langgraph/overview
- GraphRAG 문서: https://microsoft.github.io/graphrag
- OpenHands 문서: https://docs.openhands.dev

---

## 6. 추가 조사 필요 영역

### 6.1 모델 라우팅 최적화
- **LLM Router**: 비용/성능 기반 동적 라우팅
- **LiteLLM**: 다양한 LLM 프로바이더 통합 인터페이스

### 6.2 메모리 관리
- **Mem0**: 에이전트 장기 메모리 관리
- **LangChain Memory**: 다양한 메모리 유형 지원

### 6.3 평가 및 모니터링
- **LangSmith**: LLM 애플리케이션 관찰 가능성
- **Weights & Biases**: 실험 추적 및 모니터링

---

**최종 업데이트**: 2026-06-07  
**작성자**: AI Assistant