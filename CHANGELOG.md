# Changelog

All notable changes to Qreate are documented here.

## [1.0.0] — 2026-03-23

### Features

- **Two-pass PFQS generation**: Replaced single-pass Groq/Llama generation with a two-pass Plan-First-Question-Second architecture using Together AI (Qwen3-235B-A22B primary, Groq llama-3.3-70b fallback). Pass 1 extracts unique topic concepts as a Zod-validated JSON plan; Pass 2 generates one question per concept from that plan.
- **Together AI provider**: `TogetherProvider` with OpenAI SDK `baseURL` override, exponential backoff retry, and automatic Groq fallback — no separate SDK required for either provider.
- **Question type simplification**: Reduced to 4 supported types (Multiple Choice, True/False, Fill in the Blanks, Short Answer). Essay, matching, and identification removed.
- **50-question cap**: Maximum questions per exam reduced to 50 to align with PFQS architecture constraints. Enforced in both frontend store and backend provider.
- **Hybrid quota system**: 10 exams/week with 3/day burst protection and 40/month ceiling. Weekly reset every Monday 00:00 UTC. `ENABLE_STRESS_TESTING` flag unlocks higher limits for development.
- **User authentication**: Full bcrypt auth with secure session tokens, 7-day expiry, and database-backed session restoration across app restarts.
- **Exam history**: Personal exam library with SQLite storage, search/filter UI, and one-click PDF open via `shell.openPath`.
- **Home dashboard**: Real-time quota display, recent exams with click-to-open, and accurate stats using Monday-start week and calendar-month calculations.

### Fixes

- Fixed `ReviewConfirmationPage` connection-state flicker caused by calling `testConnection` on every render; now called once on mount.
- Fixed Settings page AI provider status not updating after key changes; status now re-fetches on save.
- Added TypeScript declaration for CSS module side-effect imports in `vite-env.d.ts` to resolve module resolution errors.
- Replaced placeholder `user_id=1` in all IPC handlers with real authenticated user IDs from session tokens.
- Fixed React infinite render loops in `ExamSuccessPage` and `App` caused by Zustand object destructuring; switched to individual selectors.
- Fixed `NaN` display for quota reset times when `last_weekly_reset` is null.

### Internal

- Removed `GeminiProvider`, `PromptOptimizer`, and `ExamQualityValidator` — dead code from prior generation strategy.
- Removed `@google/generative-ai` from dependencies.
- Removed `switchToFallback` / `resetToPrimary` from preload bridge — fallback is now internal to `TogetherProvider`.
- `ProviderFactory` reduced to a thin wrapper (~60 lines); no provider-switching state.
- Added `open-local-file` IPC handler using `shell.openPath` for reliable cross-platform PDF access.
- Updated Qreate logo integration across app header and window title.
- TypeScript: 0 errors. ESLint: 0 warnings.
