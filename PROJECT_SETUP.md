# AIOS 프로젝트 설정 완료 보고서 (Rapid-MLX 업데이트)

## 개요

AIOS의 추론 엔진이 **Ollama에서 Rapid-MLX로 교체**되었습니다. 이는 M5 Pro (24GB RAM) 환경에서 최대 4.2배 빠른 추론 속도와 안정적인 도구 호출 복구 능력을 확보하기 위함입니다.

---

## 1. 프로젝트 구조 (업데이트)

```
aios/
├── apps/
│   ├── desktop/              # Electron 메인 프로세스
│   └── web/                  # Next.js 렌더러 (UI)
├── packages/
│   ├── ai-core/              # Rapid-MLX 클라이언트 & 모델 라우터 (교체 완료)
│   │   ├── src/
│   │   │   ├── rapid-mlx-client.ts  # 신규 Rapid-MLX 클라이언트
│   │   │   ├── model-router.ts      # M5 Pro 최적화 라우팅
│   │   │   └── index.ts
│   │   └── dist/
...
```

---

## 2. 주요 변경 사항

### 2.1. 추론 엔진: Rapid-MLX 도입

- **엔진**: Apple MLX 프레임워크 기반의 `Rapid-MLX` 사용
- **속도**: TTFT(첫 토큰 시간) 0.08초 수준, Ollama 대비 대폭 향상
- **특징**: 4bit 양자화 모델의 깨진 도구 호출을 자동으로 구조화된 형식으로 복구하는 파서 내장

### 2.2. M5 Pro (24GB) 최적화 모델 전략

| 작업 유형 | 추천 모델 (Rapid-MLX) | 비고 |
| :--- | :--- | :--- |
| **일반 대화 / 코딩** | `qwen3.5-9b-4bit` | 5.1GB RAM 사용, 108 tok/s (초고속) |
| **복잡 추론** | `deepseek-r1-14b-4bit` | 10GB 내외 RAM 사용, 논리적 추론 강화 |
| **임베딩** | `nomic-embed-text` | 지식 베이스 구축용 |

---

## 3. 실행 방법 (Rapid-MLX 기준)

### 3.1. Rapid-MLX 서버 실행

```bash
# Rapid-MLX 서버 시작 (기본 포트 8000)
# (로컬 환경에 Rapid-MLX가 설치되어 있어야 합니다)
rapid-mlx serve --model qwen3.5-9b-4bit
```

### 3.2. 프로젝트 실행

```bash
cd aios
pnpm install
pnpm --filter web dev      # UI 실행
pnpm --filter desktop dev  # 앱 실행
```

---

## 4. 다음 단계 (Week 2 - MCP 어댑터 연결)

Rapid-MLX의 강력한 도구 호출 기능을 활용하여 3개 앱(vibe-coding-os 등)과의 MCP 연동을 시작합니다. 특히 소형 모델의 응답 불안정성을 Rapid-MLX의 파서가 보정해주므로, 훨씬 안정적인 워크플로우 구현이 가능합니다.

---

**작성일**: 2026년 5월 25일  
**상태**: 추론 엔진 Rapid-MLX 교체 완료, Week 2 준비 중
