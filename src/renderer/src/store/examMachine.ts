/**
 * Exam Creation Workflow State Machine (XState)
 *
 * This state machine manages the multi-step exam creation process.
 *
 * Why XState?
 * - Makes complex workflows explicit and visualizable
 * - Prevents impossible states (can't be in two states at once)
 * - Built-in error handling and transitions
 * - Perfect for our 6-phase exam creation flow
 *
 * Workflow Phases:
 * 1. uploadFiles - User uploads study materials
 * 2. selectExamTypes - Choose exam types and quantities
 * 3. setDifficulty - Set difficulty distribution
 * 4. reviewConfig - Review and confirm settings
 * 5. generating - AI generates exams
 * 6. complete - Exams ready for download
 */

import { createMachine, assign } from 'xstate'

/**
 * Uploaded file interface
 */
export interface UploadedFile {
  id: string
  name: string
  size: number
  type: string
  path: string
  extractedText?: string
}

/**
 * Exam type configuration
 */
export interface ExamTypeConfig {
  multipleChoice: number
  trueFalse: number
  fillInBlanks: number
  shortAnswer: number
  essay: number
  matching: number
  identification: number
}

/**
 * Difficulty distribution
 */
export interface DifficultyConfig {
  veryEasy: number
  easy: number
  moderate: number
  hard: number
  veryHard: number
}

/**
 * Generated exam
 */
export interface GeneratedExam {
  id: string
  topic: string
  content: string
  answerKey: string
  googleDocsUrl?: string
  pdfUrl?: string
}

/**
 * State Machine Context
 * This is the "data" that flows through the state machine
 */
export interface ExamContext {
  files: UploadedFile[]
  examTypes: ExamTypeConfig
  difficulty: DifficultyConfig
  generatedExams: GeneratedExam[]
  error: string | null
}

/**
 * State Machine Events
 * These are the actions that can trigger state transitions
 */
export type ExamEvent =
  | { type: 'NEXT' }
  | { type: 'BACK' }
  | { type: 'RESET' }
  | { type: 'ADD_FILES'; files: UploadedFile[] }
  | { type: 'REMOVE_FILE'; fileId: string }
  | { type: 'SET_EXAM_TYPES'; examTypes: ExamTypeConfig }
  | { type: 'SET_DIFFICULTY'; difficulty: DifficultyConfig }
  | { type: 'GENERATE' }
  | { type: 'GENERATION_SUCCESS'; exams: GeneratedExam[] }
  | { type: 'GENERATION_ERROR'; error: string }
  | { type: 'RETRY' }
  | { type: 'DOWNLOAD' }

/**
 * Exam Creation State Machine
 */
export const examMachine = createMachine(
  {
    /** @xstate-layout N8IgpgJg5mDOIC5QAcBOB7AKgSwIYDsA6AYwAsBLAOzADoAbMAF1IIBYB1AbQAYBdRKPLlgA7ViAAeiALQBmABwBWAOwAmAIwAaEAE9EAZgCcADkWad6+YY0BfF1rRZc+IhVr0mLdk1bsAJswAqngCCAMLA4FAwCCh4hCTkKuraBCJa6pKGlqIA7IamehIGUgYANC4IWuWiKaIp6qKSTrrm1W4NbSA+HA */
    id: 'examCreation',
    initial: 'uploadFiles',
    context: {
      files: [],
      examTypes: {
        multipleChoice: 0,
        trueFalse: 0,
        fillInBlanks: 0,
        shortAnswer: 0,
        essay: 0,
        matching: 0,
        identification: 0,
      },
      difficulty: {
        veryEasy: 0,
        easy: 0,
        moderate: 0,
        hard: 0,
        veryHard: 0,
      },
      generatedExams: [],
      error: null,
    } as ExamContext,
    states: {
      uploadFiles: {
        on: {
          ADD_FILES: {
            actions: 'addFiles',
          },
          REMOVE_FILE: {
            actions: 'removeFile',
          },
          NEXT: {
            target: 'selectExamTypes',
            guard: 'hasFiles',
          },
        },
      },
      selectExamTypes: {
        on: {
          SET_EXAM_TYPES: {
            actions: 'setExamTypes',
          },
          BACK: 'uploadFiles',
          NEXT: {
            target: 'setDifficulty',
            guard: 'hasExamTypes',
          },
        },
      },
      setDifficulty: {
        on: {
          SET_DIFFICULTY: {
            actions: 'setDifficulty',
          },
          BACK: 'selectExamTypes',
          NEXT: {
            target: 'reviewConfig',
            guard: 'difficultyMatchesTotal',
          },
        },
      },
      reviewConfig: {
        on: {
          BACK: 'setDifficulty',
          GENERATE: 'generating',
        },
      },
      generating: {
        invoke: {
          id: 'generateExams',
          src: 'generateExams',
          onDone: {
            target: 'complete',
            actions: 'setGeneratedExams',
          },
          onError: {
            target: 'error',
            actions: 'setError',
          },
        },
      },
      complete: {
        on: {
          DOWNLOAD: {
            actions: 'downloadExams',
          },
          RESET: 'uploadFiles',
        },
      },
      error: {
        on: {
          RETRY: 'generating',
          BACK: 'reviewConfig',
          RESET: 'uploadFiles',
        },
      },
    },
  },
  {
    actions: {
      addFiles: assign({
        files: ({ context, event }) => {
          if (event.type !== 'ADD_FILES') return context.files
          return [...context.files, ...event.files]
        },
      }),
      removeFile: assign({
        files: ({ context, event }) => {
          if (event.type !== 'REMOVE_FILE') return context.files
          return context.files.filter((f) => f.id !== event.fileId)
        },
      }),
      setExamTypes: assign({
        examTypes: ({ event }) => {
          if (event.type !== 'SET_EXAM_TYPES') return {} as ExamTypeConfig
          return event.examTypes
        },
      }),
      setDifficulty: assign({
        difficulty: ({ event }) => {
          if (event.type !== 'SET_DIFFICULTY') return {} as DifficultyConfig
          return event.difficulty
        },
      }),
      setGeneratedExams: assign({
        generatedExams: ({ event }) => {
          // @ts-expect-error - XState onDone event structure
          return event.output
        },
      }),
      setError: assign({
        error: ({ event }) => {
          // @ts-expect-error - XState onError event structure
          return event.error.message || 'An error occurred'
        },
      }),
      downloadExams: () => {
        // Will implement download logic later
        console.log('Downloading exams...')
      },
    },
    guards: {
      hasFiles: ({ context }) => context.files.length > 0 && context.files.length <= 5,
      hasExamTypes: ({ context }) => {
        const total = Object.values(context.examTypes).reduce((sum, val) => sum + val, 0)
        return total >= 10 && total <= 200
      },
      difficultyMatchesTotal: ({ context }) => {
        const examTotal = Object.values(context.examTypes).reduce((sum, val) => sum + val, 0)
        const difficultyTotal = Object.values(context.difficulty).reduce(
          (sum, val) => sum + val,
          0
        )
        return examTotal === difficultyTotal
      },
    },
    actors: {
      // Placeholder - will implement actual API call later
      generateExams: async ({ context }) => {
        // Simulate API call
        await new Promise((resolve) => setTimeout(resolve, 2000))
        return [
          {
            id: '1',
            topic: 'Sample Topic',
            content: 'Sample exam content',
            answerKey: 'Sample answers',
          },
        ] as GeneratedExam[]
      },
    },
  }
)
