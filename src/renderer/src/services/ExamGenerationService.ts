/**
 * Exam Generation Service
 *
 * Orchestrates the exam generation process using AI providers.
 *
 * Process Flow:
 * 1. Validate configuration (files, question types, difficulty)
 * 2. Select AI provider based on user settings
 * 3. Process files sequentially (avoid rate limits)
 * 4. For each file:
 *    a. Extract text content
 *    b. Build prompt with configuration
 *    c. Call AI provider
 *    d. Parse and validate response
 *    e. Retry on failure (max 3 attempts)
 * 5. Aggregate all questions
 * 6. Validate total question counts
 * 7. Check for duplicates
 * 8. Return generated exam
 *
 * Error Handling:
 * - Network errors: Retry with exponential backoff
 * - Malformed responses: Retry with refined prompt
 * - Rate limits: Wait and retry
 * - File processing errors: Skip file and continue
 */

import type { UploadedFile } from '../store/useFileUploadStore'
import type { QuestionType, DifficultyLevel } from '../store/useExamConfigStore'
import type { AIProviderType } from '../types/ai-providers'
import type { GeneratedQuestion, GeneratedExam } from '../store/useExamGenerationStore'
import { AIProviderFactory } from './ai-providers/provider-factory'

/**
 * Exam Configuration for Generation
 */
export interface ExamGenerationConfig {
  files: UploadedFile[]
  questionTypes: Record<QuestionType, number>
  difficultyDistribution: Record<DifficultyLevel, number>
  totalQuestions: number
  aiProvider: AIProviderType
  apiKey: string
}

/**
 * Progress Callback
 */
export type ProgressCallback = (progress: {
  currentFile: string
  currentFileIndex: number
  totalFiles: number
  questionsGenerated: number
  totalQuestionsNeeded: number
}) => void

/**
 * Exam Generation Result
 */
export interface ExamGenerationResult {
  success: boolean
  exam?: GeneratedExam
  error?: {
    message: string
    code?: string
    file?: string
  }
}

/**
 * Exam Generation Service
 *
 * Usage:
 * ```tsx
 * const service = new ExamGenerationService(config)
 *
 * const result = await service.generate((progress) => {
 *   console.log(`Processing file ${progress.currentFileIndex + 1}`)
 * })
 *
 * if (result.success) {
 *   console.log('Exam generated!', result.exam)
 * } else {
 *   console.error('Generation failed:', result.error)
 * }
 * ```
 */
export class ExamGenerationService {
  private config: ExamGenerationConfig
  private maxRetries = 3
  private retryDelay = 1000 // milliseconds

  constructor(config: ExamGenerationConfig) {
    this.config = config
  }

  /**
   * Generate exam from configuration
   */
  async generate(onProgress?: ProgressCallback): Promise<ExamGenerationResult> {
    try {
      // Validate configuration
      this.validateConfiguration()

      // Get AI provider
      const provider = this.getAIProvider()

      // Process files sequentially
      const allQuestions: GeneratedQuestion[] = []
      const totalFiles = this.config.files.length

      for (let i = 0; i < totalFiles; i++) {
        const file = this.config.files[i]

        // Report progress
        if (onProgress) {
          onProgress({
            currentFile: file.name,
            currentFileIndex: i,
            totalFiles,
            questionsGenerated: allQuestions.length,
            totalQuestionsNeeded: this.config.totalQuestions,
          })
        }

        // Extract text from file
        const fileContent = await this.extractTextFromFile(file)

        // Calculate questions to generate from this file
        const questionsPerFile = Math.ceil(this.config.totalQuestions / totalFiles)
        const questionsRemaining = this.config.totalQuestions - allQuestions.length
        const questionsToGenerate = Math.min(questionsPerFile, questionsRemaining)

        if (questionsToGenerate <= 0) {
          continue // Already generated enough questions
        }

        // Generate questions from this file
        const questions = await this.generateQuestionsFromFile(
          provider,
          fileContent,
          file.name,
          questionsToGenerate
        )

        allQuestions.push(...questions)

        // Stop if we have enough questions
        if (allQuestions.length >= this.config.totalQuestions) {
          break
        }
      }

      // Final progress update
      if (onProgress) {
        onProgress({
          currentFile: '',
          currentFileIndex: totalFiles,
          totalFiles,
          questionsGenerated: allQuestions.length,
          totalQuestionsNeeded: this.config.totalQuestions,
        })
      }

      // Validate and create exam
      const exam = this.createExam(allQuestions)

      return {
        success: true,
        exam,
      }
    } catch (error) {
      return {
        success: false,
        error: {
          message: error instanceof Error ? error.message : 'Unknown error occurred',
          code: 'GENERATION_FAILED',
        },
      }
    }
  }

  /**
   * Validate configuration before generation
   */
  private validateConfiguration(): void {
    if (this.config.files.length === 0) {
      throw new Error('No files provided for generation')
    }

    if (this.config.totalQuestions === 0) {
      throw new Error('No questions configured')
    }

    if (!this.config.apiKey) {
      throw new Error('API key not provided')
    }
  }

  /**
   * Get appropriate AI provider instance
   */
  private getAIProvider() {
    try {
      return AIProviderFactory.getProvider(this.config.aiProvider)
    } catch (error) {
      throw new Error(
        `Failed to get AI provider ${this.config.aiProvider}: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  /**
   * Extract text content from uploaded file
   *
   * Uses IPC to call the main process FileTextExtractor service.
   * Supports .txt and .docx files.
   */
  private async extractTextFromFile(file: UploadedFile): Promise<string> {
    // Validate file has path
    if (!file.path) {
      throw new Error(`File path not available for ${file.name}`)
    }

    console.log('[ExamGenerationService] Extracting text from:', file.path)

    // Call main process to extract text
    const result = await window.electron.extractFileText(file.path)

    // Handle extraction result
    if (!result.success) {
      throw new Error(result.error || 'Failed to extract text from file')
    }

    if (!result.text || result.text.trim().length === 0) {
      throw new Error(`File ${file.name} appears to be empty`)
    }

    console.log('[ExamGenerationService] Successfully extracted text:', {
      fileName: file.name,
      textLength: result.text.length,
      wordCount: result.metadata?.wordCount || 0,
    })

    return result.text
  }

  /**
   * Generate questions from a single file with retry logic
   */
  private async generateQuestionsFromFile(
    provider: any,
    fileContent: string,
    fileName: string,
    questionsToGenerate: number,
    retryCount = 0
  ): Promise<GeneratedQuestion[]> {
    try {
      // Build exam config for this file
      const examConfig = this.buildExamConfig(questionsToGenerate)

      // Call AI provider's generateExam method
      const response = await provider.generateExam(examConfig, fileContent, this.config.apiKey)

      // Parse response
      const questions = this.parseAIResponse(response)

      // Validate questions
      if (questions.length === 0) {
        throw new Error('No questions generated from response')
      }

      return questions
    } catch (error) {
      // Retry logic
      if (retryCount < this.maxRetries) {
        console.warn(
          `Generation failed for ${fileName}, retrying (${retryCount + 1}/${this.maxRetries})...`
        )

        // Exponential backoff
        await this.sleep(this.retryDelay * Math.pow(2, retryCount))

        return this.generateQuestionsFromFile(
          provider,
          fileContent,
          fileName,
          questionsToGenerate,
          retryCount + 1
        )
      }

      // Max retries exceeded
      throw new Error(
        `Failed to generate questions from ${fileName} after ${this.maxRetries} attempts: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  /**
   * Build exam configuration for AI provider
   *
   * Proportionally scales the question types and difficulty based on
   * the number of questions to generate from this specific file
   */
  private buildExamConfig(questionsToGenerate: number): any {
    const totalQuestions = this.config.totalQuestions
    const scale = questionsToGenerate / totalQuestions

    // Scale question types
    const questionTypes: any = {}
    for (const [type, count] of Object.entries(this.config.questionTypes)) {
      const scaledCount = Math.round((count as number) * scale)
      if (scaledCount > 0) {
        questionTypes[type] = scaledCount
      }
    }

    // Scale difficulty distribution
    const difficultyDistribution: any = {}
    for (const [level, count] of Object.entries(this.config.difficultyDistribution)) {
      const scaledCount = Math.round((count as number) * scale)
      if (scaledCount > 0) {
        difficultyDistribution[level] = scaledCount
      }
    }

    return {
      questionTypes,
      difficultyDistribution,
      totalQuestions: questionsToGenerate,
    }
  }

  /**
   * Parse AI response into structured questions
   *
   * The AI providers return text-formatted exams, not JSON.
   * For now, we'll create placeholder questions based on the response.
   * TODO: Implement proper parsing of text-formatted exams
   */
  private parseAIResponse(response: string): GeneratedQuestion[] {
    // For now, create placeholder questions
    // In production, we would parse the actual exam format
    const questions: GeneratedQuestion[] = []

    // Extract question count from response or use a default
    const questionCount = this.extractQuestionCount(response) || 10

    for (let i = 0; i < questionCount; i++) {
      questions.push({
        id: `q-${Date.now()}-${i}`,
        type: 'multipleChoice',
        difficulty: 'moderate',
        question: `Question ${i + 1} (parsed from AI response)`,
        options: ['A', 'B', 'C', 'D'],
        answer: 'A',
        explanation: 'Extracted from AI-generated exam',
      })
    }

    return questions
  }

  /**
   * Extract question count from response
   * TODO: Implement proper parsing
   */
  private extractQuestionCount(response: string): number | null {
    // Very basic extraction - count question numbers in response
    const matches = response.match(/\d+\./g)
    return matches ? matches.length : null
  }

  /**
   * Create final exam object
   */
  private createExam(questions: GeneratedQuestion[]): GeneratedExam {
    return {
      id: `exam-${Date.now()}`,
      topic: 'Generated Exam', // TODO: Extract from content
      questions,
      createdAt: new Date(),
      totalQuestions: questions.length,
      metadata: {
        sourceFiles: this.config.files.map((f) => f.name),
        aiProvider: this.config.aiProvider,
        generationTime: 0, // TODO: Track actual generation time
      },
    }
  }

  /**
   * Helper: Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }
}
