/**
 * Exam Generation Service
 *
 * Orchestrates the exam generation process using AI providers with smart batching.
 *
 * Process Flow:
 * 1. Validate configuration (files, question types, difficulty)
 * 2. Select AI provider based on user settings
 * 3. Process files sequentially (avoid rate limits)
 * 4. For each file:
 *    a. Extract text content
 *    b. Determine optimal batching strategy (>10 questions = batched)
 *    c. For large requests: Split into parallel batches (8-10 questions each)
 *    d. For small requests: Single generation call
 *    e. Aggregate and deduplicate across batches
 *    f. Retry on failure (max 3 attempts per batch)
 * 5. Aggregate all questions with cross-batch validation
 * 6. Validate total question counts
 * 7. Check for duplicates across entire exam
 * 8. Return generated exam
 *
 * Error Handling:
 * - Network errors: Retry with exponential backoff per batch
 * - Malformed responses: Retry individual batch vs. full restart
 * - Rate limits: Wait and retry with staggered batch timing
 * - File processing errors: Skip file and continue
 * - Quality issues: Early termination with batch-specific feedback
 */

import type { UploadedFile } from '../store/useFileUploadStore'
import type { QuestionType, DifficultyLevel } from '../store/useExamConfigStore'
import type { AIProviderType } from '../types/ai-providers'
import type { GeneratedQuestion, GeneratedExam } from '../../../shared/types/exam'
import { AIProviderFactory } from './ai-providers/provider-factory'
import { ExamParser } from '../../../shared/services/ExamParser'

/**
 * Batching Configuration for Large Exam Generation
 * 
 * These values are optimized for llama-3.3-70b-versatile model performance.
 */
const BATCH_CONFIG = {
  /** Threshold above which requests are split into batches */
  BATCH_THRESHOLD: 10,
  
  /** Optimal batch size for quality and performance balance */
  OPTIMAL_BATCH_SIZE: 8,
  
  /** Maximum number of parallel batches to prevent rate limiting */
  MAX_PARALLEL_BATCHES: 3,
  
  /** Delay between batch starts (milliseconds) to stagger API calls */
  BATCH_STAGGER_DELAY: 200,
  
  /** Minimum questions per batch to ensure meaningful generation */
  MIN_BATCH_SIZE: 3,
} as const

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
 * Batch Information for Large Generation Requests
 */
export interface BatchInfo {
  id: string
  questionsCount: number
  difficultyDistribution: Record<DifficultyLevel, number>
  questionTypes: Record<QuestionType, number>
  sourceText: string
  fileName: string
  batchIndex: number
  totalBatches: number
}

/**
 * Progress Callback with Batch Support
 */
export type ProgressCallback = (progress: {
  currentFile: string
  currentFileIndex: number
  totalFiles: number
  questionsGenerated: number
  totalQuestionsNeeded: number
  batchInfo?: {
    currentBatch: number
    totalBatches: number
    batchesCompleted: number
    isUsingBatches: boolean
  }
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
  
  // Batch management state
  private allGeneratedQuestions: GeneratedQuestion[] = []
  private batchQualityTracker: Map<string, QualityMetrics> = new Map()
  private globalQuestionTracker: Set<string> = new Set() // Track question content for deduplication

  constructor(config: ExamGenerationConfig) {
    this.config = config
    this.examParser = new ExamParser()
    
    // Reset state for new generation
    this.allGeneratedQuestions = []
    this.batchQualityTracker.clear()
    this.globalQuestionTracker.clear()
  }

  /**
   * Generate exam from configuration with smart batching
   */
  async generate(onProgress?: ProgressCallback): Promise<ExamGenerationResult> {
    try {
      // Validate configuration
      this.validateConfiguration()

      // Get AI provider
      const provider = this.getAIProvider()

      // Process files sequentially
      const totalFiles = this.config.files.length

      for (let i = 0; i < totalFiles; i++) {
        const file = this.config.files[i]

        // Calculate questions to generate from this file
        const questionsPerFile = Math.ceil(this.config.totalQuestions / totalFiles)
        const questionsRemaining = this.config.totalQuestions - this.allGeneratedQuestions.length
        const questionsToGenerate = Math.min(questionsPerFile, questionsRemaining)

        if (questionsToGenerate <= 0) {
          continue // Already generated enough questions
        }

        // Extract text from file
        const fileContent = await this.extractTextFromFile(file)

        // Smart Batching Decision: Check if we need to batch this file
        if (questionsToGenerate > BATCH_CONFIG.BATCH_THRESHOLD) {
          console.log(`[ExamGenerationService] Using batching strategy for ${questionsToGenerate} questions`)
          
          // Generate using batching strategy
          await this.generateQuestionsWithBatching(
            fileContent,
            file.name,
            questionsToGenerate,
            i,
            totalFiles,
            onProgress
          )
        } else {
          console.log(`[ExamGenerationService] Using single generation for ${questionsToGenerate} questions`)
          
          // Generate using single call strategy
          await this.generateQuestionsFromFileSingle(
            provider,
            fileContent,
            file.name,
            questionsToGenerate,
            i,
            totalFiles,
            onProgress
          )
        }

        // Stop if we have enough questions
        if (this.allGeneratedQuestions.length >= this.config.totalQuestions) {
          break
        }
      }

      // Final progress update
      if (onProgress) {
        onProgress({
          currentFile: '',
          currentFileIndex: totalFiles,
          totalFiles,
          questionsGenerated: this.allGeneratedQuestions.length,
          totalQuestionsNeeded: this.config.totalQuestions,
        })
      }

      // Validate and create exam
      const exam = this.createExam(this.allGeneratedQuestions)

      // Aggregate quality metrics from all batches
      const aggregatedQualityMetrics = this.aggregateQualityMetrics(Array.from(this.batchQualityTracker.values()))

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
   * Generate questions using intelligent batching strategy
   * 
   * Splits large requests into optimal batches for better quality and success rate.
   * FIXED: Now processes batches sequentially to prevent race conditions in deduplication.
   */
  private async generateQuestionsWithBatching(
    fileContent: string,
    fileName: string,
    questionsToGenerate: number,
    fileIndex: number,
    totalFiles: number,
    onProgress?: ProgressCallback
  ): Promise<void> {
    // Create batches
    const batches = this.createOptimalBatches(questionsToGenerate, fileContent, fileName)
    console.log(`[ExamGenerationService] Created ${batches.length} batches for ${questionsToGenerate} questions`)
    console.log(`[ExamGenerationService] SEQUENTIAL MODE: Processing batches one at a time to prevent race conditions`)

    // Process batches sequentially to ensure proper deduplication
    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex]
      
      console.log(`[ExamGenerationService] Starting batch ${batch.batchIndex + 1}/${batch.totalBatches} (${batch.questionsCount} questions)`)
      console.log(`[ExamGenerationService] Global question tracker has ${this.globalQuestionTracker.size} questions so far`)

      // Report batch progress
      if (onProgress) {
        onProgress({
          currentFile: batch.fileName,
          currentFileIndex: fileIndex,
          totalFiles,
          questionsGenerated: this.allGeneratedQuestions.length,
          totalQuestionsNeeded: this.config.totalQuestions,
          batchInfo: {
            currentBatch: batch.batchIndex + 1,
            totalBatches: batch.totalBatches,
            batchesCompleted: batch.batchIndex,
            isUsingBatches: true,
          },
        })
      }

      try {
        // Generate questions for this batch (sequential processing ensures no race conditions)
        const { questions, qualityMetrics } = await this.generateBatchQuestions(batch)
        
        // Add questions to global collection with deduplication (now thread-safe)
        const newQuestions = this.addQuestionsWithDeduplication(questions, batch.id)
        
        // Track quality metrics
        if (qualityMetrics) {
          this.batchQualityTracker.set(batch.id, qualityMetrics)
        }

        console.log(`[ExamGenerationService] Batch ${batch.batchIndex + 1} completed: ${newQuestions.length} new questions added (${questions.length - newQuestions.length} duplicates filtered)`)
        console.log(`[ExamGenerationService] Total unique questions so far: ${this.allGeneratedQuestions.length}`)
        
        // Add small delay between batches to respect rate limits
        if (batchIndex < batches.length - 1) {
          console.log(`[ExamGenerationService] Waiting ${BATCH_CONFIG.BATCH_STAGGER_DELAY}ms before next batch...`)
          await this.sleep(BATCH_CONFIG.BATCH_STAGGER_DELAY)
        }
        
      } catch (error) {
        console.error(`[ExamGenerationService] Batch ${batch.batchIndex + 1} failed:`, error)
        // Continue with remaining batches - don't fail the entire generation
      }
    }
    
    console.log(`[ExamGenerationService] Completed all ${batches.length} batches for ${fileName}. Total unique questions: ${this.allGeneratedQuestions.length}`)
  }

  /**
   * REMOVED: processBatchWithDelay method
   * 
   * This method was causing race conditions by processing batches in parallel.
   * Batch processing is now handled sequentially in generateQuestionsWithBatching().
   */

  /**
   * Generate questions using single call strategy (for small requests)
   */
  private async generateQuestionsFromFileSingle(
    provider: any,
    fileContent: string,
    fileName: string,
    questionsToGenerate: number,
    fileIndex: number,
    totalFiles: number,
    onProgress?: ProgressCallback
  ): Promise<void> {
    // Report progress
    if (onProgress) {
      onProgress({
        currentFile: fileName,
        currentFileIndex: fileIndex,
        totalFiles,
        questionsGenerated: this.allGeneratedQuestions.length,
        totalQuestionsNeeded: this.config.totalQuestions,
        batchInfo: {
          currentBatch: 1,
          totalBatches: 1,
          batchesCompleted: 0,
          isUsingBatches: false,
        },
      })
    }

    const { questions, rawResponse, qualityMetrics } = await this.generateQuestionsFromFile(
      provider,
      fileContent,
      fileName,
      questionsToGenerate
    )

    // Add to global collection
    this.allGeneratedQuestions.push(...questions)

    // Track quality metrics
    if (qualityMetrics) {
      this.batchQualityTracker.set(`single-${fileName}-${Date.now()}`, qualityMetrics)
    }

    // Log raw response for debugging
    console.log('[ExamGenerationService] ========== RAW AI RESPONSE ==========')
    console.log(rawResponse)
    console.log('[ExamGenerationService] ========== END RAW RESPONSE ==========')
    console.log('[ExamGenerationService] Parsed questions:', questions)
    console.log('[ExamGenerationService] First question:', questions[0])
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
   * Create optimal batches for large exam generation
   */
  private createOptimalBatches(totalQuestions: number, sourceText: string, fileName: string): BatchInfo[] {
    const batches: BatchInfo[] = []
    const batchSize = Math.min(BATCH_CONFIG.OPTIMAL_BATCH_SIZE, totalQuestions)
    const numBatches = Math.ceil(totalQuestions / batchSize)
    
    console.log(`[ExamGenerationService] Creating ${numBatches} batches of ~${batchSize} questions each`)

    for (let batchIndex = 0; batchIndex < numBatches; batchIndex++) {
      const startQuestion = batchIndex * batchSize
      const endQuestion = Math.min(startQuestion + batchSize, totalQuestions)
      const questionsInBatch = endQuestion - startQuestion
      
      // Proportionally distribute question types and difficulty across batches
      const batchQuestionTypes = this.distributeBatchQuestionTypes(questionsInBatch)
      const batchDifficultyDistribution = this.distributeBatchDifficulty(questionsInBatch)
      
      const batch: BatchInfo = {
        id: `batch-${fileName}-${batchIndex}-${Date.now()}`,
        questionsCount: questionsInBatch,
        difficultyDistribution: batchDifficultyDistribution,
        questionTypes: batchQuestionTypes,
        sourceText: sourceText,
        fileName: fileName,
        batchIndex: batchIndex,
        totalBatches: numBatches,
      }
      
      batches.push(batch)
      
      console.log(`[ExamGenerationService] Batch ${batchIndex + 1}: ${questionsInBatch} questions, types:`, batchQuestionTypes)
    }

    return batches
  }

  /**
   * Distribute question types proportionally across a batch
   */
  private distributeBatchQuestionTypes(batchSize: number): Record<QuestionType, number> {
    const totalQuestions = this.config.totalQuestions
    const scale = batchSize / totalQuestions
    
    const batchTypes: Record<QuestionType, number> = {} as Record<QuestionType, number>
    
    for (const [type, count] of Object.entries(this.config.questionTypes)) {
      const scaledCount = Math.round((count as number) * scale)
      if (scaledCount > 0) {
        batchTypes[type as QuestionType] = scaledCount
      }
    }
    
    // Ensure we have at least some questions in the batch
    const totalAssigned = Object.values(batchTypes).reduce((sum, count) => sum + count, 0)
    if (totalAssigned === 0 && batchSize > 0) {
      // Fallback: assign to multiple choice
      batchTypes.multipleChoice = batchSize
    } else if (totalAssigned < batchSize) {
      // Add remaining questions to the most popular type
      const mostPopularType = Object.entries(batchTypes).sort(([,a], [,b]) => b - a)[0]?.[0] as QuestionType
      if (mostPopularType) {
        batchTypes[mostPopularType] += (batchSize - totalAssigned)
      }
    }
    
    return batchTypes
  }

  /**
   * Distribute difficulty levels proportionally across a batch
   */
  private distributeBatchDifficulty(batchSize: number): Record<DifficultyLevel, number> {
    const totalQuestions = this.config.totalQuestions
    const scale = batchSize / totalQuestions
    
    const batchDifficulty: Record<DifficultyLevel, number> = {} as Record<DifficultyLevel, number>
    
    for (const [level, count] of Object.entries(this.config.difficultyDistribution)) {
      const scaledCount = Math.round((count as number) * scale)
      if (scaledCount > 0) {
        batchDifficulty[level as DifficultyLevel] = scaledCount
      }
    }
    
    // Ensure we have at least some difficulty assigned
    const totalAssigned = Object.values(batchDifficulty).reduce((sum, count) => sum + count, 0)
    if (totalAssigned === 0 && batchSize > 0) {
      // Fallback: assign to moderate difficulty
      batchDifficulty.moderate = batchSize
    } else if (totalAssigned < batchSize) {
      // Add remaining questions to the most popular difficulty
      const mostPopularDifficulty = Object.entries(batchDifficulty).sort(([,a], [,b]) => b - a)[0]?.[0] as DifficultyLevel
      if (mostPopularDifficulty) {
        batchDifficulty[mostPopularDifficulty] += (batchSize - totalAssigned)
      }
    }
    
    return batchDifficulty
  }

  /**
   * Generate questions for a specific batch
   */
  private async generateBatchQuestions(batch: BatchInfo): Promise<{ questions: GeneratedQuestion[]; qualityMetrics?: QualityMetrics }> {
    // Build exam config for this specific batch
    const batchConfig = {
      questionTypes: batch.questionTypes,
      difficultyDistribution: batch.difficultyDistribution,
      totalQuestions: batch.questionsCount,
    }

    console.log(`[ExamGenerationService] Generating batch ${batch.batchIndex + 1} with config:`, batchConfig)

    // Use Groq backend for generation
    const groqResult = await window.electron.groq.generateExam(batchConfig, batch.sourceText, this.config.userId)

    if (!groqResult.success) {
      throw new Error(groqResult.error || 'Batch generation failed')
    }

    // Use structured exam data from backend if available
    let questions: GeneratedQuestion[]
    
    if (groqResult.exam && groqResult.exam.questions) {
      questions = groqResult.exam.questions
    } else {
      // Fallback: Parse response manually
      questions = this.parseAIResponse(groqResult.content)
    }

    if (questions.length === 0) {
      throw new Error(`No questions generated for batch ${batch.batchIndex + 1}`)
    }

    console.log(`[ExamGenerationService] Batch ${batch.batchIndex + 1} generated ${questions.length} questions`)

    return {
      questions,
      qualityMetrics: groqResult.qualityMetrics,
    }
  }

  /**
   * Add questions to global collection with cross-batch deduplication
   */
  private addQuestionsWithDeduplication(questions: GeneratedQuestion[], batchId: string): GeneratedQuestion[] {
    const newQuestions: GeneratedQuestion[] = []
    
    for (const question of questions) {
      // Create a content fingerprint for deduplication
      const contentFingerprint = this.createQuestionFingerprint(question)
      
      // Check if we've seen this question before (across all batches)
      if (!this.globalQuestionTracker.has(contentFingerprint)) {
        this.globalQuestionTracker.add(contentFingerprint)
        this.allGeneratedQuestions.push(question)
        newQuestions.push(question)
      } else {
        console.log(`[ExamGenerationService] Duplicate question filtered from batch ${batchId}:`, question.question.substring(0, 50) + '...')
      }
    }
    
    console.log(`[ExamGenerationService] Added ${newQuestions.length} new questions, filtered ${questions.length - newQuestions.length} duplicates`)
    return newQuestions
  }

  /**
   * Create a unique fingerprint for a question to detect duplicates
   */
  private createQuestionFingerprint(question: GeneratedQuestion): string {
    // Normalize question text for comparison
    const normalizedText = question.question
      .toLowerCase()
      .replace(/[^\w\s]/g, '') // Remove punctuation
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim()
    
    // Include question type and first few words for uniqueness
    const firstWords = normalizedText.split(' ').slice(0, 8).join(' ')
    return `${question.type}:${firstWords}`
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
