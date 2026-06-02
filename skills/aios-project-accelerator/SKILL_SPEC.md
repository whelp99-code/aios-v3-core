# AIOS Project Accelerator Skill Specification

## Skill Name: `aios-project-accelerator`

## Description
This skill enables the AIOS Agentic Engine to transform a nascent idea (single sentence or word) into a comprehensive, production-ready project plan, architecture, and phased development roadmap. It encapsulates the entire iterative brainstorming, research, benchmarking, and architectural design process previously conducted by Manus AI, minimizing trial and error for future projects.

## Input
*   `idea`: A concise natural language description of the project idea (e.g., "AI 기반 고객 서비스 챗봇 개발", "데이터 분석 자동화 플랫폼").
*   `context` (optional): Any existing project documents, technical constraints, or specific requirements (e.g., "M5 Pro 환경에서 동작", "안정성 최우선").

## Output
*   `ProjectPlan.md`: Detailed project plan with phases, goals, and capabilities.
*   `ArchitectureDesign.md`: Comprehensive modular architecture design with layers, modules, interfaces, and data flow diagrams.
*   `DevelopmentRoadmap.md`: Phased execution roadmap with key milestones and technology integration points.
*   `SKILL.md` (for sub-skills): Automatically generated `SKILL.md` templates for newly identified sub-tasks or specialized agents.
*   `VerificationReport.md`: Research-backed validation of the proposed plan against latest industry trends and academic research.

## Workflow (High-Level)

1.  **Idea Ingestion & Clarification**: 
    *   Receive `idea` and `context`.
    *   If `idea` is ambiguous, initiate a dialogue with the user to clarify scope and core objectives (e.g., "어떤 문제를 해결하고 싶으신가요?", "핵심 가치는 무엇인가요?").
    *   Identify initial project constraints and preferences (e.g., performance, safety, UI/UX).

2.  **Initial Architecture & Core Engine Identification**: 
    *   Based on clarified idea, propose a preliminary high-level architecture (e.g., identifying core Orchestrator, AI Core, Data/Knowledge components).
    *   Determine initial technology stack considerations (e.g., Rapid-MLX for inference, OpenKB for knowledge).

3.  **Contextual Research & Benchmarking**: 
    *   Perform deep research on relevant open-source projects (GitHub, GitLab) and academic papers (arXiv, research databases) related to the project idea.
    *   Benchmark similar projects, analyze their architectures, development methodologies, and identify best practices and potential pitfalls.
    *   Investigate latest trends in Agentic OS, Autonomous Skill Discovery, and Agentic Safety/Recovery.

4.  **Integrated Design & Refinement**: 
    *   Synthesize findings from research and benchmarking with user preferences.
    *   Integrate advanced concepts: Medallion Architecture for data, Perplexity's safety mechanisms (3-stage approval, compensation), dynamic agent roles, Skill Factory principles.
    *   Design a detailed modular architecture, defining layers, modules, interfaces, and data flow.
    *   Generate D2 diagrams for visual representation of the architecture.

5.  **Skill Generation & Roadmap Creation**: 
    *   Based on the refined architecture, identify necessary sub-skills for the project.
    *   Generate `SKILL.md` templates for these sub-skills, including their purpose, inputs, outputs, and high-level steps.
    *   Develop a phased development roadmap, outlining key milestones, technology integration, and resource allocation.

6.  **Validation & Documentation**: 
    *   Cross-reference the proposed plan with the latest research to ensure its validity and cutting-edge nature.
    *   Generate comprehensive documentation: `ProjectPlan.md`, `ArchitectureDesign.md`, `DevelopmentRoadmap.md`, `VerificationReport.md`.
    *   Present the final package to the user for approval and immediate execution.

## Dependencies
*   `packages/orchestrator`: For managing workflow and agent coordination.
*   `packages/ai-core`: For LLM inference (Rapid-MLX) and tool call parsing.
*   `packages/knowledge-bi`: For managing knowledge base (OpenKB) and data processing.
*   `packages/mcp-adapters`: For external tool integration.
*   `packages/sandbox`: For skill validation and testing.

## Usage Example
```
manus-mcp-cli tool call aios-project-accelerator --server aios-engine --input '{"idea": "AI 기반 코드 자동 생성 및 배포 시스템", "context": "보안 및 확장성 최우선"}'
```

## Version: 1.0
## Author: Manus AI
