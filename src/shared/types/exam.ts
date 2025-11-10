/**
 * Shared Exam Types
 * 
 * Type definitions for exam structure used across main and renderer processes.
 * These types ensure consistency between exam generation, validation, and display.
 */

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
 * Question Type Union for Type Guards
 */
export type QuestionType = GeneratedQuestion['type']

/**
 * Difficulty Level Union for Type Guards  
 */
export type DifficultyLevel = GeneratedQuestion['difficulty']