# Roadmap: Qreate

## Overview

Migrate Qreate from Groq/Llama to Together AI/Qwen3-235B with a two-pass generation architecture, remove unused code, and simplify constraints to fix the critical 3/10 quality rating.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

## Phase Details

## Progress

**Execution Order:**
Phases execute in numeric order.

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|

### Phase 1: Provider migration to Together AI + Qwen3-235B with two-pass generation, dead code removal, and 50-question simplification

**Goal:** Replace the broken Groq/Llama single-pass generation (3/10 quality) with Together AI/Qwen3-235B using a two-pass PFQS architecture that separates topic planning from question generation, while removing dead code and simplifying to 4 question types and 50-question max.
**Requirements**: [PM-01, PM-02, PM-03, PM-04, PM-05, PM-06]
**Depends on:** Phase 0
**Plans:** 3 plans

Plans:
- [x] 01-01-PLAN.md -- Create TogetherProvider with two-pass PFQS generation and update shared types
- [x] 01-02-PLAN.md -- Delete dead code (GeminiProvider, PromptOptimizer) and simplify frontend to 4 types / 50 max
- [ ] 01-03-PLAN.md -- Rewrite ProviderFactory, update IPC handlers, remove Gemini SDK, verify end-to-end

**Requirement Definitions:**
- PM-01: Together AI as primary provider with Qwen3-235B-A22B-Instruct-2507
- PM-02: Two-pass PFQS architecture (Pass 1: topic plan JSON, Pass 2: question generation)
- PM-03: Groq fallback with qwen/qwen3-32b via OpenAI-compatible SDK
- PM-04: Remove GeminiProvider, PromptOptimizer, and essay/matching/identification question types
- PM-05: Cap questions at 50 max, simplify to 4 question types only
- PM-06: End-to-end integration wiring (ProviderFactory, IPC, preload, package.json cleanup)
