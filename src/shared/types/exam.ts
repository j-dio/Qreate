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
 * Supports 4 question types for the two-pass PFQS generation architecture.
 */
export interface GeneratedQuestion {
  id: string
  type: 'multipleChoice' | 'trueFalse' | 'fillInTheBlanks' | 'shortAnswer'
  difficulty: 'veryEasy' | 'easy' | 'moderate' | 'hard' | 'veryHard'
  question: string
  options?: string[] // For multiple choice
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
 * Restricted to 4 types supported by the two-pass PFQS architecture.
 */
export type QuestionType = 'multipleChoice' | 'trueFalse' | 'fillInTheBlanks' | 'shortAnswer'

/**
 * Difficulty Level Union for Type Guards
 */
export type DifficultyLevel = GeneratedQuestion['difficulty']

/**
 * Concept Assignment for Pass 1 (Topic Plan) output.
 * Each concept maps to exactly one question in Pass 2.
 * Uses 3-level difficulty to simplify the planning prompt.
 */
export interface ConceptAssignment {
  id: number
  concept: string
  type: 'multipleChoice' | 'trueFalse' | 'fillInTheBlanks' | 'shortAnswer'
  difficulty: 'easy' | 'moderate' | 'hard'
  bloomLevel: 'remember' | 'understand' | 'apply' | 'analyze' | 'evaluate'
  answerPosition?: 'A' | 'B' | 'C' | 'D' // For MCQ answer distribution control
}

/**
 * Topic Plan interface — output of Pass 1 (planning pass).
 * Validated with Zod before being passed to Pass 2 (generation pass).
 */
export interface TopicPlan {
  topic: string
  totalConcepts: number
  concepts: ConceptAssignment[]
}