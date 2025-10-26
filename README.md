# Qreate

An automated test creator desktop app that generates customized review exams from study materials using AI.

## Features (Planned)

- 📁 Upload study materials (PDF, DOCX, TXT, images)
- 🤖 AI-powered exam generation using ChatGPT
- 📝 Multiple exam types: Multiple Choice, True/False, Fill-in-the-Blank, Short Answer, Essay, Matching, Identification
- 🎯 Customizable difficulty distribution
- 📄 Automatic export to Google Docs and PDF
- 💾 Project history and management
- 🔄 Re-generate and customize existing exams

## Tech Stack

- **Desktop Framework**: Electron
- **Frontend**: React + TypeScript
- **Build Tool**: Vite (via electron-vite)
- **State Management**: Zustand + XState
- **Database**: SQLite
- **APIs**: OpenAI (ChatGPT), Google Drive, Google Docs
- **Testing**: Vitest + Playwright

## Development Setup

### Prerequisites

- Node.js 18+ and npm
- Git

### Installation

```bash
# Clone the repository
git clone https://github.com/j-dio/Qreate.git
cd Qreate

# Install dependencies
npm install

# Start development server
npm run dev
```

### Available Scripts

- `npm run dev` - Start development mode with hot reload
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run typecheck` - Check TypeScript types
- `npm run lint` - Lint code with ESLint
- `npm run format` - Format code with Prettier
- `npm run package` - Create installer (.exe, .dmg, etc.)

## Project Status

🚧 **In Active Development** - Foundation complete, implementing core features.

See [CLAUDE.md](./CLAUDE.md) for detailed architecture and development notes.

## License

MIT
