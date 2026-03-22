/**
 * Exam Configuration Store (Zustand)
 *
 * Manages the exam configuration state during the exam creation workflow.
 *
 * This store handles:
 * - Question type selection (checkboxes — which types are allowed)
 * - Total question cap (AI will generate up to this many)
 * - Difficulty distribution
 *
 * State Flow:
 * Step 1: Files uploaded (useFileUploadStore)
 * Step 2: Question types configured (THIS STORE)
 * Step 3: Difficulty distribution set (THIS STORE)
 * Step 4: Review and confirm
 * Step 5: Generate exam
 */

import { create } from 'zustand'

/**
 * Question Type Enum
 */
export type QuestionType =
  | 'multipleChoice'
  | 'trueFalse'
  | 'fillInTheBlanks'
  | 'shortAnswer'

/**
 * Question Type Configuration
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
    icon: 'check-circle',
  },
  trueFalse: {
    label: 'True/False',
    description: 'Questions with true or false answers',
    icon: 'scale',
  },
  fillInTheBlanks: {
    label: 'Fill in the Blanks',
    description: 'Questions with missing words to complete',
    icon: 'text-cursor',
  },
  shortAnswer: {
    label: 'Short Answer',
    description: 'Questions requiring brief written responses',
    icon: 'pencil',
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
 */
export const EXAM_CONFIG_RULES = {
  MIN_TOTAL_ITEMS: 10,
  MAX_TOTAL_ITEMS: 50,
}

/**
 * Exam Configuration State
 */
interface ExamConfigState {
  // Which question types are allowed (AI picks the best fit per concept)
  questionTypes: Record<QuestionType, boolean>

  // Total question cap sent to the AI
  totalQuestions: number

  // Difficulty Distribution State (quantities per level)
  difficultyDistribution: Record<DifficultyLevel, number>

  // Computed values
  getTotalQuestions: () => number
  getTotalDifficulty: () => number

  // Question Type Actions
  setQuestionTypeEnabled: (type: QuestionType, enabled: boolean) => void
  resetQuestionTypes: () => void

  // Total Questions Action
  setTotalQuestions: (n: number) => void

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
 * Initial state for question types
 */
const initialQuestionTypes: Record<QuestionType, boolean> = {
  multipleChoice: true,
  trueFalse: true,
  fillInTheBlanks: false,
  shortAnswer: false,
}

const initialTotalQuestions = 20

/**
 * Bell-curve difficulty distribution.
 *
 * Target: ~10% veryEasy, 10% easy, 60% moderate, 10% hard, 10% veryHard.
 * The four outer buckets are computed with Math.round; moderate absorbs the
 * remainder so the sum is ALWAYS exactly `total` regardless of rounding.
 */
function bellCurveDistribution(total: number): Record<DifficultyLevel, number> {
  const veryEasy = Math.round(total * 0.1)
  const easy = Math.round(total * 0.1)
  const hard = Math.round(total * 0.1)
  const veryHard = Math.round(total * 0.1)
  const moderate = total - (veryEasy + easy + hard + veryHard)
  return { veryEasy, easy, moderate, hard, veryHard }
}

/**
 * Initial difficulty distribution — pre-populated for the default total (20).
 */
const initialDifficultyDistribution = bellCurveDistribution(initialTotalQuestions)

export const useExamConfigStore = create<ExamConfigState>((set, get) => ({
  // Initial state
  questionTypes: initialQuestionTypes,
  totalQuestions: initialTotalQuestions,
  difficultyDistribution: initialDifficultyDistribution,

  /**
   * Get total question cap
   */
  getTotalQuestions: () => get().totalQuestions,

  /**
   * Get total difficulty points allocated
   */
  getTotalDifficulty: () => {
    const state = get()
    return Object.values(state.difficultyDistribution).reduce((sum, qty) => sum + qty, 0)
  },

  /**
   * Toggle a question type on or off
   */
  setQuestionTypeEnabled: (type, enabled) =>
    set(state => ({
      questionTypes: {
        ...state.questionTypes,
        [type]: enabled,
      },
    })),

  /**
   * Reset all question types to defaults
   */
  resetQuestionTypes: () =>
    set({
      questionTypes: initialQuestionTypes,
      totalQuestions: initialTotalQuestions,
      difficultyDistribution: bellCurveDistribution(initialTotalQuestions),
    }),

  /**
   * Set the total question cap and immediately auto-distribute difficulty.
   */
  setTotalQuestions: (n: number) => {
    const clamped = Math.max(
      EXAM_CONFIG_RULES.MIN_TOTAL_ITEMS,
      Math.min(EXAM_CONFIG_RULES.MAX_TOTAL_ITEMS, n)
    )
    set({ totalQuestions: clamped, difficultyDistribution: bellCurveDistribution(clamped) })
  },

  /**
   * Set quantity for a specific difficulty level
   */
  setDifficultyQuantity: (level, quantity) =>
    set(state => ({
      difficultyDistribution: {
        ...state.difficultyDistribution,
        [level]: Math.max(0, quantity),
      },
    })),

  /**
   * Auto-distribute difficulty using the bell curve.
   */
  autoDistributeDifficulty: total => {
    set({ difficultyDistribution: bellCurveDistribution(total) })
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
   * - At least one type is enabled
   * - totalQuestions is within [MIN, MAX]
   */
  isQuestionTypesValid: () => {
    const state = get()
    const anyEnabled = Object.values(state.questionTypes).some(v => v)
    const total = state.totalQuestions
    return (
      anyEnabled &&
      total >= EXAM_CONFIG_RULES.MIN_TOTAL_ITEMS &&
      total <= EXAM_CONFIG_RULES.MAX_TOTAL_ITEMS
    )
  },

  /**
   * Validate difficulty distribution
   *
   * Valid if total difficulty equals totalQuestions exactly
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
      totalQuestions: initialTotalQuestions,
      difficultyDistribution: bellCurveDistribution(initialTotalQuestions),
    }),
}))
