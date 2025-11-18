/**
 * Prompt Optimization Service
 *
 * A/B testing framework for systematically optimizing Groq prompts to eliminate
 * literal instruction interpretation and improve exam generation quality.
 *
 * Key Features:
 * - Few-shot learning with concrete examples
 * - Multiple prompt strategy testing
 * - Quality scoring and comparison
 * - Automatic best prompt selection
 * - Performance metrics tracking
 *
 * Addresses specific issues:
 * - Literal instruction inclusion (e.g., "[Continue with questions 2-80...]")
 * - Configuration complexity threshold problems
 * - Question type accuracy and completion rates
 */

import { GeneratedExam, QuestionType } from '../../shared/types/exam'
import { ExamQualityValidator } from './ExamQualityValidator'
import { GroqProvider, ExamGenerationConfig } from './GroqProvider'

/**
 * Prompt Strategy Types for A/B Testing
 */
export type PromptStrategy = 
  | 'current_dynamic'      // Existing dynamic prompt generation
  | 'few_shot_examples'    // Complete example-based prompts
  | 'minimal_instructions' // Shortened, essential-only prompts
  | 'concrete_examples'    // Replace placeholders with concrete examples
  | 'position_optimized'   // Strategic instruction placement

/**
 * Test Result for Individual Prompt Strategy
 */
export interface PromptTestResult {
  strategy: PromptStrategy
  prompt: string
  
  // Quality metrics
  literalInstructionCount: number
  qualityScore: number
  completionRate: number
  questionAccuracy: number
  
  // Performance metrics
  generationTimeMs: number
  tokenUsage: number
  
  // Detailed results
  examContent: string
  issues: string[]
  
  // Success indicators
  isClean: boolean  // No literal instructions
  isComplete: boolean  // All requested questions generated
  isAccurate: boolean  // Correct question types
}

/**
 * Optimization Test Configuration
 */
export interface OptimizationTestConfig {
  sourceText: string
  examConfig: ExamGenerationConfig
  testStrategies: PromptStrategy[]
  iterations: number  // How many times to test each strategy
  qualityThreshold: number  // Minimum quality score to consider successful
  timeoutMs: number  // Maximum time per generation
}

/**
 * Comprehensive Test Results
 */
export interface OptimizationResults {
  bestStrategy: PromptStrategy
  bestPrompt: string
  results: PromptTestResult[]
  
  // Strategy performance summary
  strategyScores: Record<PromptStrategy, {
    avgQuality: number
    avgCleanRate: number
    avgCompletionRate: number
    avgAccuracy: number
    totalTests: number
    successfulTests: number
  }>
  
  recommendations: string[]
  testDurationMs: number
}

/**
 * Few-Shot Example Templates for Different Question Types
 */
const FEW_SHOT_EXAMPLES = {
  multipleChoice: `Multiple Choice:
1. What is the primary function of mitochondria in cellular metabolism?
   A) Protein synthesis
   B) ATP production
   C) DNA replication
   D) Cell division
   Answer: B

2. Which organelle is responsible for processing and packaging proteins?
   A) Ribosome
   B) Nucleus
   C) Golgi apparatus
   D) Endoplasmic reticulum
   Answer: C`,

  trueFalse: `True/False:
1. All prokaryotic cells contain a membrane-bound nucleus.
   Answer: False

2. Enzymes are biological catalysts that speed up chemical reactions.
   Answer: True`,

  shortAnswer: `Short Answer:
1. Explain the role of DNA polymerase in DNA replication.
   Answer: DNA polymerase synthesizes new DNA strands by adding nucleotides to the 3' end of the growing strand, reading the template strand in the 3' to 5' direction.

2. What is the difference between mitosis and meiosis?
   Answer: Mitosis produces two identical diploid cells for growth and repair, while meiosis produces four genetically diverse haploid gametes for reproduction.`,

  fillInTheBlank: `Fill in the Blank:
1. The _______ is the powerhouse of the cell.
   Answer: mitochondrion

2. During photosynthesis, plants convert _______ and water into glucose using light energy.
   Answer: carbon dioxide`,

   matchingType: `Matching Type:
   1) Nucleus         A) Protein synthesis
   2) Ribosome        B) Genetic information storage
   3) Chloroplast     C) Photosynthesis
   4) Lysosome        D) Waste breakdown`,

  essay: `Essay:
1. Discuss the process of cellular respiration, including the three main stages and their locations within the cell.
   Answer: [Detailed essay answer about glycolysis, Krebs cycle, and electr
   \on transport chain]

2. Explain how natural selection drives evolutionary change in populations.
   Answer: [Detailed essay answer about variation, inheritance, selection pressures, and adaptation]`
}

/**
 * Prompt Optimization Service
 * 
 * Usage:
 * ```typescript
 * const optimizer = new PromptOptimizer(groqProvider)
 * const results = await optimizer.runOptimizationTest({
 *   sourceText: fileContent,
 *   examConfig: userConfig,
 *   testStrategies: ['current_dynamic', 'few_shot_examples', 'minimal_instructions'],
 *   iterations: 3,
 *   qualityThreshold: 0.8
 * })
 * 
 * console.log('Best strategy:', results.bestStrategy)
 * console.log('Quality improvement:', results.strategyScores[results.bestStrategy].avgQuality)
 * ```
 */
export class PromptOptimizer {
  private groqProvider: GroqProvider
  private qualityValidator?: ExamQualityValidator
  
  constructor(groqProvider: GroqProvider) {
    this.groqProvider = groqProvider
  }

  /**
   * Run comprehensive optimization test across multiple strategies
   */
  async runOptimizationTest(config: OptimizationTestConfig): Promise<OptimizationResults> {
    console.log('[PromptOptimizer] Starting optimization test with', config.testStrategies.length, 'strategies')
    
    const startTime = Date.now()
    this.qualityValidator = new ExamQualityValidator(config.sourceText)
    
    const allResults: PromptTestResult[] = []
    
    // Test each strategy multiple times
    for (const strategy of config.testStrategies) {
      console.log(`[PromptOptimizer] Testing strategy: ${strategy}`)
      
      for (let i = 0; i < config.iterations; i++) {
        try {
          const result = await this.testPromptStrategy(strategy, config, i + 1)
          allResults.push(result)
          
          console.log(`[PromptOptimizer] ${strategy} iteration ${i + 1}: quality=${result.qualityScore.toFixed(3)}, clean=${result.isClean}`)
        } catch (error) {
          console.error(`[PromptOptimizer] Failed ${strategy} iteration ${i + 1}:`, error)
        }
      }
    }
    
    // Analyze results and determine best strategy
    const results = this.analyzeResults(allResults, config)
    results.testDurationMs = Date.now() - startTime
    
    console.log('[PromptOptimizer] Optimization test complete:', {
      bestStrategy: results.bestStrategy,
      totalTests: allResults.length,
      duration: `${results.testDurationMs}ms`
    })
    
    return results
  }

  /**
   * Test individual prompt strategy
   */
  private async testPromptStrategy(
    strategy: PromptStrategy,
    config: OptimizationTestConfig,
    _iteration: number
  ): Promise<PromptTestResult> {
    
    const startTime = Date.now()
    
    // Generate prompt based on strategy
    const prompt = this.buildPromptForStrategy(strategy, config.examConfig, config.sourceText)
    
    try {
      // Generate exam using the test prompt
      const examContent = await this.groqProvider.generateExamWithPrompt(prompt, config.timeoutMs)
      
      const generationTime = Date.now() - startTime
      
      // Evaluate quality
      const evaluation = await this.evaluateGeneration(examContent, config.examConfig, config.sourceText)
      
      return {
        strategy,
        prompt,
        literalInstructionCount: evaluation.literalInstructionCount,
        qualityScore: evaluation.qualityScore,
        completionRate: evaluation.completionRate,
        questionAccuracy: evaluation.questionAccuracy,
        generationTimeMs: generationTime,
        tokenUsage: evaluation.tokenUsage,
        examContent,
        issues: evaluation.issues,
        isClean: evaluation.literalInstructionCount === 0,
        isComplete: evaluation.completionRate >= 0.9,
        isAccurate: evaluation.questionAccuracy >= 0.9,
      }
      
    } catch (error) {
      console.error(`[PromptOptimizer] Generation failed for ${strategy}:`, error)
      
      return {
        strategy,
        prompt,
        literalInstructionCount: 999, // Mark as failed
        qualityScore: 0,
        completionRate: 0,
        questionAccuracy: 0,
        generationTimeMs: Date.now() - startTime,
        tokenUsage: 0,
        examContent: '',
        issues: [`Generation failed: ${error}`],
        isClean: false,
        isComplete: false,
        isAccurate: false,
      }
    }
  }

  /**
   * Build prompt for specific strategy
   */
  private buildPromptForStrategy(strategy: PromptStrategy, config: ExamGenerationConfig, sourceText: string): string {
    switch (strategy) {
      case 'few_shot_examples':
        return this.buildFewShotPrompt(config, sourceText)
        
      case 'minimal_instructions':
        return this.buildMinimalPrompt(config, sourceText)
        
      case 'concrete_examples':
        return this.buildConcreteExamplesPrompt(config, sourceText)
        
      case 'position_optimized':
        return this.buildPositionOptimizedPrompt(config, sourceText)
        
      case 'current_dynamic':
      default:
        return this.groqProvider.buildExamPrompt(config, sourceText)
    }
  }

  /**
   * Build few-shot learning prompt with complete examples
   */
  private buildFewShotPrompt(config: ExamGenerationConfig, sourceText: string): string {
    const selectedTypes = Object.keys(config.questionTypes).filter(type => 
      config.questionTypes[type as keyof typeof config.questionTypes]! > 0
    )
    
    // Build examples section
    const exampleSections = selectedTypes.map(type => {
      const example = FEW_SHOT_EXAMPLES[type as keyof typeof FEW_SHOT_EXAMPLES]
      if (example) {
        return `${type.charAt(0).toUpperCase() + type.slice(1)} Example:\n${example}`
      }
      return `${type.charAt(0).toUpperCase() + type.slice(1)}: [No example available]`
    }).join('\n\n')
    
    return `You are an expert exam creator. Study these examples and create a similar exam from the provided material.

EXAMPLES OF PERFECT OUTPUT FORMAT:
${exampleSections}

CRITICAL REQUIREMENTS:
1. OUTPUT ONLY the exam content - no explanations, no instructions, no meta-text
2. Follow the EXACT format shown in examples above
3. Generate exactly ${config.totalQuestions} questions total:
${selectedTypes.map(type => `   - ${config.questionTypes[type as keyof typeof config.questionTypes]} ${type} questions`).join('\n')}
4. Base all questions strictly on the source material below

SOURCE MATERIAL:
${sourceText}

Generate the exam now using the format shown in examples:`
  }

  /**
   * Build minimal instructions prompt
   */
  private buildMinimalPrompt(config: ExamGenerationConfig, sourceText: string): string {
    const questionBreakdown = Object.keys(config.questionTypes)
      .filter(type => config.questionTypes[type as keyof typeof config.questionTypes]! > 0)
      .map(type => `${config.questionTypes[type as keyof typeof config.questionTypes]} ${type}`)
      .join(', ')

    return `Create ${config.totalQuestions} exam questions (${questionBreakdown}) from this material. Output exam only, no explanations.

Material: ${sourceText}

Format:
[Question Type]:
1. [question]
Answer: [answer]`
  }

  /**
   * Build concrete examples prompt (replace placeholders)
   */
  private buildConcreteExamplesPrompt(config: ExamGenerationConfig, sourceText: string): string {
    return this.groqProvider.buildExamPrompt(config, sourceText)
      .replace(/\[Question text here.*?\]/g, 'What is the primary function of...?')
      .replace(/\[Continue with.*?\]/g, '')
      .replace(/\[Generate.*?\]/g, '')
      .replace(/Continue for all requested.*/g, '')
  }

  /**
   * Build position-optimized prompt (critical instructions first and last)
   */
  private buildPositionOptimizedPrompt(config: ExamGenerationConfig, sourceText: string): string {
    const basePrompt = this.groqProvider.buildExamPrompt(config, sourceText)
    
    return `CRITICAL: Output ONLY exam content. No explanations or instructions.

${basePrompt}

CRITICAL: Do not include any instructional text like "[Continue with...]" or "[Generate...]". Output exam content only.`
  }

  /**
   * Evaluate generated exam content
   */
  private async evaluateGeneration(examContent: string, config: ExamGenerationConfig, _sourceText: string): Promise<{
    literalInstructionCount: number
    qualityScore: number
    completionRate: number
    questionAccuracy: number
    tokenUsage: number
    issues: string[]
  }> {
    
    const issues: string[] = []
    
    // Check for literal instructions
    const literalCheck = this.qualityValidator!.detectLiteralInstructions(examContent)
    const literalInstructionCount = literalCheck.patterns.length
    
    if (literalInstructionCount > 0) {
      issues.push(`Contains ${literalInstructionCount} literal instructions: ${literalCheck.patterns.join(', ')}`)
    }
    
    // Parse and validate if possible
    try {
      const parsed = await this.parseExamContent(examContent)
      
      // Calculate completion rate
      const expectedQuestions = config.totalQuestions
      const actualQuestions = parsed ? parsed.questions.length : 0
      const completionRate = Math.min(1.0, actualQuestions / expectedQuestions)
      
      // Calculate question type accuracy
      let questionAccuracy = 1.0
      if (parsed) {
        const expectedTypes = Object.keys(config.questionTypes).filter(type => 
          config.questionTypes[type as keyof typeof config.questionTypes]! > 0
        )
        const actualTypes = new Set(parsed.questions.map(q => q.type))
        
        for (const expectedType of expectedTypes) {
          if (!actualTypes.has(expectedType as QuestionType)) {
            questionAccuracy -= 0.2
          }
        }
      }
      
      // Calculate overall quality score
      let qualityScore = 1.0
      
      if (literalInstructionCount > 0) qualityScore -= 0.4
      if (completionRate < 0.9) qualityScore -= 0.3
      if (questionAccuracy < 0.9) qualityScore -= 0.2
      if (examContent.length < 500) qualityScore -= 0.1  // Suspiciously short
      
      qualityScore = Math.max(0, qualityScore)
      
      return {
        literalInstructionCount,
        qualityScore,
        completionRate,
        questionAccuracy,
        tokenUsage: examContent.length / 4, // Rough approximation
        issues,
      }
      
    } catch (parseError) {
      issues.push(`Failed to parse exam content: ${parseError}`)
      
      return {
        literalInstructionCount,
        qualityScore: 0.1, // Very low for unparseable content
        completionRate: 0,
        questionAccuracy: 0,
        tokenUsage: examContent.length / 4,
        issues,
      }
    }
  }

  /**
   * Parse exam content (simplified version)
   */
  private async parseExamContent(examContent: string): Promise<GeneratedExam | null> {
    // This is a simplified parser - in production you'd use your ExamParser service
    try {
      const lines = examContent.split('\n').filter(line => line.trim())
      const questions = []
      
      let currentQuestion = null
      let questionCounter = 0
      
      for (const line of lines) {
        // Simple pattern matching for question numbers
        if (/^\d+\./.test(line.trim())) {
          if (currentQuestion) {
            questions.push(currentQuestion)
          }
          
          questionCounter++
          currentQuestion = {
            id: `q${questionCounter}`,
            type: 'multipleChoice' as QuestionType, // Default assumption
            question: line.trim(),
            answer: 'Unknown',
            difficulty: 'moderate' as const,
          }
        }
      }
      
      if (currentQuestion) {
        questions.push(currentQuestion)
      }
      
      return {
        id: `test-exam-${Date.now()}`,
        topic: 'Test Topic',
        totalQuestions: questions.length,
        questions,
        createdAt: new Date(),
        metadata: {
          sourceFiles: [],
          aiProvider: 'groq',
          generationTime: 0,
        },
      }
      
    } catch (error) {
      console.error('[PromptOptimizer] Parse error:', error)
      return null
    }
  }

  /**
   * Analyze all test results and determine best strategy
   */
  private analyzeResults(allResults: PromptTestResult[], config: OptimizationTestConfig): OptimizationResults {
    const strategyScores: Record<PromptStrategy, any> = {
      current_dynamic: null,
      few_shot_examples: null,
      minimal_instructions: null,
      concrete_examples: null,
      position_optimized: null,
    }
    
    // Group results by strategy
    for (const strategy of config.testStrategies) {
      const strategyResults = allResults.filter(r => r.strategy === strategy)
      
      if (strategyResults.length > 0) {
        strategyScores[strategy] = {
          avgQuality: strategyResults.reduce((sum, r) => sum + r.qualityScore, 0) / strategyResults.length,
          avgCleanRate: strategyResults.filter(r => r.isClean).length / strategyResults.length,
          avgCompletionRate: strategyResults.reduce((sum, r) => sum + r.completionRate, 0) / strategyResults.length,
          avgAccuracy: strategyResults.reduce((sum, r) => sum + r.questionAccuracy, 0) / strategyResults.length,
          totalTests: strategyResults.length,
          successfulTests: strategyResults.filter(r => r.qualityScore >= config.qualityThreshold).length,
        }
      }
    }
    
    // Find best strategy (prioritize clean rate, then quality)
    let bestStrategy: PromptStrategy = config.testStrategies[0]
    let bestScore = 0
    
    for (const strategy of config.testStrategies) {
      const scores = strategyScores[strategy]
      if (scores) {
        // Weighted score: clean rate (50%) + quality (30%) + completion (20%)
        const weightedScore = (scores.avgCleanRate * 0.5) + (scores.avgQuality * 0.3) + (scores.avgCompletionRate * 0.2)
        
        if (weightedScore > bestScore) {
          bestScore = weightedScore
          bestStrategy = strategy
        }
      }
    }
    
    // Find best prompt from best strategy
    const bestStrategyResults = allResults.filter(r => r.strategy === bestStrategy)
    const bestPrompt = bestStrategyResults.length > 0 
      ? bestStrategyResults.reduce((best, current) => current.qualityScore > best.qualityScore ? current : best).prompt
      : ''
    
    // Generate recommendations
    const recommendations = this.generateOptimizationRecommendations(strategyScores, bestStrategy)
    
    return {
      bestStrategy,
      bestPrompt,
      results: allResults,
      strategyScores,
      recommendations,
      testDurationMs: 0, // Will be set by caller
    }
  }

  /**
   * Generate optimization recommendations
   */
  private generateOptimizationRecommendations(
    strategyScores: Record<PromptStrategy, any>,
    bestStrategy: PromptStrategy
  ): string[] {
    const recommendations: string[] = []
    
    const bestScore = strategyScores[bestStrategy]
    
    if (bestScore.avgCleanRate < 0.8) {
      recommendations.push('Consider implementing post-processing cleanup for literal instructions')
    }
    
    if (bestScore.avgQuality < 0.7) {
      recommendations.push('Overall quality still below target - consider additional strategies')
    }
    
    if (bestStrategy === 'few_shot_examples') {
      recommendations.push('Few-shot learning is most effective - consider expanding example library')
    }
    
    if (bestScore.avgCompletionRate < 0.9) {
      recommendations.push('Increase token limit or simplify question requirements')
    }
    
    recommendations.push(`Best strategy: ${bestStrategy} with ${(bestScore.avgCleanRate * 100).toFixed(1)}% clean rate`)
    
    return recommendations
  }
}

export default PromptOptimizer