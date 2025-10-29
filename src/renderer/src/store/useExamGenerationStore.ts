/**
 * Exam Generation Store
 *
 * Manages the state of exam generation process.
 *
 * State Machine:
 * - idle: Initial state, no generation in progress
 * - processing: Currently generating exam from files
 * - validating: Validating generated content
 * - completed: Generation successful
 * - error: Generation failed
 *
 * Features:
 * - Progress tracking (current file, questions generated)
 * - Error handling with retry capability
 * - Generated exam storage
 * - Time tracking (start time, estimated completion)
 */

import { create } from 'zustand'

/**
 * Generation State Machine
 */
export type GenerationStatus = 'idle' | 'processing' | 'validating' | 'completed' | 'error'

/**
 * Generated Question Structure
 *
 * This matches the expected output format from AI providers.
 */
export interface GeneratedQuestion {
  id: string
  type:
    | 'multipleChoice'
    | 'trueFalse'
    | 'fillInTheBlanks'
    | 'shortAnswer'
    | 'essay'
    | 'matching'
    | 'identification'
  difficulty: 'veryEasy' | 'easy' | 'moderate' | 'hard' | 'veryHard'
  question: string
  options?: string[] // For multiple choice, matching
  answer: string | string[] // Single answer or multiple answers
  points?: number // Optional points value
  explanation?: string // Optional explanation for answer
}

/**
 * Generated Exam Structure
 */
export interface GeneratedExam {
  id: string
  topic: string // Auto-extracted from content
  questions: GeneratedQuestion[]
  createdAt: Date
  totalQuestions: number
  metadata: {
    sourceFiles: string[]
    aiProvider: string
    generationTime: number // milliseconds
  }
}

/**
 * Progress Tracking
 */
interface GenerationProgress {
  currentFile: string | null
  currentFileIndex: number
  totalFiles: number
  questionsGenerated: number
  totalQuestionsNeeded: number
  startTime: number | null
  estimatedTimeRemaining: number | null // milliseconds
}

/**
 * Error Information
 */
interface GenerationError {
  message: string
  code?: string
  file?: string
  retryCount: number
  maxRetries: number
  canRetry: boolean
}

/**
 * Exam Generation Store State
 */
interface ExamGenerationStore {
  // Generation state
  status: GenerationStatus
  progress: GenerationProgress
  error: GenerationError | null

  // Generated data
  generatedExam: GeneratedExam | null
  rawResponses: string[] // Store raw AI responses for debugging

  // Actions
  startGeneration: () => void
  updateProgress: (progress: Partial<GenerationProgress>) => void
  setStatus: (status: GenerationStatus) => void
  setError: (error: GenerationError) => void
  setGeneratedExam: (exam: GeneratedExam) => void
  addRawResponse: (response: string) => void
  reset: () => void
  retryGeneration: () => void
}

/**
 * Initial state
 */
const initialProgress: GenerationProgress = {
  currentFile: null,
  currentFileIndex: 0,
  totalFiles: 0,
  questionsGenerated: 0,
  totalQuestionsNeeded: 0,
  startTime: null,
  estimatedTimeRemaining: null,
}

/**
 * Exam Generation Store
 *
 * Usage Example:
 * ```tsx
 * const { status, progress, startGeneration } = useExamGenerationStore()
 *
 * // Start generation
 * startGeneration()
 *
 * // Check progress
 * if (status === 'processing') {
 *   console.log(`Processing file ${progress.currentFileIndex + 1} of ${progress.totalFiles}`)
 * }
 * ```
 */
export const useExamGenerationStore = create<ExamGenerationStore>((set, get) => ({
  // Initial state
  status: 'idle',
  progress: initialProgress,
  error: null,
  generatedExam: null,
  rawResponses: [],

  // Actions
  startGeneration: () => {
    set({
      status: 'processing',
      error: null,
      generatedExam: null,
      rawResponses: [],
      progress: {
        ...initialProgress,
        startTime: Date.now(),
      },
    })
  },

  updateProgress: (progressUpdate) => {
    const currentProgress = get().progress

    // Calculate estimated time remaining
    let estimatedTimeRemaining = null
    if (currentProgress.startTime && progressUpdate.questionsGenerated) {
      const elapsed = Date.now() - currentProgress.startTime
      const questionsPerMs = progressUpdate.questionsGenerated / elapsed
      const questionsRemaining =
        currentProgress.totalQuestionsNeeded - progressUpdate.questionsGenerated
      estimatedTimeRemaining = questionsRemaining / questionsPerMs
    }

    set({
      progress: {
        ...currentProgress,
        ...progressUpdate,
        estimatedTimeRemaining,
      },
    })
  },

  setStatus: (status) => {
    set({ status })
  },

  setError: (error) => {
    set({
      status: 'error',
      error,
    })
  },

  setGeneratedExam: (exam) => {
    set({
      generatedExam: exam,
      status: 'completed',
    })
  },

  addRawResponse: (response) => {
    set((state) => ({
      rawResponses: [...state.rawResponses, response],
    }))
  },

  reset: () => {
    set({
      status: 'idle',
      progress: initialProgress,
      error: null,
      generatedExam: null,
      rawResponses: [],
    })
  },

  retryGeneration: () => {
    const { error } = get()
    if (error && error.canRetry) {
      set({
        status: 'processing',
        error: null,
      })
    }
  },
}))
