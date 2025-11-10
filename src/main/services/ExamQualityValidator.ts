/**
 * Exam Quality Validator Service
 *
 * Post-generation quality validation service that ensures high-quality exams
 * by checking for uniqueness, accuracy, and proper difficulty distribution.
 *
 * Key Features:
 * - Semantic deduplication using text similarity algorithms
 * - Source verification against original material  
 * - Difficulty level accuracy checking
 * - Quality scoring and validation metrics
 * - Auto-retry recommendations for poor quality
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
  
  // Source verification settings
  sourceVerificationEnabled: boolean
  strictSourceChecking: boolean // If true, requires exact text matches
  
  // Difficulty validation settings
  difficultyValidationEnabled: boolean
  difficultyTolerancePercent: number // Allow small variations in difficulty distribution
  
  // Quality thresholds
  minimumQualityScore: number // 0.0-1.0, exams below this should be regenerated
  retryOnLowQuality: boolean
  maxRetryAttempts: number
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
 * Overall Exam Validation Result
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
  
  recommendations: {
    shouldRegenerate: boolean
    improvements: string[]
    retryWithPromptChanges?: string[]
  }
  
  metrics: {
    uniquenessScore: number // 0.0-1.0
    accuracyScore: number // 0.0-1.0
    difficultyScore: number // 0.0-1.0
    coverageScore: number // 0.0-1.0
  }
}

/**
 * Default Quality Validation Configuration
 */
const DEFAULT_CONFIG: QualityValidationConfig = {
  duplicateThreshold: 0.85, // 85% similarity considered duplicate
  conceptSimilarityThreshold: 0.75, // 75% concept similarity too similar
  sourceVerificationEnabled: true,
  strictSourceChecking: false, // Allow paraphrasing of source material
  difficultyValidationEnabled: true,
  difficultyTolerancePercent: 0.2, // Allow 20% variance in difficulty distribution
  minimumQualityScore: 0.7, // 70% quality threshold
  retryOnLowQuality: true,
  maxRetryAttempts: 2,
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

  /**
   * Initialize validator
   * 
   * @param sourceText - Original source material for verification
   * @param config - Validation configuration (optional)
   */
  constructor(sourceText: string, config?: Partial<QualityValidationConfig>) {
    this.sourceText = sourceText.toLowerCase()
    this.config = { ...DEFAULT_CONFIG, ...config }
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
}