---
phase: 01-provider-migration
plan: "01"
subsystem: ai-provider
tags: [together-ai, qwen3, two-pass, pfqs, exam-generation, provider-migration]
dependency_graph:
  requires: []
  provides: [TogetherProvider, ExamGenerationConfig, TopicPlan]
  affects: [src/main/services/ProviderFactory.ts, src/main/index.ts]
tech_stack:
  added: [openai-sdk-baseurl-override, together-ai, zod-pass1-validation]
  patterns: [two-pass-pfqs, json-mode-pass1, text-mode-pass2, fallback-chain]
key_files:
  created:
    - src/main/services/TogetherProvider.ts
  modified:
    - src/shared/types/exam.ts
    - src/main/services/ProviderFactory.ts
    - src/main/index.ts
    - src/renderer/src/components/ConfigurationSummary.tsx
decisions:
  - "Use OpenAI SDK baseURL override for Together AI and Groq (not separate SDKs)"
  - "Two-pass PFQS: Pass 1 JSON mode temperature 0.3, Pass 2 text mode temperature 0.5"
  - "Zod TopicPlanSchema validates Pass 1 output before Pass 2 proceeds"
  - "callWithFallback: 2 retries with 2s/4s exponential backoff on primary, then Groq fallback"
  - "Cap totalQuestions at 50 inside generateExam to enforce research recommendation"
metrics:
  duration: "6 minutes"
  completed: "2026-03-21"
  tasks_completed: 2
  files_created: 1
  files_modified: 4
---

# Phase 01 Plan 01: TogetherProvider with Two-Pass PFQS Generation Summary

**One-liner:** TogetherProvider implements Plan-First-Question-Second (PFQS) exam generation via Together AI/Qwen3-235B-A22B primary with Groq/Qwen3-32B fallback, using JSON-mode Pass 1 (temperature 0.3) and text-mode Pass 2 (temperature 0.5), with Zod validation between passes.

## Tasks Completed

| Task | Name | Commit | Status |
|------|------|--------|--------|
| 1 | Update shared types to 4 question types and add TopicPlan interface | 35ac5ec | Pre-completed |
| 2 | Create TogetherProvider with two-pass PFQS generation | 2757df1 | Complete |

## What Was Built

### TogetherProvider.ts (426 lines)

The core deliverable. Implements `IAIProvider` interface with:

- **Pass 1 (`extractTopicPlan`):** Calls Together AI in JSON mode (`response_format: { type: 'json_object' }`), temperature 0.3. Prompts the model to extract `N` unique concepts from source material and assign each a question type, 3-level difficulty, Bloom's taxonomy level, and (for MCQ) an answer position cycling A-B-C-D. Output validated with `TopicPlanSchema` (Zod).
- **Pass 2 (`generateFromPlan`):** Calls Together AI in text mode, temperature 0.5. Passes the validated topic plan JSON alongside the source material. Model generates exactly one question per concept following the assigned type and answer position.
- **`callWithFallback` helper:** Retries primary client up to 2 times (2s, 4s backoff), then falls through to Groq fallback client (2 retries). Throws only if both are exhausted.
- **`mapDifficultyToThreeLevels`:** Maps the UI 5-level distribution (veryEasy/easy/moderate/hard/veryHard) to 3-level (easy/moderate/hard) for the planning prompt.

### ProviderFactory.ts (updated)

Simplified to use only `TogetherProvider`. Removed references to deleted `GroqProvider` and `GeminiProvider`. Internal fallback is handled within `TogetherProvider`, so `switchToFallback()` and `resetToPrimary()` are documented no-ops.

### index.ts (updated)

Removed import of deleted `ExamQualityValidator`. Removed the quality validation block in the `groq-generate-exam` IPC handler. Cleaned the response to return `{ success, content, exam, usageStatus }` without `qualityMetrics`.

### ConfigurationSummary.tsx (updated)

Removed `essay`, `matching`, `identification` from the `getQuestionTypeLabel` label map, aligning with the 4-type `QuestionType` union.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] ProviderFactory imported deleted GroqProvider and GeminiProvider**
- **Found during:** Task 2 - TypeScript compilation showed 3 errors before TogetherProvider could compile cleanly
- **Issue:** `src/main/services/ProviderFactory.ts` had `import { GroqProvider } from './GroqProvider'` and `import { GeminiProvider } from './GeminiProvider'`, both deleted in the Task 1 commit
- **Fix:** Rewrote ProviderFactory to import only `TogetherProvider`, simplified to single-provider factory
- **Files modified:** `src/main/services/ProviderFactory.ts`
- **Commit:** 2757df1

**2. [Rule 3 - Blocking] index.ts imported deleted ExamQualityValidator**
- **Found during:** Task 2 - TypeScript compilation error
- **Issue:** `src/main/index.ts` imported `ExamQualityValidator` from `./services/ExamQualityValidator` which was deleted in Task 1
- **Fix:** Removed the import and the quality validation block (~40 lines) in the `groq-generate-exam` handler. The two-pass architecture in TogetherProvider replaces the need for post-generation quality validation.
- **Files modified:** `src/main/index.ts`
- **Commit:** 2757df1

**3. [Rule 1 - Bug] ConfigurationSummary used stale QuestionType label map**
- **Found during:** Task 2 - TypeScript compilation error TS2353
- **Issue:** `ConfigurationSummary.tsx` had `essay`, `matching`, `identification` keys in the `Record<QuestionType, string>` label map, but `QuestionType` was already restricted to 4 values in Task 1
- **Fix:** Removed the 3 stale keys
- **Files modified:** `src/renderer/src/components/ConfigurationSummary.tsx`
- **Commit:** 2757df1

## Verification

```
npx tsc --noEmit → 0 errors
```

All acceptance criteria confirmed:
- `TogetherProvider.ts` exists, 426 lines (>200 min)
- `import OpenAI from 'openai'` present
- `baseURL: 'https://api.together.xyz/v1'` present
- `baseURL: 'https://api.groq.com/openai/v1'` present
- `primaryModel = 'Qwen/Qwen3-235B-A22B-Instruct-2507'` present
- `response_format: { type: 'json_object' }` in Pass 1
- `temperature: 0.3` (Pass 1) and `temperature: 0.5` (Pass 2)
- `TopicPlanSchema` Zod validation present
- `async extractTopicPlan` (Pass 1 method) present
- `async generateFromPlan` (Pass 2 method) present
- `export class TogetherProvider` present
- `export interface ExamGenerationConfig` with only 4 question types

## Known Stubs

None. The exam generation flow is fully wired. `TogetherProvider` is registered in `ProviderFactory` which is instantiated in `index.ts`. The `TOGETHER_API_KEY` environment variable must be set in `.env.local` for production use.

## Self-Check: PASSED

Files exist:
- `src/main/services/TogetherProvider.ts` — FOUND
- `src/main/services/ProviderFactory.ts` — FOUND
- `.planning/phases/01-provider-migration-to-together-ai-qwen3-235b-with-two-pass-generation-dead-code-removal-and-50-question-simplification/01-01-SUMMARY.md` — FOUND

Commits exist:
- `35ac5ec` (Task 1 - pre-completed) — FOUND
- `2757df1` (Task 2) — FOUND
