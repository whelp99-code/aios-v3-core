---
name: aios-project-accelerator
description: 단 한 문장 또는 단어의 아이디어를 입력받아, AIOS 엔진이 최적의 프로젝트 계획, 아키텍처, 개발 로드맵을 자동으로 생성하고 검증하는 스킬입니다. Manus AI와의 브레인스토밍, 최신 기술 벤치마킹, 아키텍처 고도화 과정을 하나의 스킬로 응축하여, 새로운 프로젝트 시작 시 시행착오를 최소화하고 성공적인 완수를 지원합니다.
input_schema:
  type: object
  properties:
    idea:
      type: string
      description: 프로젝트 아이디어를 설명하는 간결한 자연어 문장 (예: "AI 기반 고객 서비스 챗봇 개발")
    context:
      type: string
      description: 기존 프로젝트 문서, 기술 제약사항, 특정 요구사항 (예: "M5 Pro 환경에서 동작", "안정성 최우선")
      nullable: true
output_schema:
  type: object
  properties:
    ProjectPlan.md:
      type: string
      description: 단계, 목표, 역량을 포함한 상세 프로젝트 계획 문서 경로
    ArchitectureDesign.md:
      type: string
      description: 레이어, 모듈, 인터페이스, 데이터 흐름 다이어그램을 포함한 모듈러 아키텍처 설계 문서 경로
    DevelopmentRoadmap.md:
      type: string
      description: 주요 마일스톤 및 기술 통합 지점을 포함한 단계별 개발 로드맵 문서 경로
    SKILL.md_sub_skills:
      type: array
      items:
        type: string
      description: 새로 식별된 하위 작업 또는 전문 에이전트를 위한 자동 생성된 SKILL.md 템플릿 경로 목록
    VerificationReport.md:
      type: string
      description: 최신 산업 트렌드 및 학술 연구에 대한 계획의 타당성을 검증하는 연구 기반 보고서 경로
---

# AIOS Project Accelerator Skill

## Overview
This skill embodies the collective intelligence and iterative refinement process undertaken to define the AIOS Agentic Engine. It streamlines the journey from a raw idea to a fully-fledged, production-ready project by leveraging advanced AI capabilities for research, design, and planning. The goal is to minimize the initial overhead and accelerate project initiation, ensuring alignment with best practices and cutting-edge technologies from the outset.

## Workflow Steps

1.  **Idea & Context Analysis**: The skill first analyzes the provided `idea` and `context` to understand the core problem, desired outcomes, and any specific constraints. If the idea is vague, it will prompt for clarification to ensure a solid foundation.

2.  **Strategic Research & Benchmarking**: It performs a deep dive into relevant open-source projects (GitHub, GitLab) and academic research (arXiv, industry reports) to identify existing solutions, best practices, and emerging trends in Agentic OS, autonomous skill discovery, and agentic safety/recovery. This step ensures the proposed solution is cutting-edge and avoids reinventing the wheel.

3.  **Integrated Architecture Design**: Based on the research and user context, the skill designs a comprehensive modular architecture. This includes defining logical layers (e.g., UI, Orchestration, AI Core, Data & Knowledge, Integration), identifying key modules within each layer, and specifying interfaces and data flow. Concepts like the Medallion Architecture, Rapid-MLX integration, and Perplexity's safety mechanisms are inherently incorporated.

4.  **Dynamic Skill & Agent Planning**: The skill then identifies the necessary agents and skills required to execute the project. It generates `SKILL.md` templates for these sub-skills, outlining their purpose, inputs, outputs, and high-level execution steps. This includes defining dynamic agent roles based on project needs.

5.  **Roadmap & Validation**: A phased development roadmap is constructed, detailing key milestones, technology integration points, and resource considerations. The entire plan is then validated against the latest research and industry standards to ensure its robustness and feasibility.

6.  **Comprehensive Documentation**: Finally, the skill compiles all generated outputs into a set of structured Markdown documents: `ProjectPlan.md`, `ArchitectureDesign.md`, `DevelopmentRoadmap.md`, `SKILL.md` for sub-skills, and `VerificationReport.md`. These documents provide a complete blueprint for immediate development.

## Dependencies
This skill relies on the following internal AIOS modules and external capabilities:

*   **Orchestration Layer**: For managing the overall workflow, coordinating sub-agents, and enforcing the 3-stage approval loop.
*   **AI Core Layer**: Utilizes Rapid-MLX for high-performance LLM inference, model routing, and robust tool call parsing.
*   **Data & Knowledge Layer**: Leverages OpenKB for knowledge base management, Medallion Architecture for data processing, and Knowledge Lint for quality assurance.
*   **Integration & System Services Layer**: Employs MCP Adapters for seamless external tool integration and a Sandbox Environment for skill validation.
*   **Deep Research Capability**: Access to comprehensive search tools for academic papers and open-source repositories.
*   **Technical Writing Capability**: For generating clear, structured, and professional documentation.

## How to Use
To activate this skill, provide a concise project idea and any relevant context. The AIOS engine will then autonomously execute the workflow described above, delivering a complete project blueprint.

```bash
manus-mcp-cli tool call aios-project-accelerator --server aios-engine --input '{"idea": "AI 기반 코드 자동 생성 및 배포 시스템", "context": "보안 및 확장성 최우선"}'
```

## Version: 1.0
## Author: Manus AI
