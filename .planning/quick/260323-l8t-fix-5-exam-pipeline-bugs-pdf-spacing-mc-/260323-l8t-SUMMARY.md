---
phase: quick
plan: "01"
subsystem: exam-pipeline
tags: [bugfix, pdf, prompt-engineering, validation]
dependency_graph:
  requires: []
  provides: [structured-pdf-html, mc-answer-key-validation, tf-variance-enforcement, cross-type-dedup, fitb-specificity]
  affects: [PDFGenerator, TogetherProvider, validatePass2OutputStandalone, validatePass1Plan]
tech_stack:
  added: []
  patterns: [structured-html-rendering, answer-key-spot-check, word-fingerprint-dedup]
key_files:
  created: []
  modified:
    - src/main/services/PDFGenerator.ts
    - src/main/services/TogetherProvider.ts
decisions:
  - "PDF content rendered as structured HTML instead of raw pre-line text dump; CSS classes handle all spacing"
  - "answerKeyStart hoisted before T/F block so MC spot-check and T/F variance share a single indexOf call"
  - "T/F variance rule promoted to Rule 3 (was Rule 9) and strengthened with concrete False-statement example"
  - "20% mismatch tolerance for MC answer key spot-check to absorb minor model drift"
  - "Cross-type near-duplicate detection uses sorted word-bag fingerprint (3+ char non-stop-words)"
metrics:
  duration: "3 minutes"
  completed: "2026-03-23"
  tasks_completed: 2
  files_modified: 2
---

# Quick Task 260323-l8t: Fix 5 Exam Pipeline Bugs Summary

One-liner: Structured HTML PDF rendering with question-block spacing plus MC answer-key validation, stronger T/F variance enforcement, cross-type duplicate detection, and FitB specificity rules in TogetherProvider.

## What Was Done

### Task 1 — PDF spacing and formatting (Bug 1)

Added `formatContentAsStructuredHTML(content: string): string` private method to `PDFGenerator` that replaces the raw `white-space: pre-line` text dump.

The method:
- Splits content on the `----Answer Key----` delimiter
- Wraps each question block (stem + options) in `<div class="question-block">` — 16px bottom margin
- Converts section headers to `<h3 class="section-header">` — bold, 24px top margin, bottom border
- Detects Short Answer sections and appends `<div class="writing-space">` (min-height: 60px) after each SA question
- Renders the answer key delimiter as `<h3 class="answer-key-header">` with `page-break-before: always`
- Wraps each answer key entry in `<div class="answer-entry">` — 6px gap between items

CSS rules added to the style block: `.question-block`, `.section-header`, `.writing-space`, `.answer-entry`, `.answer-continuation`, `.answer-key-header`. Removed `white-space: pre-line` from `.content`.

### Task 2 — TogetherProvider: Bugs 2–5

**Bug 2 — MC answer key spot-check** (`validatePass2OutputStandalone`):
- Hoisted `const answerKeyStart = normalized.indexOf(ANSWER_KEY_MARKER)` before both the T/F and MC check blocks
- Added MC verification loop: extracts MC question numbers from body, maps them to plan `answerPosition` fields, counts mismatches
- Flags as violation if mismatches exceed 20% of MC count (tolerance absorbs minor model drift)

**Bug 3 — T/F variance** (Pass 2 prompt + Pass 1 requirements):
- Moved T/F variance instruction from Rule 9 to Rule 3 — first type-specific rule after QUESTION COUNT and QUESTION TYPE
- Rewrote as "CRITICAL — generation will be REJECTED if violated" with concrete example (Mitochondria ATP → NADH)
- Added explicit target counts and minimum-polarity rejection threshold to the rule text
- Added cross-type uniqueness constraint to Pass 1 `REQUIREMENTS`: "Each concept must be unique to its assigned question type. Do NOT plan a concept for trueFalse if the same factual claim already appears under multipleChoice or any other type."

**Bug 4 — Cross-type near-duplicate detection** (`validatePass1Plan`):
- Added section 4 after the existing exact-duplicate check
- Fingerprints each concept as sorted bag of words (3+ chars, excluding 9 common stop words)
- Flags any two concepts that share the same fingerprint regardless of question type

**Bug 5 — FitB specificity** (Pass 2 prompt Rule 2):
- Expanded `fillInTheBlanks` type rule line from a one-liner to a full specificity requirement
- Explicitly requires "specific technical term or named concept from the source material"
- Explicitly forbids "another", "some", "it", "important", or the same word being defined

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None.

## Self-Check: PASSED

- `src/main/services/PDFGenerator.ts` — exists, modified
- `src/main/services/TogetherProvider.ts` — exists, modified
- Commit `6b10fb5` — PDFGenerator task 1
- Commit `e1ea198` — TogetherProvider task 2
- `npm run typecheck` — 0 errors
- `npm run lint` — 0 warnings
