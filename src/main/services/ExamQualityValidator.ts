/**
 * Exam Quality Validator Service
 *
 * Enhanced post-generation quality validation service with batch-aware deduplication.
 *
 * Key Features:
 * - Advanced semantic deduplication with cross-batch awareness
 * - Real-time duplicate detection during batch processing
 * - Enhanced source verification against original material  
 * - Difficulty level accuracy checking with specialized validation
 * - Progressive quality scoring and validation metrics
 * - Auto-retry recommendations for poor quality
 * - Batch-specific quality tracking and reporting
 *
 * This is a universal validator that works across all subjects and disciplines.
 */

import { GeneratedQuestion, GeneratedExam } from '../../shared/types/exam'

/**
 * Quality Validation Configuration
 */
export interface QualityValidationConfig {
  // Similarity thresholds
  duplicateThreshold: number // 0.0-1.0, questions above this similarity are considered duplicates
  conceptSimilarityThreshold: number // 0.0-1.0, concepts above this are too similar
  strictDuplicateThreshold: number // 0.0-1.0, stricter threshold for cross-batch validation
  
  // Source verification settings
  sourceVerificationEnabled: boolean
  strictSourceChecking: boolean // If true, requires exact text matches
  
  // Difficulty validation settings
  difficultyValidationEnabled: boolean
  difficultyTolerancePercent: number // Allow small variations in difficulty distribution
  specializedDifficultyValidation: boolean // Enhanced validation for single-difficulty batches
  
  // Quality thresholds
  minimumQualityScore: number // 0.0-1.0, exams below this should be regenerated
  retryOnLowQuality: boolean
  maxRetryAttempts: number
  
  // Batch-aware settings
  crossBatchValidation: boolean // Enable validation across batches
  batchQualityTracking: boolean // Track quality progression across batches
  earlyTerminationEnabled: boolean // Stop generation if quality drops too low
}

/**
 * Validation Result for Individual Questions
 */
export interface QuestionValidationResult {
  questionId: string
  isValid: boolean
  issues: {
    isDuplicate?: boolean
    duplicateOf?: string
    sourceIssue?: string
    difficultyMismatch?: {
      expected: string
      detected: string
      confidence: number
    }
    qualityIssues?: string[]
  }
  qualityScore: number // 0.0-1.0
  confidence: number // 0.0-1.0
}

/**
 * Batch Validation Result
 */
export interface BatchValidationResult {
  batchId: string
  batchIndex: number
  isValid: boolean
  qualityScore: number // 0.0-1.0
  questionsValidated: number
  duplicatesFound: number
  crossBatchDuplicates: number
  sourceIssues: number
  difficultyIssues: number
  
  recommendations: {
    shouldRetryBatch: boolean
    improvements: string[]
    continueGeneration: boolean
  }
  
  progressiveMetrics: {
    qualityTrend: 'improving' | 'declining' | 'stable'
    cumulativeDuplicates: number
    averageQualityScore: number
  }
}

/**
 * Real-time Duplicate Detection Result
 */
export interface DuplicateCheckResult {
  isDuplicate: boolean
  duplicateOf?: string
  similarityScore: number
  duplicateType: 'exact' | 'semantic' | 'conceptual'
  recommendation: 'reject' | 'accept' | 'modify'
}

/**
 * Overall Exam Validation Result (Enhanced)
 */
export interface ExamValidationResult {
  isValid: boolean
  overallQualityScore: number // 0.0-1.0
  validQuestions: number
  totalQuestions: number
  duplicatesFound: number
  sourceIssues: number
  difficultyIssues: number
  
  questionResults: QuestionValidationResult[]
  batchResults?: BatchValidationResult[] // Track batch-by-batch results
  
  recommendations: {
    shouldRegenerate: boolean
    improvements: string[]
    retryWithPromptChanges?: string[]
    batchSpecificFeedback?: string[]
  }
  
  metrics: {
    uniquenessScore: number // 0.0-1.0
    accuracyScore: number // 0.0-1.0
    difficultyScore: number // 0.0-1.0
    coverageScore: number // 0.0-1.0
    batchConsistencyScore?: number // 0.0-1.0, consistency across batches
  }
}

/**
 * Default Quality Validation Configuration (Enhanced)
 */
const DEFAULT_CONFIG: QualityValidationConfig = {
  // Enhanced similarity detection
  duplicateThreshold: 0.85, // 85% similarity considered duplicate
  conceptSimilarityThreshold: 0.75, // 75% concept similarity too similar
  strictDuplicateThreshold: 0.90, // 90% similarity for cross-batch validation (stricter)
  
  // Source verification
  sourceVerificationEnabled: true,
  strictSourceChecking: false, // Allow paraphrasing of source material
  
  // Difficulty validation
  difficultyValidationEnabled: true,
  difficultyTolerancePercent: 0.2, // Allow 20% variance in difficulty distribution
  specializedDifficultyValidation: true, // Enhanced validation for single-difficulty batches
  
  // Quality thresholds
  minimumQualityScore: 0.7, // 70% quality threshold
  retryOnLowQuality: true,
  maxRetryAttempts: 2,
  
  // Batch-aware features
  crossBatchValidation: true, // Enable validation across batches
  batchQualityTracking: true, // Track quality progression across batches
  earlyTerminationEnabled: true, // Stop generation if quality drops too low
}

/**
 * Exam Quality Validator
 *
 * Usage:
 * ```typescript
 * const validator = new ExamQualityValidator(sourceText, config)
 * const result = await validator.validateExam(exam)
 * 
 * if (!result.isValid) {
 *   console.log('Quality issues found:', result.recommendations.improvements)
 *   if (result.recommendations.shouldRegenerate) {
 *     // Regenerate exam with improvements
 *   }
 * }
 * ```
 */
export class ExamQualityValidator {
  private sourceText: string
  private config: QualityValidationConfig
  private wordCache: Map<string, string[]> = new Map()
  
  // Enhanced state for batch-aware validation
  private allValidatedQuestions: GeneratedQuestion[] = []
  private batchResults: BatchValidationResult[] = []
  private questionFingerprints: Map<string, GeneratedQuestion> = new Map()
  private qualityTrendHistory: number[] = []

  /**
   * Initialize enhanced validator with batch awareness
   * 
   * @param sourceText - Original source material for verification
   * @param config - Validation configuration (optional)
   */
  constructor(sourceText: string, config?: Partial<QualityValidationConfig>) {
    this.sourceText = sourceText.toLowerCase()
    this.config = { ...DEFAULT_CONFIG, ...config }
    
    // Initialize batch tracking state
    this.allValidatedQuestions = []
    this.batchResults = []
    this.questionFingerprints.clear()
    this.qualityTrendHistory = []
  }

  /**
   * Reset validator state for new generation session
   */
  public resetForNewSession(): void {
    this.allValidatedQuestions = []
    this.batchResults = []
    this.questionFingerprints.clear()
    this.qualityTrendHistory = []
    this.wordCache.clear()
    
    console.log('[ExamQualityValidator] Reset for new generation session')
  }

  /**
   * Real-time duplicate check against all previously validated questions
   * 
   * @param question - New question to check
   * @returns Duplicate detection result with recommendation
   */
  public checkForRealTimeDuplicates(question: GeneratedQuestion): DuplicateCheckResult {
    if (!this.config.crossBatchValidation) {
      return { 
        isDuplicate: false, 
        similarityScore: 0, 
        duplicateType: 'exact',
        recommendation: 'accept'
      }
    }

    const questionFingerprint = this.createAdvancedQuestionFingerprint(question)
    
    // Check against all previously validated questions
    for (const [, existingQuestion] of this.questionFingerprints) {
      const similarity = this.calculateAdvancedSimilarity(question, existingQuestion)
      
      if (similarity > this.config.strictDuplicateThreshold) {
        console.log(`[ExamQualityValidator] Real-time duplicate detected: ${similarity.toFixed(3)} similarity`)
        
        return {
          isDuplicate: true,
          duplicateOf: existingQuestion.id,
          similarityScore: similarity,
          duplicateType: similarity > 0.95 ? 'exact' : 'semantic',
          recommendation: 'reject'
        }
      } else if (similarity > this.config.conceptSimilarityThreshold) {
        return {
          isDuplicate: true,
          duplicateOf: existingQuestion.id,
          similarityScore: similarity,
          duplicateType: 'conceptual',
          recommendation: 'modify'
        }
      }
    }

    // Add to fingerprint tracking
    this.questionFingerprints.set(questionFingerprint, question)
    
    return { 
      isDuplicate: false, 
      similarityScore: 0,
      duplicateType: 'exact',
      recommendation: 'accept'
    }
  }

  /**
   * Validate a batch of questions with progressive quality tracking
   * 
   * @param questions - Questions from current batch
   * @param batchId - Unique identifier for this batch
   * @param batchIndex - Index of this batch in the generation sequence
   * @returns Batch validation result with quality metrics
   */
  public validateBatch(questions: GeneratedQuestion[], batchId: string, batchIndex: number): BatchValidationResult {
    console.log(`[ExamQualityValidator] Validating batch ${batchIndex + 1} with ${questions.length} questions`)

    let duplicatesFound = 0
    let crossBatchDuplicates = 0
    let sourceIssues = 0
    let difficultyIssues = 0
    let totalQualityScore = 0

    // Validate each question in the batch
    for (const question of questions) {
      // Check for duplicates within batch
      const withinBatchDuplicate = this.checkWithinBatchDuplicates(question, questions)
      if (withinBatchDuplicate) duplicatesFound++

      // Check for cross-batch duplicates
      const crossBatchCheck = this.checkForRealTimeDuplicates(question)
      if (crossBatchCheck.isDuplicate) crossBatchDuplicates++

      // Validate source fidelity
      if (this.config.sourceVerificationEnabled) {
        const sourceIssue = this.verifyAgainstSource(question)
        if (sourceIssue) sourceIssues++
      }

      // Validate difficulty
      if (this.config.difficultyValidationEnabled) {
        const difficultyIssue = this.validateDifficulty(question)
        if (difficultyIssue) difficultyIssues++
      }

      // Calculate individual question quality
      const qualityScore = this.calculateQuestionQualityScore(question)
      totalQualityScore += qualityScore

      // Add to global tracking
      this.allValidatedQuestions.push(question)
    }

    const averageQualityScore = totalQualityScore / questions.length
    this.qualityTrendHistory.push(averageQualityScore)

    const qualityTrend = this.determineQualityTrend()
    const isValid = averageQualityScore >= this.config.minimumQualityScore && 
                   crossBatchDuplicates <= Math.ceil(questions.length * 0.1) // Allow up to 10% cross-batch duplicates

    const batchResult: BatchValidationResult = {
      batchId,
      batchIndex,
      isValid,
      qualityScore: averageQualityScore,
      questionsValidated: questions.length,
      duplicatesFound,
      crossBatchDuplicates,
      sourceIssues,
      difficultyIssues,
      recommendations: {
        shouldRetryBatch: !isValid && this.config.retryOnLowQuality,
        improvements: this.generateBatchImprovements(duplicatesFound, crossBatchDuplicates, sourceIssues, difficultyIssues),
        continueGeneration: this.shouldContinueGeneration(qualityTrend, averageQualityScore)
      },
      progressiveMetrics: {
        qualityTrend,
        cumulativeDuplicates: this.getTotalDuplicates(),
        averageQualityScore: this.getOverallAverageQuality()
      }
    }

    this.batchResults.push(batchResult)

    console.log(`[ExamQualityValidator] Batch ${batchIndex + 1} validation complete:`, {
      valid: isValid,
      quality: averageQualityScore.toFixed(3),
      duplicates: duplicatesFound,
      crossBatch: crossBatchDuplicates,
      trend: qualityTrend
    })

    return batchResult
  }

  /**
   * Validate complete exam quality
   * 
   * @param exam - Generated exam to validate
   * @returns Comprehensive validation result
   */
  async validateExam(exam: GeneratedExam): Promise<ExamValidationResult> {
    console.log('[ExamQualityValidator] Starting validation for', exam.totalQuestions, 'questions')

    // Validate individual questions
    const questionResults: QuestionValidationResult[] = []
    
    for (let i = 0; i < exam.questions.length; i++) {
      const question = exam.questions[i]
      const result = await this.validateQuestion(question, exam.questions, i)
      questionResults.push(result)
    }

    // Calculate overall metrics
    const metrics = this.calculateOverallMetrics(questionResults, exam)
    
    // Determine overall validity
    const validQuestions = questionResults.filter(r => r.isValid).length
    const duplicatesFound = questionResults.filter(r => r.issues.isDuplicate).length
    const sourceIssues = questionResults.filter(r => r.issues.sourceIssue).length
    const difficultyIssues = questionResults.filter(r => r.issues.difficultyMismatch).length
    
    const overallQualityScore = this.calculateOverallQualityScore(metrics)
    const isValid = overallQualityScore >= this.config.minimumQualityScore

    // Generate recommendations
    const recommendations = this.generateRecommendations(questionResults, metrics, overallQualityScore)

    const result: ExamValidationResult = {
      isValid,
      overallQualityScore,
      validQuestions,
      totalQuestions: exam.totalQuestions,
      duplicatesFound,
      sourceIssues,
      difficultyIssues,
      questionResults,
      recommendations,
      metrics,
    }

    console.log('[ExamQualityValidator] Validation complete:', {
      valid: isValid,
      score: overallQualityScore.toFixed(3),
      issues: duplicatesFound + sourceIssues + difficultyIssues,
    })

    return result
  }

  /**
   * Validate individual question
   */
  private async validateQuestion(
    question: GeneratedQuestion, 
    allQuestions: GeneratedQuestion[], 
    currentIndex: number
  ): Promise<QuestionValidationResult> {
    
    const result: QuestionValidationResult = {
      questionId: question.id,
      isValid: true,
      issues: {},
      qualityScore: 1.0,
      confidence: 1.0,
    }

    // Check for duplicates
    const duplicateCheck = this.checkForDuplicates(question, allQuestions, currentIndex)
    if (duplicateCheck.isDuplicate) {
      result.isValid = false
      result.issues.isDuplicate = true
      result.issues.duplicateOf = duplicateCheck.duplicateOf
      result.qualityScore -= 0.5
    }

    // Verify against source material
    if (this.config.sourceVerificationEnabled) {
      const sourceIssue = this.verifyAgainstSource(question)
      if (sourceIssue) {
        result.isValid = false
        result.issues.sourceIssue = sourceIssue
        result.qualityScore -= 0.3
      }
    }

    // Check difficulty accuracy
    if (this.config.difficultyValidationEnabled) {
      const difficultyIssue = this.validateDifficulty(question)
      if (difficultyIssue) {
        result.issues.difficultyMismatch = difficultyIssue
        result.qualityScore -= 0.2
      }
    }

    // Additional quality checks
    const qualityIssues = this.performQualityChecks(question)
    if (qualityIssues.length > 0) {
      result.issues.qualityIssues = qualityIssues
      result.qualityScore -= 0.1 * qualityIssues.length
    }

    // Ensure score doesn't go below 0
    result.qualityScore = Math.max(0, result.qualityScore)

    return result
  }

  /**
   * Check for duplicate questions using semantic similarity
   */
  private checkForDuplicates(
    question: GeneratedQuestion, 
    allQuestions: GeneratedQuestion[], 
    currentIndex: number
  ): { isDuplicate: boolean; duplicateOf?: string } {
    
    const questionWords = this.getWordsFromText(question.question)
    
    for (let i = 0; i < currentIndex; i++) {
      const otherQuestion = allQuestions[i]
      const otherWords = this.getWordsFromText(otherQuestion.question)
      
      const similarity = this.calculateTextSimilarity(questionWords, otherWords)
      
      if (similarity > this.config.duplicateThreshold) {
        return { isDuplicate: true, duplicateOf: otherQuestion.id }
      }
    }
    
    return { isDuplicate: false }
  }

  /**
   * Verify question content against source material
   */
  private verifyAgainstSource(question: GeneratedQuestion): string | null {
    const questionText = question.question.toLowerCase()
    const answerText = Array.isArray(question.answer) 
      ? question.answer.join(' ').toLowerCase() 
      : question.answer.toLowerCase()
    
    // Check if question concepts appear in source
    const questionWords = this.getWordsFromText(questionText)
    const sourceWords = this.getWordsFromText(this.sourceText)
    
    const conceptOverlap = this.calculateTextSimilarity(questionWords, sourceWords)
    
    if (conceptOverlap < 0.3) { // Less than 30% concept overlap
      return 'Question appears to reference concepts not found in source material'
    }
    
    // For stricter checking, verify answer appears in source
    if (this.config.strictSourceChecking) {
      if (!this.sourceText.includes(answerText.substring(0, 20))) {
        return 'Answer not found in source material'
      }
    }
    
    return null
  }

  /**
   * Validate difficulty level accuracy
   */
  private validateDifficulty(question: GeneratedQuestion): {
    expected: string
    detected: string
    confidence: number
  } | null {
    
    const detectedDifficulty = this.detectQuestionDifficulty(question)
    
    if (detectedDifficulty.level !== question.difficulty) {
      return {
        expected: question.difficulty,
        detected: detectedDifficulty.level,
        confidence: detectedDifficulty.confidence,
      }
    }
    
    return null
  }

  /**
   * Detect actual difficulty level of question
   */
  private detectQuestionDifficulty(question: GeneratedQuestion): {
    level: string
    confidence: number
  } {
    let score = 0
    const questionText = question.question.toLowerCase()
    
    // Keywords that indicate difficulty levels
    const easyKeywords = ['what is', 'define', 'list', 'name', 'identify']
    const moderateKeywords = ['explain', 'describe', 'compare', 'how does']
    const hardKeywords = ['analyze', 'evaluate', 'synthesize', 'predict', 'justify']
    const veryHardKeywords = ['create', 'design', 'formulate', 'critique', 'develop']
    
    // Check for keyword patterns
    if (easyKeywords.some(kw => questionText.includes(kw))) score += 1
    if (moderateKeywords.some(kw => questionText.includes(kw))) score += 2
    if (hardKeywords.some(kw => questionText.includes(kw))) score += 3
    if (veryHardKeywords.some(kw => questionText.includes(kw))) score += 4
    
    // Check question structure complexity
    if (question.type === 'multipleChoice') score += 1
    if (question.type === 'essay') score += 3
    if (question.question.split(' ').length > 15) score += 1 // Longer questions tend to be harder
    
    // Map score to difficulty level
    let level: string
    if (score <= 2) level = 'easy'
    else if (score <= 4) level = 'moderate' 
    else if (score <= 6) level = 'hard'
    else level = 'veryHard'
    
    const confidence = Math.min(1.0, score / 8) // Convert to 0-1 scale
    
    return { level, confidence }
  }

  /**
   * Perform additional quality checks
   */
  private performQualityChecks(question: GeneratedQuestion): string[] {
    const issues: string[] = []
    
    // Check for literal instructions (critical quality issue)
    const literalInstructions = this.detectLiteralInstructions(question.question)
    if (literalInstructions.found) {
      issues.push(`Contains literal instructions: ${literalInstructions.patterns.join(', ')}`)
    }
    
    // Check question length
    if (question.question.length < 10) {
      issues.push('Question too short')
    }
    if (question.question.length > 200) {
      issues.push('Question too long')
    }
    
    // Check for proper question format
    if (!question.question.trim().endsWith('?') && !question.question.includes('___')) {
      issues.push('Question does not end with proper punctuation')
    }
    
    // Check multiple choice options
    if (question.type === 'multipleChoice') {
      if (!question.options || question.options.length !== 4) {
        issues.push('Multiple choice question must have exactly 4 options')
      }
      
      if (question.options) {
        // Check for duplicate options
        const uniqueOptions = new Set(question.options.map(opt => opt.toLowerCase().trim()))
        if (uniqueOptions.size !== question.options.length) {
          issues.push('Multiple choice options contain duplicates')
        }
        
        // Check option length consistency
        const avgLength = question.options.reduce((sum, opt) => sum + opt.length, 0) / question.options.length
        const hasInconsistentLength = question.options.some(opt => Math.abs(opt.length - avgLength) > avgLength * 0.8)
        if (hasInconsistentLength) {
          issues.push('Multiple choice options have inconsistent lengths')
        }
      }
    }
    
    // Check answer format
    if (!question.answer || (typeof question.answer === 'string' && question.answer.trim().length === 0)) {
      issues.push('Missing or empty answer')
    }
    
    return issues
  }

  /**
   * Calculate text similarity using Jaccard similarity
   */
  private calculateTextSimilarity(words1: string[], words2: string[]): number {
    const set1 = new Set(words1)
    const set2 = new Set(words2)
    
    const intersection = new Set([...set1].filter(x => set2.has(x)))
    const union = new Set([...set1, ...set2])
    
    if (union.size === 0) return 0
    return intersection.size / union.size
  }

  /**
   * Extract meaningful words from text
   */
  private getWordsFromText(text: string): string[] {
    const cacheKey = text
    if (this.wordCache.has(cacheKey)) {
      return this.wordCache.get(cacheKey)!
    }
    
    // Common stop words to filter out
    const stopWords = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
      'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had', 'do', 'does', 'did',
      'will', 'would', 'could', 'should', 'may', 'might', 'can', 'this', 'that', 'these', 'those'
    ])
    
    const words = text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ') // Remove punctuation
      .split(/\s+/)
      .filter(word => word.length > 2 && !stopWords.has(word))
    
    this.wordCache.set(cacheKey, words)
    return words
  }

  /**
   * Calculate overall metrics
   */
  private calculateOverallMetrics(
    questionResults: QuestionValidationResult[], 
    exam: GeneratedExam
  ): ExamValidationResult['metrics'] {
    
    const totalQuestions = questionResults.length
    
    // Uniqueness score (inverse of duplicate rate)
    const duplicates = questionResults.filter(r => r.issues.isDuplicate).length
    const uniquenessScore = 1 - (duplicates / totalQuestions)
    
    // Accuracy score (questions without source issues)
    const sourceIssues = questionResults.filter(r => r.issues.sourceIssue).length
    const accuracyScore = 1 - (sourceIssues / totalQuestions)
    
    // Difficulty score (questions with correct difficulty)
    const difficultyIssues = questionResults.filter(r => r.issues.difficultyMismatch).length
    const difficultyScore = 1 - (difficultyIssues / totalQuestions)
    
    // Coverage score (based on topic distribution)
    const coverageScore = this.calculateCoverageScore(exam.questions)
    
    return {
      uniquenessScore,
      accuracyScore,
      difficultyScore,
      coverageScore,
    }
  }

  /**
   * Calculate topic coverage score
   */
  private calculateCoverageScore(questions: GeneratedQuestion[]): number {
    // Simple heuristic: check if questions cover different concepts
    const concepts = new Set<string>()
    
    for (const question of questions) {
      const words = this.getWordsFromText(question.question)
      // Use first meaningful word as concept indicator
      if (words.length > 0) {
        concepts.add(words[0])
      }
    }
    
    // Good coverage if we have at least 1/3 as many concepts as questions
    const expectedConcepts = Math.max(1, Math.floor(questions.length / 3))
    const actualConcepts = concepts.size
    
    return Math.min(1.0, actualConcepts / expectedConcepts)
  }

  /**
   * Calculate overall quality score
   */
  private calculateOverallQualityScore(metrics: ExamValidationResult['metrics']): number {
    // Weighted average of all metrics
    const weights = {
      uniqueness: 0.3,
      accuracy: 0.4,
      difficulty: 0.2,
      coverage: 0.1,
    }
    
    return (
      metrics.uniquenessScore * weights.uniqueness +
      metrics.accuracyScore * weights.accuracy +
      metrics.difficultyScore * weights.difficulty +
      metrics.coverageScore * weights.coverage
    )
  }

  /**
   * Detect literal instructions in text
   * 
   * @param text - Text to check for literal instruction patterns
   * @returns Detection result with found patterns
   */
  public detectLiteralInstructions(text: string): {
    found: boolean;
    patterns: string[];
    cleanedText?: string;
  } {
    const literalPatterns = [
      // Bracket placeholders
      /\[Continue with.*?\]/gi,
      /\[Generate.*?\]/gi,
      /\[Question text here.*?\]/gi,
      /\[.*?questions?\]/gi,
      
      // Direct instruction phrases
      /Continue for all requested/gi,
      /Generate all \d+ questions/gi,
      /Continue with questions? \d+/gi,
      /Continue in same format/gi,
      /Follow this pattern/gi,
      /Repeat for all/gi,
      
      // Formatting instructions
      /Use this format/gi,
      /Format as follows/gi,
      /Follow the structure/gi,
      /Continue the pattern/gi,
      
      // Ellipsis patterns that suggest continuation
      /\[\.\.\.continues?\]/gi,
      /\[more questions?\]/gi,
      /\[rest of.*?\]/gi,
    ]
    
    const foundPatterns: string[] = []
    
    for (const pattern of literalPatterns) {
      const matches = text.match(pattern)
      if (matches) {
        foundPatterns.push(...matches)
      }
    }
    
    return {
      found: foundPatterns.length > 0,
      patterns: foundPatterns,
      cleanedText: foundPatterns.length > 0 ? this.cleanLiteralInstructions(text) : undefined,
    }
  }
  
  /**
   * Clean literal instructions from exam content
   * 
   * @param examContent - Raw exam content from AI generation
   * @returns Cleaned exam content with literal instructions removed
   */
  public cleanLiteralInstructions(examContent: string): string {
    let cleaned = examContent
    
    // Remove bracket placeholders and instruction text
    const cleaningPatterns = [
      // Bracket placeholders
      /\[Continue with.*?\]/gi,
      /\[Generate.*?\]/gi,
      /\[Question text here.*?\]/gi,
      /\[.*?questions?\]/gi,
      /\[\.\.\.continues?\]/gi,
      /\[more questions?\]/gi,
      /\[rest of.*?\]/gi,
      
      // Direct instruction phrases (entire lines)
      /Continue for all requested.*$/gmi,
      /Generate all \d+ questions.*$/gmi,
      /Continue with questions? \d+.*$/gmi,
      /Continue in same format.*$/gmi,
      /Follow this pattern.*$/gmi,
      /Repeat for all.*$/gmi,
      /Use this format.*$/gmi,
      /Format as follows.*$/gmi,
      /Follow the structure.*$/gmi,
      /Continue the pattern.*$/gmi,
      
      // Lines that are just ellipsis or dashes indicating continuation
      /^\.\.\.+.*$/gmi,
      /^-+.*continues?.*$/gmi,
      /^\*.*continues?.*$/gmi,
      
      // Remove empty parentheses or brackets left behind
      /\(\s*\)/g,
      /\[\s*\]/g,
      /\{\s*\}/g,
    ]
    
    // Apply all cleaning patterns
    for (const pattern of cleaningPatterns) {
      cleaned = cleaned.replace(pattern, '')
    }
    
    // Clean up multiple consecutive newlines
    cleaned = cleaned.replace(/\n\s*\n\s*\n/g, '\n\n')
    
    // Remove trailing whitespace from lines
    cleaned = cleaned.replace(/[ \t]+$/gm, '')
    
    // Ensure proper spacing around question numbers
    cleaned = cleaned.replace(/(\d+)\.\s*\n/g, '$1. ')
    
    return cleaned.trim()
  }

  /**
   * Generate improvement recommendations
   */
  private generateRecommendations(
    _questionResults: QuestionValidationResult[],
    metrics: ExamValidationResult['metrics'],
    overallScore: number
  ): ExamValidationResult['recommendations'] {
    
    const improvements: string[] = []
    const retryPromptChanges: string[] = []
    
    // Uniqueness recommendations
    if (metrics.uniquenessScore < 0.8) {
      improvements.push('Reduce question repetition - many questions test similar concepts')
      retryPromptChanges.push('Add stronger uniqueness requirements to prompt')
    }
    
    // Accuracy recommendations  
    if (metrics.accuracyScore < 0.8) {
      improvements.push('Improve source fidelity - questions should stick closer to source material')
      retryPromptChanges.push('Emphasize strict adherence to source material in prompt')
    }
    
    // Difficulty recommendations
    if (metrics.difficultyScore < 0.8) {
      improvements.push('Improve difficulty distribution accuracy - questions do not match requested difficulty levels')
      retryPromptChanges.push('Add clearer difficulty level definitions to prompt')
    }
    
    // Coverage recommendations
    if (metrics.coverageScore < 0.7) {
      improvements.push('Improve topic coverage - questions are too concentrated on few topics')
      retryPromptChanges.push('Add requirements for broader topic distribution')
    }
    
    const shouldRegenerate = this.config.retryOnLowQuality && overallScore < this.config.minimumQualityScore
    
    return {
      shouldRegenerate,
      improvements,
      retryWithPromptChanges: retryPromptChanges.length > 0 ? retryPromptChanges : undefined,
    }
  }

  /**
   * Create an advanced fingerprint for more accurate duplicate detection
   */
  private createAdvancedQuestionFingerprint(question: GeneratedQuestion): string {
    // Include question type, core concepts, and answer pattern
    const questionWords = this.getWordsFromText(question.question)
    const coreWords = questionWords.slice(0, 5).join(' ') // First 5 meaningful words
    
    // Include answer signature for MC questions
    let answerSignature = ''
    if (question.type === 'multipleChoice' && question.options) {
      answerSignature = question.options.map(opt => opt.substring(0, 10)).join('|')
    }
    
    return `${question.type}:${question.difficulty}:${coreWords}:${answerSignature}`
  }

  /**
   * Calculate advanced similarity between two questions
   */
  private calculateAdvancedSimilarity(question1: GeneratedQuestion, question2: GeneratedQuestion): number {
    // Different question types are less similar
    if (question1.type !== question2.type) {
      return this.calculateTextSimilarity(
        this.getWordsFromText(question1.question),
        this.getWordsFromText(question2.question)
      ) * 0.7 // Reduce similarity for different types
    }

    // Same type questions - full similarity calculation
    const textSimilarity = this.calculateTextSimilarity(
      this.getWordsFromText(question1.question),
      this.getWordsFromText(question2.question)
    )

    // For multiple choice, also consider option similarity
    if (question1.type === 'multipleChoice' && question1.options && question2.options) {
      const optionSimilarity = this.calculateOptionSimilarity(question1.options, question2.options)
      return (textSimilarity * 0.7) + (optionSimilarity * 0.3)
    }

    return textSimilarity
  }

  /**
   * Calculate similarity between multiple choice options
   */
  private calculateOptionSimilarity(options1: string[], options2: string[]): number {
    if (!options1 || !options2) return 0

    let totalSimilarity = 0
    let comparisons = 0

    for (const option1 of options1) {
      for (const option2 of options2) {
        const similarity = this.calculateTextSimilarity(
          this.getWordsFromText(option1),
          this.getWordsFromText(option2)
        )
        totalSimilarity += similarity
        comparisons++
      }
    }

    return comparisons > 0 ? totalSimilarity / comparisons : 0
  }

  /**
   * Check for duplicates within the current batch
   */
  private checkWithinBatchDuplicates(question: GeneratedQuestion, batchQuestions: GeneratedQuestion[]): boolean {
    const currentIndex = batchQuestions.indexOf(question)
    if (currentIndex === -1) return false

    const questionWords = this.getWordsFromText(question.question)

    for (let i = 0; i < currentIndex; i++) {
      const otherQuestion = batchQuestions[i]
      const otherWords = this.getWordsFromText(otherQuestion.question)
      
      const similarity = this.calculateTextSimilarity(questionWords, otherWords)
      
      if (similarity > this.config.duplicateThreshold) {
        return true
      }
    }

    return false
  }

  /**
   * Calculate individual question quality score
   */
  private calculateQuestionQualityScore(question: GeneratedQuestion): number {
    let score = 1.0

    // Penalize for common quality issues
    const qualityIssues = this.performQualityChecks(question)
    score -= (qualityIssues.length * 0.1)

    // Reward proper question structure
    if (question.question.length >= 20 && question.question.length <= 150) {
      score += 0.1 // Good length
    }

    // Reward for proper punctuation
    if (question.question.trim().endsWith('?') || question.question.includes('_')) {
      score += 0.05
    }

    return Math.max(0, Math.min(1, score))
  }

  /**
   * Determine quality trend across batches
   */
  private determineQualityTrend(): 'improving' | 'declining' | 'stable' {
    if (this.qualityTrendHistory.length < 2) return 'stable'

    const recent = this.qualityTrendHistory.slice(-3) // Last 3 batches
    const earlier = this.qualityTrendHistory.slice(-6, -3) // Previous 3 batches

    if (earlier.length === 0) return 'stable'

    const recentAvg = recent.reduce((sum, score) => sum + score, 0) / recent.length
    const earlierAvg = earlier.reduce((sum, score) => sum + score, 0) / earlier.length

    const difference = recentAvg - earlierAvg

    if (difference > 0.05) return 'improving'
    if (difference < -0.05) return 'declining'
    return 'stable'
  }

  /**
   * Generate batch-specific improvement recommendations
   */
  private generateBatchImprovements(duplicates: number, crossBatchDuplicates: number, sourceIssues: number, difficultyIssues: number): string[] {
    const improvements: string[] = []

    if (duplicates > 0) {
      improvements.push(`Reduce within-batch repetition (${duplicates} duplicates found)`)
    }

    if (crossBatchDuplicates > 0) {
      improvements.push(`Improve cross-batch uniqueness (${crossBatchDuplicates} cross-batch duplicates found)`)
    }

    if (sourceIssues > 0) {
      improvements.push(`Improve source fidelity (${sourceIssues} questions not well-supported by material)`)
    }

    if (difficultyIssues > 0) {
      improvements.push(`Improve difficulty accuracy (${difficultyIssues} questions have incorrect difficulty)`)
    }

    return improvements
  }

  /**
   * Determine if generation should continue based on quality trends
   */
  private shouldContinueGeneration(trend: 'improving' | 'declining' | 'stable', currentScore: number): boolean {
    if (!this.config.earlyTerminationEnabled) return true

    // Stop if quality is declining rapidly
    if (trend === 'declining' && currentScore < 0.5) {
      return false
    }

    // Continue in all other cases
    return true
  }

  /**
   * Get total duplicates across all batches
   */
  private getTotalDuplicates(): number {
    return this.batchResults.reduce((total, batch) => total + batch.duplicatesFound + batch.crossBatchDuplicates, 0)
  }

  /**
   * Get overall average quality across all batches
   */
  private getOverallAverageQuality(): number {
    if (this.qualityTrendHistory.length === 0) return 0
    return this.qualityTrendHistory.reduce((sum, score) => sum + score, 0) / this.qualityTrendHistory.length
  }
}