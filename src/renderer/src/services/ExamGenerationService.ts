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
import type { GeneratedQuestion, GeneratedExam } from '../../../shared/types/exam'
import { AIProviderFactory } from './ai-providers/provider-factory'
import { ExamParser } from '../../../shared/services/ExamParser'

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
  userId: number // Add user ID to config
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
 * Quality Metrics from Backend Validation
 */
export interface QualityMetrics {
  score: number // 0.0-1.0
  isValid: boolean
  metrics: {
    uniquenessScore: number
    accuracyScore: number
    difficultyScore: number
    coverageScore: number
  }
  duplicatesFound: number
  sourceIssues: number
  difficultyIssues: number
  recommendations: {
    shouldRegenerate: boolean
    improvements: string[]
    retryWithPromptChanges?: string[]
  }
}

/**
 * Exam Generation Result
 */
export interface ExamGenerationResult {
  success: boolean
  exam?: GeneratedExam
  qualityMetrics?: QualityMetrics
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
  private examParser: ExamParser

  constructor(config: ExamGenerationConfig) {
    this.config = config
    this.examParser = new ExamParser()
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
      const qualityMetricsArray: QualityMetrics[] = []
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
        const { questions, rawResponse, qualityMetrics } = await this.generateQuestionsFromFile(
          provider,
          fileContent,
          file.name,
          questionsToGenerate
        )

        allQuestions.push(...questions)

        // Collect quality metrics
        if (qualityMetrics) {
          qualityMetricsArray.push(qualityMetrics)
        }

        // Log raw response for debugging
        console.log('[ExamGenerationService] ========== RAW AI RESPONSE ==========')
        console.log(rawResponse)
        console.log('[ExamGenerationService] ========== END RAW RESPONSE ==========')
        console.log('[ExamGenerationService] Parsed questions:', questions)
        console.log('[ExamGenerationService] First question:', questions[0])

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

      // Aggregate quality metrics from all files
      const aggregatedQualityMetrics = this.aggregateQualityMetrics(qualityMetricsArray)

      return {
        success: true,
        exam,
        qualityMetrics: aggregatedQualityMetrics,
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
   *
   * UPDATED FOR GROQ BACKEND:
   * - Removed API key validation (backend-managed)
   */
  private validateConfiguration(): void {
    if (this.config.files.length === 0) {
      throw new Error('No files provided for generation')
    }

    if (this.config.totalQuestions === 0) {
      throw new Error('No questions configured')
    }

    // API key no longer required - Groq backend handles this
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
   *
   * UPDATED FOR GROQ BACKEND:
   * - Now uses Groq backend API directly (no user API keys needed)
   * - Backend handles rate limiting and retry logic
   * - User quotas enforced server-side
   */
  private async generateQuestionsFromFile(
    provider: any,
    fileContent: string,
    fileName: string,
    questionsToGenerate: number,
    retryCount = 0
  ): Promise<{ questions: GeneratedQuestion[]; rawResponse: string; qualityMetrics?: QualityMetrics }> {
    try {
      // Build exam config for this file
      const examConfig = this.buildExamConfig(questionsToGenerate)

      // GROQ BACKEND: Call backend Groq API instead of user-provided AI
      console.log('[ExamGenerationService] Using Groq backend for generation')
      const groqResult = await window.electron.groq.generateExam(examConfig, fileContent, this.config.userId)

      if (!groqResult.success) {
        throw new Error(groqResult.error || 'Groq generation failed')
      }

      const response = groqResult.content

      // Use structured exam data from backend if available
      let questions: GeneratedQuestion[]
      
      if (groqResult.exam && groqResult.exam.questions) {
        // Use pre-parsed and validated questions from backend
        questions = groqResult.exam.questions
        console.log('[ExamGenerationService] Using structured exam data from backend')
      } else {
        // Fallback: Parse response manually (legacy compatibility)
        questions = this.parseAIResponse(response)
        console.log('[ExamGenerationService] Using fallback parsing')
      }

      // Validate questions
      if (questions.length === 0) {
        throw new Error('No questions generated from response')
      }

      // Log quality metrics if available
      if (groqResult.qualityMetrics) {
        console.log('[ExamGenerationService] Quality metrics:', {
          score: groqResult.qualityMetrics.score.toFixed(3),
          duplicates: groqResult.qualityMetrics.duplicatesFound,
          sourceIssues: groqResult.qualityMetrics.sourceIssues,
          valid: groqResult.qualityMetrics.isValid,
        })
      }

      return { 
        questions, 
        rawResponse: response,
        qualityMetrics: groqResult.qualityMetrics 
      }
    } catch (error) {
      // Retry logic (only for non-quota errors)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      const isQuotaError = errorMessage.includes('limit reached') || errorMessage.includes('quota')

      if (retryCount < this.maxRetries && !isQuotaError) {
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

      // Max retries exceeded or quota error
      throw new Error(
        `Failed to generate questions from ${fileName}${!isQuotaError ? ` after ${this.maxRetries} attempts` : ''}: ${errorMessage}`
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
   * Uses ExamParser to convert AI's text-formatted exam into structured data.
   */
  private parseAIResponse(response: string): GeneratedQuestion[] {
    console.log('[ExamGenerationService] Parsing AI response...')

    try {
      // Use ExamParser to parse the text format
      const questions = this.examParser.parseExam(response)

      console.log('[ExamGenerationService] Successfully parsed', questions.length, 'questions')

      return questions
    } catch (error) {
      console.error('[ExamGenerationService] Parse error:', error)

      // Fallback: Create minimal placeholder if parsing fails completely
      console.warn('[ExamGenerationService] Falling back to basic extraction')

      return this.createFallbackQuestions(response)
    }
  }

  /**
   * Fallback: Create basic questions if parsing fails
   *
   * This is a last resort to avoid complete failure
   */
  private createFallbackQuestions(response: string): GeneratedQuestion[] {
    // Count questions by looking for numbered patterns
    const matches = response.match(/^\d+\./gm)
    const questionCount = matches ? Math.min(matches.length, this.config.totalQuestions) : 10

    console.log('[ExamGenerationService] Creating', questionCount, 'fallback questions')

    const questions: GeneratedQuestion[] = []

    for (let i = 0; i < questionCount; i++) {
      questions.push({
        id: `q-fallback-${i + 1}`,
        type: 'multipleChoice',
        difficulty: 'moderate',
        question: `Question ${i + 1} (AI response parsing failed - please review manually)`,
        options: ['Option A', 'Option B', 'Option C', 'Option D'],
        answer: 'A',
        explanation: 'Parsing failed - raw AI response should be reviewed',
      })
    }

    return questions
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
        sourceFiles: this.config.files.map(f => f.name),
        aiProvider: this.config.aiProvider,
        generationTime: 0, // TODO: Track actual generation time
      },
    }
  }

  /**
   * Aggregate quality metrics from multiple files/generations
   */
  private aggregateQualityMetrics(metricsArray: QualityMetrics[]): QualityMetrics | undefined {
    if (metricsArray.length === 0) {
      return undefined
    }

    // If only one set of metrics, return it directly
    if (metricsArray.length === 1) {
      return metricsArray[0]
    }

    // Aggregate metrics from multiple generations
    const totalMetrics = metricsArray.length
    const aggregated = {
      score: 0,
      isValid: true,
      metrics: {
        uniquenessScore: 0,
        accuracyScore: 0,
        difficultyScore: 0,
        coverageScore: 0,
      },
      duplicatesFound: 0,
      sourceIssues: 0,
      difficultyIssues: 0,
      recommendations: {
        shouldRegenerate: false,
        improvements: [] as string[],
        retryWithPromptChanges: [] as string[],
      },
    }

    // Average the scores
    for (const metrics of metricsArray) {
      aggregated.score += metrics.score
      aggregated.metrics.uniquenessScore += metrics.metrics.uniquenessScore
      aggregated.metrics.accuracyScore += metrics.metrics.accuracyScore
      aggregated.metrics.difficultyScore += metrics.metrics.difficultyScore
      aggregated.metrics.coverageScore += metrics.metrics.coverageScore
      
      // Sum the issue counts
      aggregated.duplicatesFound += metrics.duplicatesFound
      aggregated.sourceIssues += metrics.sourceIssues
      aggregated.difficultyIssues += metrics.difficultyIssues
      
      // Combine validity (all must be valid for overall validity)
      aggregated.isValid = aggregated.isValid && metrics.isValid
      
      // Collect unique improvements and recommendations
      metrics.recommendations.improvements.forEach(improvement => {
        if (!aggregated.recommendations.improvements.includes(improvement)) {
          aggregated.recommendations.improvements.push(improvement)
        }
      })
      
      if (metrics.recommendations.retryWithPromptChanges) {
        metrics.recommendations.retryWithPromptChanges.forEach(change => {
          if (!aggregated.recommendations.retryWithPromptChanges!.includes(change)) {
            aggregated.recommendations.retryWithPromptChanges!.push(change)
          }
        })
      }
      
      // Should regenerate if any file suggests regeneration
      aggregated.recommendations.shouldRegenerate = aggregated.recommendations.shouldRegenerate || metrics.recommendations.shouldRegenerate
    }

    // Average the scores
    aggregated.score /= totalMetrics
    aggregated.metrics.uniquenessScore /= totalMetrics
    aggregated.metrics.accuracyScore /= totalMetrics
    aggregated.metrics.difficultyScore /= totalMetrics
    aggregated.metrics.coverageScore /= totalMetrics

    console.log('[ExamGenerationService] Aggregated quality metrics:', {
      score: aggregated.score.toFixed(3),
      valid: aggregated.isValid,
      totalDuplicates: aggregated.duplicatesFound,
      totalSourceIssues: aggregated.sourceIssues,
    })

    return aggregated
  }

  /**
   * Helper: Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}
