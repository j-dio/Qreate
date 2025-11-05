/**
 * Exam Configuration Store (Zustand)
 *
 * Manages the exam configuration state during the exam creation workflow.
 *
 * This store handles:
 * - Question type selection and quantities
 * - Difficulty distribution
 * - Other exam parameters
 *
 * State Flow:
 * Step 1: Files uploaded (useFileUploadStore)
 * Step 2: Question types configured (THIS STORE)
 * Step 3: Difficulty distribution set (THIS STORE)
 * Step 4: Review and confirm
 * Step 5: Generate exam
 *
 * Why separate from useFileUploadStore?
 * - Different lifecycle (config persists across steps)
 * - Clear separation of concerns
 * - Easier to validate and manage
 */

import { create } from 'zustand'

/**
 * Question Type Enum
 *
 * All supported question types from CLAUDE.md:
 * - Multiple Choice
 * - True/False
 * - Fill in the Blanks
 * - Short Answer
 * - Essay
 * - Matching
 * - Identification
 */
export type QuestionType =
  | 'multipleChoice'
  | 'trueFalse'
  | 'fillInTheBlanks'
  | 'shortAnswer'
  | 'essay'
  | 'matching'
  | 'identification'

/**
 * Question Type Configuration
 *
 * Maps internal type names to display-friendly labels
 */
export const QUESTION_TYPES: Record<
  QuestionType,
  {
    label: string
    description: string
    icon: string
  }
> = {
  multipleChoice: {
    label: 'Multiple Choice',
    description: 'Questions with multiple answer options, one correct answer',
    icon: '✓',
  },
  trueFalse: {
    label: 'True/False',
    description: 'Questions with true or false answers',
    icon: '⚖',
  },
  fillInTheBlanks: {
    label: 'Fill in the Blanks',
    description: 'Questions with missing words to complete',
    icon: '___',
  },
  shortAnswer: {
    label: 'Short Answer',
    description: 'Questions requiring brief written responses',
    icon: '✍',
  },
  essay: {
    label: 'Essay',
    description: 'Questions requiring detailed written responses',
    icon: '📝',
  },
  matching: {
    label: 'Matching',
    description: 'Match items from two columns',
    icon: '⇄',
  },
  identification: {
    label: 'Identification',
    description: 'Identify or name specific items',
    icon: '🔍',
  },
}

/**
 * Difficulty Level Type
 */
export type DifficultyLevel = 'veryEasy' | 'easy' | 'moderate' | 'hard' | 'veryHard'

/**
 * Difficulty Configuration
 */
export const DIFFICULTY_LEVELS: Record<
  DifficultyLevel,
  {
    label: string
    description: string
    color: string
  }
> = {
  veryEasy: {
    label: 'Very Easy',
    description: 'Basic recall and comprehension',
    color: 'bg-green-500',
  },
  easy: {
    label: 'Easy',
    description: 'Simple application of concepts',
    color: 'bg-blue-500',
  },
  moderate: {
    label: 'Moderate',
    description: 'Standard understanding required',
    color: 'bg-yellow-500',
  },
  hard: {
    label: 'Hard',
    description: 'Complex analysis and synthesis',
    color: 'bg-orange-500',
  },
  veryHard: {
    label: 'Very Hard',
    description: 'Advanced critical thinking',
    color: 'bg-red-500',
  },
}

/**
 * Validation Rules
 *
 * Updated for Groq backend integration:
 * - MAX_TOTAL_ITEMS reduced from 200 to 100 (proven reliable with Groq)
 * - Tested with 30, 50, and 100 item exams (100% success rate)
 */
export const EXAM_CONFIG_RULES = {
  MIN_TOTAL_ITEMS: 10,
  MAX_TOTAL_ITEMS: 100, // Changed from 200 to 100 for Groq reliability
  MIN_ITEMS_PER_TYPE: 0,
  MAX_ITEMS_PER_TYPE: 100, // Changed from 200 to 100
}

/**
 * Exam Configuration State
 */
interface ExamConfigState {
  // Question Types State
  questionTypes: Record<QuestionType, number>

  // Difficulty Distribution State (quantities per level)
  difficultyDistribution: Record<DifficultyLevel, number>

  // Computed values
  getTotalQuestions: () => number
  getTotalDifficulty: () => number

  // Question Type Actions
  setQuestionTypeQuantity: (type: QuestionType, quantity: number) => void
  resetQuestionTypes: () => void

  // Difficulty Actions
  setDifficultyQuantity: (level: DifficultyLevel, quantity: number) => void
  autoDistributeDifficulty: (total: number) => void
  resetDifficulty: () => void

  // Validation
  isQuestionTypesValid: () => boolean
  isDifficultyValid: () => boolean

  // Reset all
  resetAll: () => void
}

/**
 * Initial state for question types (all set to 0)
 */
const initialQuestionTypes: Record<QuestionType, number> = {
  multipleChoice: 0,
  trueFalse: 0,
  fillInTheBlanks: 0,
  shortAnswer: 0,
  essay: 0,
  matching: 0,
  identification: 0,
}

/**
 * Initial state for difficulty distribution (all set to 0)
 */
const initialDifficultyDistribution: Record<DifficultyLevel, number> = {
  veryEasy: 0,
  easy: 0,
  moderate: 0,
  hard: 0,
  veryHard: 0,
}

/**
 * Create the Exam Config Store
 *
 * Note: We're NOT persisting this store because:
 * - It's temporary workflow state
 * - User can always reconfigure from scratch
 * - Cleaner to reset between sessions
 */
export const useExamConfigStore = create<ExamConfigState>((set, get) => ({
  // Initial state
  questionTypes: initialQuestionTypes,
  difficultyDistribution: initialDifficultyDistribution,

  /**
   * Get total number of questions configured
   */
  getTotalQuestions: () => {
    const state = get()
    return Object.values(state.questionTypes).reduce((sum, qty) => sum + qty, 0)
  },

  /**
   * Get total difficulty points allocated
   */
  getTotalDifficulty: () => {
    const state = get()
    return Object.values(state.difficultyDistribution).reduce((sum, qty) => sum + qty, 0)
  },

  /**
   * Set quantity for a specific question type
   *
   * Validation:
   * - Quantity must be >= 0
   * - Quantity must be <= MAX_ITEMS_PER_TYPE
   * - Total must be <= MAX_TOTAL_ITEMS
   */
  setQuestionTypeQuantity: (type, quantity) =>
    set((state) => {
      // Validate quantity
      const validQuantity = Math.max(
        0,
        Math.min(quantity, EXAM_CONFIG_RULES.MAX_ITEMS_PER_TYPE)
      )

      // Calculate new total
      const newQuestionTypes = {
        ...state.questionTypes,
        [type]: validQuantity,
      }
      const newTotal = Object.values(newQuestionTypes).reduce((sum, qty) => sum + qty, 0)

      // Don't allow total to exceed max
      if (newTotal > EXAM_CONFIG_RULES.MAX_TOTAL_ITEMS) {
        return state // No change
      }

      return {
        questionTypes: newQuestionTypes,
      }
    }),

  /**
   * Reset all question types to 0
   */
  resetQuestionTypes: () =>
    set({
      questionTypes: initialQuestionTypes,
    }),

  /**
   * Set quantity for a specific difficulty level
   */
  setDifficultyQuantity: (level, quantity) =>
    set((state) => ({
      difficultyDistribution: {
        ...state.difficultyDistribution,
        [level]: Math.max(0, quantity),
      },
    })),

  /**
   * Auto-distribute difficulty based on default percentages
   *
   * Default distribution from CLAUDE.md:
   * - Very Easy: 20%
   * - Easy: 20%
   * - Moderate: 30%
   * - Hard: 20%
   * - Very Hard: 10%
   */
  autoDistributeDifficulty: (total) => {
    const veryEasy = Math.round(total * 0.2)
    const easy = Math.round(total * 0.2)
    const moderate = Math.round(total * 0.3)
    const hard = Math.round(total * 0.2)

    // Calculate veryHard as remainder to ensure exact total
    const veryHard = total - (veryEasy + easy + moderate + hard)

    set({
      difficultyDistribution: {
        veryEasy,
        easy,
        moderate,
        hard,
        veryHard,
      },
    })
  },

  /**
   * Reset difficulty distribution to 0
   */
  resetDifficulty: () =>
    set({
      difficultyDistribution: initialDifficultyDistribution,
    }),

  /**
   * Validate question types configuration
   *
   * Valid if:
   * - Total questions >= MIN_TOTAL_ITEMS (10)
   * - Total questions <= MAX_TOTAL_ITEMS (100)
   * - At least one question type has quantity > 0
   */
  isQuestionTypesValid: () => {
    const total = get().getTotalQuestions()
    return (
      total >= EXAM_CONFIG_RULES.MIN_TOTAL_ITEMS &&
      total <= EXAM_CONFIG_RULES.MAX_TOTAL_ITEMS
    )
  },

  /**
   * Validate difficulty distribution
   *
   * Valid if:
   * - Total difficulty equals total questions exactly
   */
  isDifficultyValid: () => {
    const totalQuestions = get().getTotalQuestions()
    const totalDifficulty = get().getTotalDifficulty()
    return totalDifficulty === totalQuestions
  },

  /**
   * Reset everything
   */
  resetAll: () =>
    set({
      questionTypes: initialQuestionTypes,
      difficultyDistribution: initialDifficultyDistribution,
    }),
}))
