# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Qreate** is an automated test/exam creator desktop application that streamlines the process of generating review exams from study materials using AI.

### Core Functionality
- Users upload study materials (PDF, DOCX, TXT, images with OCR)
- Configure exam parameters (types, quantities, difficulty distribution)
- AI (Google Gemini, OpenAI, Anthropic Claude, or Ollama) generates customized exams
- Multi-provider support allows users to choose based on cost, quality, and privacy
- Exams are automatically formatted and exported to Google Docs and PDF
- Project history management similar to chat history

## Architecture

### Technology Stack

**Desktop Framework:**
- Electron (recommended for cross-platform support) or Tauri (for lightweight alternative)

**Backend:**
- Node.js with Express OR Python with FastAPI
- TypeScript for type safety

**Database:**
- SQLite for local storage
- PostgreSQL for optional cloud sync

**Frontend:**
- React or Vue.js
- State Management: Redux or Zustand (consider XState for workflow state machines)

**Key Libraries:**
- File Processing: pdf-parse, mammoth, Tesseract OCR
- AI Provider APIs:
  - Google Gemini API (@google/generative-ai) - FREE, recommended
  - OpenAI API (openai) - PAID, high quality
  - Anthropic Claude API - PAID, advanced reasoning
  - Ollama - FREE, local, privacy-focused
- API Integration: Google Drive API, Google Docs API
- Authentication: OAuth 2.0
- Background Jobs: BullMQ for task queue management
- Validation: Zod for runtime validation
- API Layer: tRPC for type-safe client-server communication

**Testing:**
- Jest for unit tests
- Playwright for end-to-end tests (MCP server already installed)

### MCP Servers Configured

The following MCP servers are available for development:
- **context7** - Context-aware development features
- **playwright** - Browser automation for testing
- **filesystem** - File operations
- **sqlite** - Database management
- **memory** - Persistent context storage
- **fetch** - HTTP requests for APIs

## Workflow Phases

### Phase 1: User Onboarding & Setup
1. **User Registration**
   - Email + password authentication
   - Email verification required
   - Password requirements: min 8 chars, 1 uppercase, 1 number, 1 special char

2. **AI Provider Selection & Setup**
   - Multi-provider support: Gemini (FREE), OpenAI (PAID), Anthropic (PAID), Ollama (LOCAL)
   - Beautiful provider selection UI with clear cost/feature indicators
   - API key validation with real connection testing
   - Provider-specific setup instructions
   - Stored credentials encrypted in local storage
   - Default provider: Google Gemini (free, no credit card required)

### Phase 2: Exam Configuration
3. **File Upload**
   - Max 5 files, 50MB per file, 200MB total
   - Supported formats: PDF, DOCX, DOC, TXT, PNG, JPG
   - Drag-and-drop interface
   - Text extraction validation

4. **Exam Type Selection**
   - Multiple Choice, True/False, Fill in the Blanks, Short Answer, Essay, Matching, Identification
   - Real-time total counter
   - Validation: 10-200 total items

5. **Difficulty Distribution**
   - Very Easy, Easy, Moderate, Hard, Very Hard
   - Must sum to total items exactly
   - Visual progress bar with auto-distribute option

6. **Review & Confirmation**
   - Summary of all configurations
   - Estimated processing time and API usage
   - Final validation before generation

### Phase 3: Exam Generation
7. **AI Provider Processing**
   - Uses selected AI provider (Gemini, OpenAI, Anthropic, or Ollama)
   - Sequential file processing (avoid rate limits)
   - Strict prompt engineering for consistent format (provider-agnostic)
   - Auto-retry on malformed responses (max 3 attempts)
   - Live progress tracking
   - Provider-specific error handling and rate limit management

8. **Content Validation & Storage**
   - Parse exam structure
   - Verify question counts
   - Check for duplicates
   - Store in temporary database

### Phase 4: Document Creation
9. **Google Docs Generation**
   - Document naming: `Username_TaskXXX`
   - Multi-exam: Use tabs or sections
   - Preserve formatting with page breaks
   - Answer key on separate page

10. **PDF Export & Download**
    - Export via Google Drive API
    - ZIP folder for multiple files
    - Store in `Projects/Project_[ID]/`

### Phase 5: Project Management
11. **Project Archival & History**
    - SQLite database with project metadata
    - Search, filter, sort capabilities
    - Actions: view, re-download, duplicate, edit, regenerate, delete
    - Optional cloud sync for multi-device access

### Phase 6: Error Recovery & Edge Cases
- Auto-retry with exponential backoff (max 3 attempts)
- Save progress locally and resume on connection restore
- Auto-save every action
- "Restore last session" on app restart

## Critical Prompt Engineering

### AI Provider Exam Generation Format
**Note:** This prompt format is provider-agnostic and works with all supported AI providers (Gemini, OpenAI, Anthropic, Ollama)

```
SYSTEM ROLE: You are an expert exam creator. Generate ONLY the exam content with no introductory text, explanations, or suggestions.

FORMAT REQUIREMENTS:
General Topic: [Auto-extracted from content]
----Exam Content----
[Questions organized by type and difficulty]
[PAGE BREAK]
----Answer Key----
[Answers only, on separate page]

USER REQUEST:
- Source Material: [File content]
- Question Types: [List with quantities]
- Difficulty: [Distribution breakdown]
- Total Items: [Number]

CRITICAL: Output ONLY exam content in the format above. No extra text.
```

**Provider-Specific Implementation:**
- **Gemini:** Uses `gemini-2.5-flash` model with temperature 0.7
- **OpenAI:** Uses `gpt-4o-mini` model with temperature 0.7
- **Anthropic:** (To be implemented) Uses Claude with similar parameters
- **Ollama:** (To be implemented) Uses local models with custom parameters

**See:** `src/renderer/src/services/ai-providers/` for actual implementations

## Key Design Principles

### Foolproofing
- Clear validation at every step with inline error messages
- Disable "Next" button until valid configuration
- Auto-save and recovery mechanisms
- Transparent process with progress tracking
- No data loss - auto-save every action

### Error Handling
- Network issues: Auto-retry, save progress, show offline mode
- API failures: Queue requests, show service status
- User errors: Undo button, confirmation dialogs, input validation
- All errors show specific, actionable messages

### State Management
- Use XState for complex multi-step workflow
- Implement proper state machines for phase transitions
- Ensures resumability and error recovery

### Real-time Updates
- WebSockets for live progress tracking
- Show file processing status, exam generation progress
- Estimated time remaining

## File Structure

```
Qreate/
├── src/
│   ├── main/           # Electron main process
│   ├── renderer/       # Frontend React app
│   ├── backend/        # API server (Express/FastAPI)
│   ├── database/       # SQLite schemas and migrations
│   ├── services/       # Business logic
│   │   ├── chatgpt/    # OpenAI API integration
│   │   ├── google/     # Google Drive/Docs API
│   │   ├── fileProcessor/  # PDF, DOCX, OCR handling
│   │   └── examValidator/  # Exam validation logic
│   ├── utils/          # Shared utilities
│   └── types/          # TypeScript type definitions
├── Projects/           # User project storage
├── tests/              # Jest unit tests
├── e2e/                # Playwright end-to-end tests
└── docs/               # Documentation
```

## Development Guidelines

### Code Quality
- Use TypeScript throughout
- Implement comprehensive logging (Winston/Pino)
- Use Zod for runtime validation of API responses
- Follow error boundary patterns in React
- Write unit tests for business logic
- Write E2E tests for critical user flows

### Performance
- Process files sequentially to respect API rate limits
- Use BullMQ for background job processing
- Implement caching where appropriate
- Optimize large file handling

### Security
- Never store API keys in plaintext
- Encrypt sensitive credentials
- Use OAuth 2.0 best practices
- Sanitize file uploads
- Validate all user inputs

### User Experience
- Provide presets: "Quick Quiz (20 items)", "Standard Exam (50 items)", "Comprehensive (100 items)"
- Show recommended item counts per type
- Visual feedback for all long-running operations
- Tooltips and guided tutorials for first-time users
- In-app help and FAQ

## Success Criteria

- User never loses progress (auto-save and recovery)
- Clear validation at every step (no ambiguous errors)
- Guaranteed output format (strict prompt engineering)
- Handles all edge cases (file issues, API failures, network problems)
- User can always access past work (project history)
- Transparent process (progress tracking and status updates)
- Flexible download options (multiple formats)
- Easy to use (intuitive UI with helpful guidance)
- Recoverable from any failure (retry, resume, restore)

## Memory/Context Notes

### Project Initialization
- Repository initialized on 2025-10-26
- Initial flow documented in `c:\Users\John Dio Lumacang\Downloads\Tech Projects.pdf`
- Refined flow includes 6 major phases with comprehensive error handling
- MCP servers configured: context7, playwright, filesystem, sqlite, memory, fetch

### Project Goals & Philosophy
**CRITICAL: This app must be complete and production-ready for deployment.**

- **Efficiency**: Optimize for performance, minimize API calls, efficient file processing
- **Modularity**: Build reusable components, clear separation of concerns, easy to maintain
- **High Functionality**: Implement all features from the refined flow, robust error handling, excellent UX
- **Production Quality**:
  - Comprehensive testing (unit, integration, E2E)
  - Proper error logging and monitoring
  - Security best practices
  - Professional UI/UX
  - Documentation for users and developers

### Development Approach
**Educational & Transparent**: The developer is learning alongside implementation.

For every implementation step, Claude should:
1. **Explain the "Why"**: Rationale behind architectural and technical decisions
2. **Explain the "What"**: What each piece of code/configuration does
3. **Explain the "How"**: How components interact and work together
4. **Show Alternatives**: Mention alternative approaches when relevant
5. **Best Practices**: Highlight industry best practices being applied
6. **Learning Resources**: Suggest docs or concepts to explore further

This is a learning journey - take time to understand each step before moving forward.

### Key Decisions
- **Desktop Framework**: Electron ✅
- **Backend**: Node.js + Fastify (TypeScript) ✅
- **Frontend**: React + TypeScript ✅
- **UI Library**: shadcn/ui (modern, customizable)
- **State Management**: Zustand (global) + XState (workflows) ✅
- **Database**: SQLite (better-sqlite3) ✅
- **API Layer**: tRPC (type-safe communication) ✅
- **Validation**: Zod ✅
- **Testing**: Vitest + Playwright ✅
- **Background Jobs**: BullMQ ✅
- Focus on foolproof UX with extensive validation and error recovery
- Project history stored locally in SQLite with optional cloud sync
- **Production-ready**: Every component should be deployment-quality, not MVP/prototype
- **Educational**: Deep explanations for learning, developer is new to React/TypeScript

### Project Setup Status
- ✅ Project initialized with Electron + React + TypeScript
- ✅ Development tools configured (ESLint, Prettier)
- ✅ Basic project structure created
- ✅ Build system configured (electron-vite)
- ✅ First successful test run completed
- ✅ State management installed (Zustand, XState)
- ✅ UI components created (Button, Card, Input)
- ✅ Styling configured (Tailwind CSS v3)

### Phase 1: User Onboarding & Setup (COMPLETED ✅)
**Commits:**
- fd0d37a - "feat: Implement Phase 1 authentication and API key management"
- 6fb415f - "feat: Implement multi-LLM provider support with Gemini 2.5 Flash"

**Completed Features:**
- ✅ User authentication (Login/Signup pages with routing)
- ✅ Password validation (min 8 chars, 1 uppercase, 1 number, 1 special char)
- ✅ Real-time password requirements checker with visual feedback
- ✅ Protected routes (redirect to login if not authenticated)
- ✅ **Multi-LLM Provider Support**
  - Google Gemini 2.5 Flash (FREE, recommended)
  - OpenAI GPT-4o-mini (PAID)
  - Anthropic Claude (UI ready, implementation pending)
  - Ollama (UI ready, implementation pending)
- ✅ Beautiful provider selection UI with badges and indicators
- ✅ Real API connection testing (Gemini and OpenAI working)
- ✅ Provider-specific setup instructions
- ✅ API credentials storage per provider in Zustand store
- ✅ Connection status tracking
- ✅ Onboarding banner on HomePage prompting API key setup
- ✅ Settings and Logout buttons in header
- ✅ React Router for navigation
- ✅ AI Provider SDKs installed (@google/generative-ai, openai)

**What's Working:**
- Complete auth flow: signup → login → home → settings → logout
- Password requirements checker shows green checkmarks as user types
- Multi-provider selection with visual cards
- Real API validation with actual connection tests
- Protected routing prevents access without authentication
- Provider switching and disconnect functionality
- Default to free Gemini provider

**Still Needed for Production:**
- Implement Anthropic Claude provider
- Implement Ollama local provider
- Encryption for API credentials (use electron-store with encryption)
- Email verification for signups
- Backend API for actual user registration/authentication
- Google Drive OAuth connection

### Phase 2: Exam Configuration (COMPLETED ✅)
**Commits:**
- c78c80f - "feat: Implement Phase 2 file upload and exam type selection"
- d1f3d24 - "feat: Implement Phase 2 Step 3 - Difficulty Distribution"
- (Current) - "feat: Implement Phase 2 Step 4 - Review & Confirmation"

**Completed Features:**
- ✅ **File Upload System** (Step 1)
  - Drag-and-drop interface
  - File validation (PDF, DOCX, TXT, PNG, JPG)
  - Max 5 files, 50MB per file, 200MB total
  - Real-time validation with status indicators
  - File management (remove files)
- ✅ **Exam Type Selection** (Step 2)
  - 7 question types (Multiple Choice, True/False, etc.)
  - Quick presets (Quick Quiz, Standard Exam, Comprehensive)
  - Real-time total counter with validation
  - Min 10, max 200 questions
  - Smart input UX (text selection, local state pattern)
- ✅ **Difficulty Distribution** (Step 3)
  - 5 difficulty levels (Very Easy → Very Hard)
  - Range sliders + number inputs with +/- buttons
  - Auto-distribute button (20-20-30-20-10 default)
  - Visual progress bar with color coding
  - Real-time validation (must sum to total)
  - Percentage display
- ✅ **Review & Confirmation** (Step 4)
  - Comprehensive configuration summary
  - Edit buttons for each section
  - AI provider info and connection status
  - Estimated processing time
  - Estimated cost (Free for Gemini)
  - Final validation before generation
  - Generate Exam button (ready for Phase 3)

**What's Working:**
- Complete Phase 2 workflow: upload → types → difficulty → review
- Workflow validation (redirects if steps skipped)
- Beautiful, intuitive UI with progress tracking (0% → 25% → 50% → 75% → 100%)
- Real-time validation at every step
- Foolproof UX (disabled buttons until valid)
- Smooth input handling (text selection, no "0" flash)

**Still Needed for Production:**
- Backend API for actual user registration/authentication

### Phase 3: Exam Generation (COMPLETED ✅)
**Commits:**
- (Current) - "feat: Implement Phase 3 file text extraction (.txt and .docx)"

**Completed Features:**
- ✅ **File Text Extraction Service**
  - Created `FileTextExtractor` service in main process (src/main/services/FileTextExtractor.ts)
  - .txt file extraction (UTF-8 direct read)
  - .docx file extraction (mammoth library)
  - Text cleaning and normalization
  - Metadata extraction (word count, char count)
  - Comprehensive error handling with user-friendly messages

- ✅ **IPC Communication**
  - `open-file-dialog` handler (native Electron file picker with .txt/.docx filters)
  - `extract-file-text` handler (secure file text extraction)
  - Exposed APIs in preload script
  - TypeScript type definitions updated

- ✅ **Exam Generation Integration**
  - ExamGenerationService uses IPC to extract real file text
  - No more placeholder content - actual file content sent to AI
  - Sequential file processing with progress tracking
  - Retry logic with exponential backoff (max 3 attempts)
  - Real-time progress updates (file-by-file, questions generated, time remaining)

- ✅ **AI Provider Integration**
  - Google Gemini 2.5 Flash working (tested and verified)
  - OpenAI GPT-4o-mini working
  - Prompt engineering for exam generation
  - Provider-agnostic exam format

- ✅ **UI Components**
  - ExamGenerationProgressPage with live progress tracking
  - File-by-file processing status display
  - Error handling with retry option
  - Success/completion states

**What's Working:**
- Complete end-to-end exam generation workflow
- File upload → text extraction → AI generation → exam created
- Tested with real .docx file (33,157 characters extracted successfully)
- Real-time progress tracking with visual feedback
- Error recovery and retry mechanisms
- Multi-provider support (Gemini and OpenAI tested)

**Known Limitations:**
- PDF support disabled (text extraction library issues - see BUG_REPORT_PDF_EXTRACTION.md)
- Legacy .doc format not supported (users can convert to .docx)
- Images not yet supported (OCR planned for future)
- Response parsing uses placeholders (AI generates real exam, but parsing needs refinement)

**Supported File Formats:**
- ✅ .txt (plain text)
- ✅ .docx (Microsoft Word)
- ❌ .pdf (disabled - extraction issues)
- ❌ .doc (not supported - convert to .docx)
- ❌ Images (planned for future)

**Still Needed for Production:**
- ~~Refine AI response parsing~~ ✅ COMPLETED
- ~~Add answer key parsing from AI response~~ ✅ COMPLETED
- Implement exam result display page

### Phase 4: Document Creation (IN PROGRESS 🔄)
**Commits:**
- (Current) - "feat: Implement Phase 4 Google Drive integration"

**UX-First Approach:**
- ✅ One-click OAuth for Google Drive (no manual setup required)
- ✅ Automatic document creation (zero configuration)
- ✅ Clear success/error states with actionable messages
- ✅ Fallback to local storage if Google Drive fails (no data loss)
- ✅ Progressive disclosure (advanced OAuth options hidden)
- ✅ Hybrid approach: Document export (MVP) + Interactive exams (future enhancement)

**Implementation Plan:**
1. **Google Drive OAuth Integration**
   - One-click "Connect Google Drive" button
   - OAuth 2.0 flow using Electron's native browser
   - Store refresh token securely for persistent connection
   - Connection status indicator in Settings

2. **Document Formatting Service**
   - Convert GeneratedExam to formatted document structure
   - Question numbering by type (Multiple Choice, True/False, etc.)
   - Answer key on separate page with [PAGE BREAK]
   - Professional formatting with proper spacing

3. **Google Docs API Integration**
   - Create Google Doc with formatted content
   - Document naming: `[Topic]_Exam_[Timestamp]`
   - Upload to user's Google Drive
   - Return shareable link

4. **PDF Export**
   - Use Google Drive API export endpoint
   - Download PDF to `Projects/Project_[ID]/`
   - Store file path in database for later access

5. **Project Storage**
   - SQLite schema for exam projects
   - Store metadata: topic, date, files used, question counts, document links
   - Enable future "My Projects" page for history management

**User Flow:**
```
Exam Generated → [Connect Google Drive] → One-click OAuth →
Document Creation Progress → Success Screen →
[Open in Google Docs] [Download PDF] [View in Projects]
```

**Error Handling:**
- Google Drive unavailable → Save locally + retry option
- OAuth fails → Clear instructions + re-authenticate button
- Upload fails → Document saved locally, retry upload later
- Network issues → Queue for background upload when online

**Future Enhancements (Post-MVP):**
- Interactive exam-taking UI within desktop app
- Auto-grading for objective questions (Multiple Choice, True/False, etc.)
- AI grading for subjective questions (Short Answer, Essay) with score + feedback
- Results storage in database with deletion option
- Retake functionality
- Result history with performance tracking

## Development Commands

### Running the App
```bash
npm run dev          # Start development mode (hot reload)
npm run build        # Build for production
npm run preview      # Preview production build
npm run package      # Create installer
```

### Code Quality
```bash
npm run typecheck    # Check TypeScript types
npm run lint         # Check code quality with ESLint
npm run format       # Format code with Prettier
```

## Project Structure (Current)

```
Qreate/
├── src/
│   ├── main/              # Electron main process (Node.js)
│   │   └── index.ts       # Main process entry point
│   ├── preload/           # Secure bridge between main and renderer
│   │   └── index.ts       # Preload script (IPC API)
│   ├── renderer/          # React application
│   │   ├── index.html     # HTML entry point
│   │   └── src/
│   │       ├── main.tsx   # React entry point
│   │       ├── App.tsx    # Root component
│   │       ├── index.css  # Global styles
│   │       ├── components/  # UI components (to be added)
│   │       ├── hooks/       # Custom React hooks (to be added)
│   │       └── store/       # State management (to be added)
│   └── shared/            # Code shared between main and renderer
│       ├── types/         # TypeScript definitions
│       │   └── electron.d.ts  # Window.electron types
│       └── utils/         # Utility functions (to be added)
├── .vscode/               # VS Code settings
├── dist/                  # Build output (git-ignored)
├── node_modules/          # Dependencies (git-ignored)
├── .eslintrc.json         # ESLint configuration
├── .prettierrc.json       # Prettier configuration
├── .gitignore             # Git ignore rules
├── electron.vite.config.ts  # Build configuration
├── package.json           # Project metadata and scripts
└── tsconfig.json          # TypeScript configuration
```
