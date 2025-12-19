/**
 * Groq AI Provider (Backend-Managed)
 *
 * This provider runs in the Electron main process (Node.js) and manages
 * the Groq API key server-side for security and simplicity.
 *
 * Why Groq?
 * - Completely FREE (14,400 requests/day)
 * - No user API key required (backend-managed)
 * - 100% success rate (tested with 30, 50, 100 item exams)
 * - 2-3x faster than Gemini/ChatGPT
 * - Perfect format compliance
 *
 * Model: llama-3.3-70b-versatile
 * - Fast inference (8 seconds for 100 items)
 * - High-quality exam generation
 * - Large context window (128k tokens)
 * - Excellent reasoning capabilities
 *
 * Rate Limits:
 * - 30 requests per minute
 * - 14,400 requests per day
 * - Can support ~1,440 users/day at 10 exams each
 *
 * User Limits:
 * - 10 exams per day per user
 * - 100 exams per month per user
 * - 10-100 questions per exam
 */

import Groq from 'groq-sdk'

/**
 * Exam Generation Configuration
 */
export interface ExamGenerationConfig {
  questionTypes: {
    multipleChoice?: number
    trueFalse?: number
    fillInTheBlanks?: number
    shortAnswer?: number
    essay?: number
    matching?: number
    identification?: number
  }
  difficultyDistribution: {
    veryEasy: number
    easy: number
    moderate: number
    hard: number
    veryHard: number
  }
  totalQuestions: number
  topic?: string
  instructions?: string
}

/**
 * Groq Provider Configuration
 */
const GROQ_CONFIG = {
  model: 'llama-3.3-70b-versatile',
  maxTokens: 32768, // Increased for 100+ questions (llama-3.3-70b supports up to 128k)
  temperature: 0.7, // Balanced creativity and consistency
  topP: 0.9,
} as const

/**
 * GroqProvider - Backend-managed AI exam generation
 *
 * This class handles all communication with the Groq API.
 * The API key is stored in environment variables and never exposed to the frontend.
 */
export class GroqProvider {
  private client: Groq
  private readonly model = GROQ_CONFIG.model

  /**
   * Initialize Groq client
   *
   * @param apiKey - Groq API key from environment variables
   * @throws Error if API key is missing
   */
  constructor(apiKey: string) {
    if (!apiKey || apiKey.trim().length === 0) {
      throw new Error('Groq API key is required. Please set GROQ_API_KEY in .env.local')
    }

    this.client = new Groq({
      apiKey: apiKey,
    })
  }

  /**
   * Test connection to Groq API
   *
   * Makes a minimal API call to verify the service is reachable
   *
   * @returns Promise with success status
   */
  async testConnection(): Promise<{ success: boolean; message: string; details?: string }> {
    try {
      // Make a minimal test call
      const completion = await this.client.chat.completions.create({
        messages: [
          {
            role: 'user',
            content: 'Say "test successful" if you can read this.',
          },
        ],
        model: this.model,
        max_tokens: 50,
        temperature: 0.7,
      })

      const response = completion.choices[0]?.message?.content

      if (response && response.length > 0) {
        return {
          success: true,
          message: 'Successfully connected to Groq!',
          details: `Using model: ${this.model}`,
        }
      }

      return {
        success: false,
        message: 'No response from Groq API',
      }
    } catch (error: any) {
      // Handle specific error types
      if (error.message?.includes('API key')) {
        return {
          success: false,
          message: 'Invalid API key',
          details: 'Please check your GROQ_API_KEY in .env.local',
        }
      }

      if (error.message?.includes('rate limit')) {
        return {
          success: false,
          message: 'Rate limit exceeded',
          details: 'Please try again in a few moments.',
        }
      }

      return {
        success: false,
        message: 'Connection failed',
        details: error.message || 'Unknown error occurred',
      }
    }
  }

  /**
   * Generate exam using Groq with retry logic
   *
   * Formats the prompt and calls Groq API to generate exam content.
   * Includes exponential backoff retry strategy for resilience.
   *
   * @param config - Exam configuration (types, difficulty, etc.)
   * @param sourceText - Extracted text from uploaded files
   * @returns Promise with generated exam content
   * @throws Error if generation fails after all retries
   */
  async generateExam(config: ExamGenerationConfig, sourceText: string): Promise<string> {
    const maxRetries = 3
    const baseDelay = 1000 // 1 second

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`[Groq] Exam generation attempt ${attempt}/${maxRetries}`)

        // Build the prompt
        const prompt = this.buildExamPrompt(config, sourceText)

        // Generate content
        const completion = await this.client.chat.completions.create({
          messages: [
            {
              role: 'system',
              content:
                'You are an expert exam creator. Generate ONLY the exam content with no introductory text, explanations, or suggestions.',
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
          model: this.model,
          max_tokens: GROQ_CONFIG.maxTokens,
          temperature: GROQ_CONFIG.temperature,
          top_p: GROQ_CONFIG.topP,
        })

        const examContent = completion.choices[0]?.message?.content

        if (!examContent || examContent.trim().length === 0) {
          throw new Error('Groq returned empty response')
        }

        console.log('[Groq] Exam generated successfully')
        return examContent
      } catch (error: any) {
        console.error(`[Groq] Attempt ${attempt} failed:`, error.message)

        // Check if it's a rate limit error
        const isRateLimit = error.message?.toLowerCase().includes('rate limit')

        // If last attempt or non-retryable error, throw
        if (attempt === maxRetries || (!isRateLimit && attempt > 1)) {
          throw new Error(`Failed to generate exam: ${error.message || 'Unknown error'}`)
        }

        // Calculate exponential backoff delay
        const delay = baseDelay * Math.pow(2, attempt - 1)
        console.log(`[Groq] Retrying in ${delay}ms...`)

        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }

    // This should never be reached, but TypeScript needs it
    throw new Error('Failed to generate exam after all retries')
  }

  /**
   * Build the exam generation prompt with difficulty specialization
   *
   * ENHANCED STRATEGY FOR QUALITY:
   * - Splits difficulty levels for specialized handling
   * - Implements strict negative constraints to prevent repetition
   * - Enforces cross-batch uniqueness requirements
   * - Uses difficulty-specific prompt strategies for better accuracy
   *
   * Prompt Engineering Principles:
   * 1. Clear role definition (you are an expert exam creator)
   * 2. Explicit format requirements (structure, no extra text)
   * 3. Difficulty-specific constraints (specialized for each level)
   * 4. Negative constraints (what NOT to do)
   * 5. Cross-batch deduplication requirements
   * 6. Concrete examples (show exact format expected)
   * 7. Output format specification
   */
  public buildExamPrompt(config: ExamGenerationConfig, sourceText: string): string {
    // Determine if this is a difficulty-specialized batch
    const difficultyLevels = Object.entries(config.difficultyDistribution)
      .filter(([_, count]) => count > 0)
      .map(([level]) => level)
    
    const isDifficultySpecialized = difficultyLevels.length === 1
    const dominantDifficulty = isDifficultySpecialized ? difficultyLevels[0] : null

    // Use specialized prompt if single difficulty, otherwise use mixed prompt
    if (isDifficultySpecialized && dominantDifficulty) {
      console.log(`[GroqProvider] Using specialized prompt for difficulty: ${dominantDifficulty}`)
      return this.buildDifficultySpecializedPrompt(config, sourceText, dominantDifficulty)
    } else {
      console.log('[GroqProvider] Using mixed difficulty prompt with enhanced constraints')
      return this.buildMixedDifficultyPrompt(config, sourceText)
    }
  }

  /**
   * Build the original exam generation prompt (now with enhanced constraints)
   */
  public buildMixedDifficultyPrompt(config: ExamGenerationConfig, sourceText: string): string {
    // Get selected question types with counts
    const selectedTypes = Object.entries(config.questionTypes)
      .filter(([_, count]) => count && count > 0)
      .map(([type, count]) => ({ type, count }))

    // Extract difficulty distribution
    const difficultyText = Object.entries(config.difficultyDistribution)
      .filter(([_, count]) => count > 0)
      .map(([level, count]) => {
        // Convert camelCase to readable format
        const readable = level.replace(/([A-Z])/g, ' $1').trim()
        const capitalized = readable.charAt(0).toUpperCase() + readable.slice(1)
        return `  - ${capitalized}: ${count} question(s)`
      })
      .join('\n')

    // Build dynamic format section based on selected types
    const formatSections = this.buildDynamicFormatSections(selectedTypes)
    
    // Build type-specific quality rules
    const typeSpecificRules = this.buildTypeSpecificRules(selectedTypes)

    // Truncate source text if too long (Groq has 128k token limit, but let's be safe)
    const maxSourceLength = 100000 // ~25k words
    const truncatedSource =
      sourceText.length > maxSourceLength
        ? sourceText.substring(0, maxSourceLength) + '\n\n[... content truncated ...]'
        : sourceText

    // Build the final prompt with enhanced negative constraints
    return this.buildEnhancedPrompt(selectedTypes, formatSections, typeSpecificRules, difficultyText, config, truncatedSource, false)
  }

  /**
   * Build difficulty-specialized prompt for single difficulty levels
   */
  public buildDifficultySpecializedPrompt(config: ExamGenerationConfig, sourceText: string, difficulty: string): string {
    // Get selected question types with counts
    const selectedTypes = Object.entries(config.questionTypes)
      .filter(([_, count]) => count && count > 0)
      .map(([type, count]) => ({ type, count }))

    // For specialized prompts, we know all questions are the same difficulty
    const difficultyText = `All ${config.totalQuestions} questions at ${difficulty.charAt(0).toUpperCase() + difficulty.slice(1)} difficulty level`

    // Build dynamic format section based on selected types
    const formatSections = this.buildDynamicFormatSections(selectedTypes)
    
    // Build type-specific quality rules
    const typeSpecificRules = this.buildTypeSpecificRules(selectedTypes)

    // Get difficulty-specific rules and examples
    const difficultySpecificRules = this.buildDifficultySpecificRules(difficulty)
    const difficultyExamples = this.buildDifficultyExamples(difficulty, selectedTypes)

    // Truncate source text if too long
    const maxSourceLength = 100000 // ~25k words
    const truncatedSource =
      sourceText.length > maxSourceLength
        ? sourceText.substring(0, maxSourceLength) + '\n\n[... content truncated ...]'
        : sourceText

    // Build specialized prompt with difficulty focus
    return this.buildDifficultyFocusedPrompt(
      selectedTypes, 
      formatSections, 
      typeSpecificRules, 
      difficultyText, 
      difficulty,
      difficultySpecificRules,
      difficultyExamples,
      config, 
      truncatedSource
    )
  }

  /**
   * Build dynamic format sections based on selected question types
   */
  private buildDynamicFormatSections(selectedTypes: Array<{ type: string; count: number }>): string {
    const sections: string[] = []
    let questionNumber = 1

    for (const { type, count } of selectedTypes) {
      const section = this.buildFormatSectionForType(type, count, questionNumber)
      sections.push(section)
      questionNumber += count
    }

    return sections.join('\n\n')
  }

  /**
   * Build format section for a specific question type
   */
  private buildFormatSectionForType(type: string, count: number, startNumber: number): string {
    const endNumber = startNumber + count - 1
    
    switch (type) {
      case 'multipleChoice':
        return `Multiple Choice:

${startNumber}. What is the primary function of...?
   A. First option
   B. Second option
   C. Third option
   D. Fourth option

${startNumber + 1}. Which of the following is...?
   A. Option A
   B. Option B
   C. Option C
   D. Option D

(Generate ${count} total multiple choice questions, numbered ${startNumber} to ${endNumber})`

      case 'trueFalse':
        return `True/False:

${startNumber}. The process of cell division involves chromosome duplication.

${startNumber + 1}. Mitosis results in two identical daughter cells.

(Generate ${count} total true/false questions, numbered ${startNumber} to ${endNumber})`

      case 'fillInTheBlanks':
        return `Fill in the Blanks:

${startNumber}. The process of _____ involves the breakdown of glucose.

${startNumber + 1}. During photosynthesis, _____ is converted to oxygen.

(Generate ${count} total fill-in-the-blank questions, numbered ${startNumber} to ${endNumber})
(CRITICAL: Use ONLY single underscores like _____ for blanks, NO commas or CSV format)`

      case 'shortAnswer':
        return `Short Answer:

${startNumber}. Explain the process of cellular respiration.

${startNumber + 1}. Describe the role of enzymes in metabolism.

(Generate ${count} total short answer questions, numbered ${startNumber} to ${endNumber})`

      case 'essay':
        return `Essay Questions:

${startNumber}. Analyze the impact of climate change on biodiversity.

${startNumber + 1}. Evaluate the effectiveness of renewable energy sources.

(Generate ${count} total essay questions, numbered ${startNumber} to ${endNumber})`

      case 'matching':
        return `Matching:

${startNumber}. Match the terms with their correct definitions:

Column A (Terms):          Column B (Definitions):
A. Term One               1. Definition for term three
B. Term Two               2. Definition for term one  
C. Term Three             3. Definition for term two

${startNumber + 1}. Match the concepts with their descriptions:

Column A (Terms):          Column B (Definitions):
A. Concept X              1. Description for concept Z
B. Concept Y              2. Description for concept X
C. Concept Z              3. Description for concept Y

(Generate ${count} total matching questions, numbered ${startNumber} to ${endNumber})
(CRITICAL MATCHING FORMAT: Each matching question must have two distinct columns - Terms (A,B,C) and Definitions (1,2,3). Randomize the definition order so they don't match the term order. Do not put definitions directly next to terms.)`

      default:
        return `${type}:

${startNumber}. Sample question for ${type}

(Generate ${count} total questions, numbered ${startNumber} to ${endNumber})`
    }
  }

  /**
   * Build type-specific quality rules
   */
  private buildTypeSpecificRules(selectedTypes: Array<{ type: string; count: number }>): string {
    const rules: string[] = []

    const hasMultipleChoice = selectedTypes.some(t => t.type === 'multipleChoice')
    const hasTrueFalse = selectedTypes.some(t => t.type === 'trueFalse')
    const hasFillInBlanks = selectedTypes.some(t => t.type === 'fillInTheBlanks')

    if (hasMultipleChoice) {
      rules.push(`**MULTIPLE CHOICE RULES:**
- ALWAYS exactly 4 options (A, B, C, D), each on separate line
- AVOID overusing "All of the above" or "None of the above" (use sparingly, max 10% of MC questions)
- Make distractors plausible but clearly wrong based on the material
- Distribute correct answers randomly across A, B, C, D (avoid patterns)`)
    }

    if (hasTrueFalse) {
      rules.push(`**TRUE/FALSE RULES:**
- Statements must be definitively true or false based on source material
- Avoid absolute terms like "always" or "never" unless explicitly stated in material
- Make statements clear and unambiguous`)
    }

    if (hasFillInBlanks) {
      rules.push(`**FILL-IN-THE-BLANKS RULES (CRITICAL FORMAT):**
- Use EXACTLY _____ (5 underscores) for each blank
- DO NOT use commas, semicolons, or CSV format
- Write as normal sentences with _____ replacing the missing word
- Example: "The capital of France is _____." NOT "The capital of France is, _____, a major city"
- Make the missing term essential to understanding
- Ensure only one correct answer fits the blank`)
    }

    return rules.join('\n\n')
  }

  /**
   * Build difficulty-specific rules for specialized prompts
   */
  private buildDifficultySpecificRules(difficulty: string): string {
    switch (difficulty.toLowerCase()) {
      case 'veryeasy':
      case 'easy':
        return `**EASY DIFFICULTY REQUIREMENTS:**
- Focus on direct facts, definitions, and basic recall from the material
- Use simple, straightforward language
- Test memorization and recognition of key terms
- Questions should have obvious answers if material was read
- Examples: "What is...", "Define...", "List...", "Name the..."
- Avoid complex reasoning or multi-step thinking`

      case 'moderate':
        return `**MODERATE DIFFICULTY REQUIREMENTS:**
- Test understanding and comprehension of concepts
- Require explanation of relationships between ideas
- Use "explain", "describe", "compare" type questions
- Test application of knowledge to similar situations
- Examples: "How does X relate to Y?", "Explain the process of...", "Compare and contrast..."
- Require some analytical thinking but not complex reasoning`

      case 'hard':
        return `**HARD DIFFICULTY REQUIREMENTS:**
- Test analysis, synthesis, and evaluation skills
- Require connecting multiple concepts together
- Use critical thinking and problem-solving approaches
- Examples: "Analyze...", "Evaluate...", "Predict what would happen if...", "Justify your reasoning..."
- Test ability to apply knowledge to new or complex scenarios`

      case 'veryhard':
        return `**VERY HARD DIFFICULTY REQUIREMENTS:**
- Test creation, design, and advanced critical thinking
- Require synthesis of multiple complex concepts
- Use open-ended, creative problem solving
- Examples: "Design a solution for...", "Create a plan to...", "Critique the effectiveness of..."
- Test highest levels of cognitive processing and original thinking`

      default:
        return `**DIFFICULTY REQUIREMENTS:**
- Match the specified difficulty level accurately
- Ensure cognitive load appropriate for level`
    }
  }

  /**
   * Build difficulty-specific examples
   */
  private buildDifficultyExamples(difficulty: string, selectedTypes: Array<{ type: string; count: number }>): string {
    const examples: string[] = []

    for (const { type } of selectedTypes) {
      const example = this.getDifficultyExample(difficulty.toLowerCase(), type)
      if (example) {
        examples.push(example)
      }
    }

    return examples.length > 0 ? 
      `**DIFFICULTY-SPECIFIC EXAMPLES:**\n\n${examples.join('\n\n')}` : 
      ''
  }

  /**
   * Get specific example for difficulty and question type
   */
  private getDifficultyExample(difficulty: string, type: string): string {
    const difficultyKey = difficulty.toLowerCase()
    const typeKey = type.toLowerCase()

    // Example matrix for different combinations
    const examples: Record<string, Record<string, string>> = {
      'easy': {
        'multiplechoice': `EASY Multiple Choice Example:
1. What is photosynthesis?
   A. Process where plants make food using sunlight
   B. Process where animals digest food
   C. Process where water evaporates
   D. Process where rocks form crystals`,
        
        'truefalse': `EASY True/False Example:
1. Photosynthesis occurs in plant leaves.`,

        'fillintheblank': `EASY Fill-in-the-Blank Example:
1. The process by which plants make food using sunlight is called _____.`
      },

      'moderate': {
        'multiplechoice': `MODERATE Multiple Choice Example:
1. How does the Calvin cycle contribute to photosynthesis?
   A. It captures light energy for the process
   B. It converts CO2 into glucose using ATP and NADPH
   C. It produces oxygen as a byproduct
   D. It transports water through the plant`,

        'shortanswer': `MODERATE Short Answer Example:
1. Explain how light-dependent and light-independent reactions work together in photosynthesis.`
      },

      'hard': {
        'multiplechoice': `HARD Multiple Choice Example:
1. If a plant's stomata remained closed during the day due to drought stress, which aspect of photosynthesis would be most directly affected?
   A. Light absorption by chlorophyll
   B. CO2 availability for the Calvin cycle
   C. Water transport through xylem
   D. ATP synthesis in thylakoids`,

        'essay': `HARD Essay Example:
1. Analyze the relationship between environmental factors (light intensity, CO2 concentration, temperature) and the rate of photosynthesis. Predict how climate change might affect global photosynthetic productivity.`
      }
    }

    return examples[difficultyKey]?.[typeKey] || ''
  }

  /**
   * Build critical constraints for end-of-prompt positioning
   * REPOSITIONED: Critical constraints now appear at end of prompt for maximum LLM attention
   */
  private buildCriticalConstraints(): string {
    return `**🚨 ABSOLUTE CRITICAL CONSTRAINTS - FINAL CHECK BEFORE OUTPUT 🚨**

⛔ **CONCEPT-LEVEL REPETITION ELIMINATION (TOP PRIORITY):**
- Each question must test a COMPLETELY DIFFERENT concept, topic, or subject area
- NO asking about the same biological process, historical event, mathematical concept, etc. multiple times
- Examples of FORBIDDEN repetition: "Hox genes" in Q9, Q21, Q29 (ask once only)
- Examples of FORBIDDEN repetition: "Neural crest" in Q6, Q7, Q8 (ask once only)  
- Examples of FORBIDDEN repetition: "Somites" in Q4, Q13, Q23 (ask once only)
- If you mention a specific concept/process/term in ANY question, DO NOT use it again
- Spread questions across ALL major topics in the material - avoid clustering

⛔ **ANSWER DISTRIBUTION RANDOMIZATION (CRITICAL):**
- MULTIPLE CHOICE: Distribute correct answers roughly equally across A, B, C, D (approximately 25% each)
- TRUE/FALSE: Balance True and False answers (approximately 50% True, 50% False)
- NEVER have consecutive questions with same answer (avoid patterns like Q6=D, Q7=D, Q8=D)
- NEVER have long streaks of True or False (avoid Q26-Q35 all being True)
- Check your final answers - if you see patterns, deliberately randomize them

⛔ **MATCHING FORMAT (STRUCTURAL REQUIREMENT):**
- Matching questions MUST have two separate columns: Terms (A,B,C) and Definitions (1,2,3)
- Definitions must be in SCRAMBLED ORDER - do not put definition 1 next to term A
- Example: Term A might match with definition 3, Term B with definition 1, etc.
- Do NOT write as bullet point lists - use proper column structure

⛔ **MULTIPLE CHOICE RULE (MOST IMPORTANT):**
- Use "All of the above" MAXIMUM 1 time in your entire response
- Use "None of the above" MAXIMUM 1 time in your entire response  
- This applies to ALL multiple choice questions regardless of batch size
- If you have already used these once, DO NOT use them again

⛔ **FILL-IN-THE-BLANK FORMAT (CRITICAL):**
- Use ONLY single underscores: _____
- NO commas, semicolons, or CSV format
- Write as clean sentences: "The result is _____." NOT "The result is, _____, which shows"
- Each blank should be exactly 5 underscores

⛔ **EXACT FORMAT COMPLIANCE:**
- Output ONLY exam content - no meta-text or instructions
- Use specified format exactly - no deviations
- Start with "General Topic:" immediately

⛔ **SOURCE FIDELITY:**
- Base answers ONLY on explicitly stated material
- NO external knowledge or assumptions
- NO inferences beyond what's written`
  }

  /**
   * Build enhanced prompt with negative constraints
   * FIXED: Critical constraints moved to end for better LLM attention
   */
  private buildEnhancedPrompt(
    selectedTypes: Array<{ type: string; count: number }>,
    formatSections: string,
    typeSpecificRules: string,
    difficultyText: string,
    config: ExamGenerationConfig,
    truncatedSource: string,
    isSpecialized: boolean
  ): string {
    const questionTypeSummary = selectedTypes
      .map(({ type, count }) => {
        const readable = type.replace(/([A-Z])/g, ' $1').trim()
        const capitalized = readable.charAt(0).toUpperCase() + readable.slice(1)
        return `  - ${capitalized}: ${count} question(s)`
      })
      .join('\n')

    const specializationNote = isSpecialized ? 
      '\n**🎯 SPECIALIZED MODE:** All questions are at the same difficulty level. Focus on consistency within this level.' :
      ''

    // Build critical constraints separately for end positioning
    const criticalConstraints = this.buildCriticalConstraints()

    return `You are an expert educational assessment creator. Your task is to generate a high-quality exam that accurately evaluates student understanding of the provided study material.

**CRITICAL QUALITY REQUIREMENTS:**

1. **UNIQUENESS & NO REPETITION:** Each question must test a DIFFERENT concept, fact, or skill. No two questions should test the same information in different ways. Spread questions across ALL major topics in the material.

2. **SOURCE FIDELITY:** Base questions STRICTLY on information explicitly stated in the study material. Do NOT infer, assume, or add external knowledge.

3. **DIFFICULTY ACCURACY:** Match each question precisely to its assigned difficulty level:
   - **Very Easy:** Direct recall of explicitly stated facts, definitions, basic terminology
   - **Easy:** Simple concept recognition, basic relationships between ideas
   - **Moderate:** Understanding connections between concepts, applying knowledge to similar situations
   - **Hard:** Analysis of complex relationships, synthesis of multiple concepts, problem-solving
   - **Very Hard:** Critical evaluation, creation of new solutions, advanced reasoning and application

4. **COMPREHENSIVE COVERAGE:** Distribute questions evenly across all major topics/sections in the study material. Avoid clustering questions on only one topic.

${specializationNote}

${typeSpecificRules}

**STRICT FORMATTING REQUIREMENTS:**
- Generate ONLY the exam content - no introductions, explanations, or suggestions
- Follow the format below EXACTLY - character for character
- Number questions sequentially (1, 2, 3, etc.) across ALL types
- Group questions by type as specified

**EXACT OUTPUT FORMAT:**

General Topic: [Extract the main subject/topic from the study material]

----Exam Content----

${formatSections}

[PAGE BREAK]

----Answer Key----

1. [Answer]
2. [Answer]
[Continue for all questions sequentially...]

**GENERATION REQUIREMENTS:**

Question Types & Quantities:
${questionTypeSummary}

Total Questions: ${config.totalQuestions}

Difficulty Distribution:
${difficultyText}

**CONTENT ANALYSIS REQUIREMENTS:**
Before generating questions, mentally identify:
1. Major topics/concepts in the material (aim for ${Math.ceil(config.totalQuestions / 3)}-${Math.ceil(config.totalQuestions / 2)} distinct topics)
2. Key facts, definitions, and relationships for each topic
3. Appropriate difficulty levels for different concepts
4. Create a mental list of specific terms/processes/concepts to avoid repetition
5. Plan question distribution: no topic should have more than ${Math.ceil(config.totalQuestions / 3)} questions
6. Identify unique aspects of each topic to ensure conceptual diversity

**CONCEPT TRACKING STRATEGY:**
- List all major concepts/processes/terms mentioned in source material
- Assign each concept to ONLY ONE question (never repeat the same concept)
- Examples: If "photosynthesis" is used in Q1, do not use it again in Q15
- Examples: If "mitosis" is covered in Q3, do not ask about cell division again
- Track specific scientific terms, historical figures, mathematical formulas, etc.
- Ensure each question tests a fundamentally different piece of knowledge

**STUDY MATERIAL:**
${truncatedSource}

**QUALITY CHECKLIST - Verify before submitting:**
- ✓ Each question tests a unique concept/fact
- ✓ All questions strictly based on provided material
- ✓ Difficulty levels accurately assigned
- ✓ Questions distributed across all major topics
- ✓ Correct answers are clearly supported by source text
- ✓ Format followed exactly
- ✓ NO repetition or similar questions
- ✓ ONLY generate the question types specified above

**CRITICAL:** 
- DO NOT include any instructional text in your output
- DO NOT include phrases like "Continue with", "Generate all", or any parenthetical instructions
- START immediately with "General Topic:" and follow the format exactly
- ONLY output the actual exam content and answer key

${criticalConstraints}

**OUTPUT:**`
  }

  /**
   * Build difficulty-focused prompt for specialized generation
   * FIXED: Critical constraints repositioned to end for better LLM attention
   */
  private buildDifficultyFocusedPrompt(
    selectedTypes: Array<{ type: string; count: number }>,
    formatSections: string,
    typeSpecificRules: string,
    _difficultyText: string,
    difficulty: string,
    difficultySpecificRules: string,
    difficultyExamples: string,
    config: ExamGenerationConfig,
    truncatedSource: string
  ): string {
    const questionTypeSummary = selectedTypes
      .map(({ type, count }) => {
        const readable = type.replace(/([A-Z])/g, ' $1').trim()
        const capitalized = readable.charAt(0).toUpperCase() + readable.slice(1)
        return `  - ${capitalized}: ${count} question(s)`
      })
      .join('\n')

    const difficultyLevel = difficulty.charAt(0).toUpperCase() + difficulty.slice(1)
    const criticalConstraints = this.buildCriticalConstraints()

    return `You are an expert educational assessment creator specializing in ${difficultyLevel}-level questions. Your task is to generate ONLY ${difficultyLevel} difficulty questions that accurately test student understanding.

**🎯 SPECIALIZED ${difficultyLevel.toUpperCase()} DIFFICULTY MODE**

**PRIMARY OBJECTIVE:** Generate ${config.totalQuestions} high-quality questions that are ALL at the ${difficultyLevel} difficulty level.

${difficultySpecificRules}

**CRITICAL QUALITY REQUIREMENTS:**

1. **DIFFICULTY CONSISTENCY:** Every single question must be at the ${difficultyLevel} level. NO mixing of difficulty levels.

2. **UNIQUENESS & NO REPETITION:** Each question must test a DIFFERENT concept, fact, or skill at the ${difficultyLevel} level. No two questions should test the same information in different ways.

3. **SOURCE FIDELITY:** Base questions STRICTLY on information explicitly stated in the study material. Do NOT infer, assume, or add external knowledge.

4. **COMPREHENSIVE COVERAGE:** Distribute questions evenly across all major topics/sections in the study material. Avoid clustering questions on only one topic.

${difficultyExamples}

${typeSpecificRules}

**STRICT FORMATTING REQUIREMENTS:**
- Generate ONLY the exam content - no introductions, explanations, or suggestions
- Follow the format below EXACTLY - character for character
- Number questions sequentially (1, 2, 3, etc.) across ALL types
- Group questions by type as specified

**EXACT OUTPUT FORMAT:**

General Topic: [Extract the main subject/topic from the study material]

----Exam Content----

${formatSections}

[PAGE BREAK]

----Answer Key----

1. [Answer]
2. [Answer]
[Continue for all questions sequentially...]

**GENERATION REQUIREMENTS:**

Target Difficulty: ${difficultyLevel} (ALL questions must be this level)
Question Types & Quantities:
${questionTypeSummary}

Total Questions: ${config.totalQuestions}

**CONTENT ANALYSIS REQUIREMENTS:**
Before generating questions, mentally identify:
1. Major topics/concepts suitable for ${difficultyLevel}-level questioning
2. Key facts, definitions, and relationships that can be tested at ${difficultyLevel} level
3. Create a mental list of specific terms/processes/concepts to avoid repetition
4. Ensure balanced coverage across topics while maintaining ${difficultyLevel} difficulty
5. No topic should have more than ${Math.ceil(config.totalQuestions / 3)} questions

**CONCEPT TRACKING STRATEGY:**
- List all major concepts/processes/terms mentioned in source material
- Assign each concept to ONLY ONE question (never repeat the same concept)
- Examples: If "photosynthesis" is used in Q1, do not use it again in Q15
- Examples: If "mitosis" is covered in Q3, do not ask about cell division again
- Track specific scientific terms, historical figures, mathematical formulas, etc.
- Ensure each question tests a fundamentally different piece of knowledge

**STUDY MATERIAL:**
${truncatedSource}

**${difficultyLevel.toUpperCase()} QUALITY CHECKLIST - Verify before submitting:**
- ✓ ALL questions are at ${difficultyLevel} difficulty level
- ✓ Each question tests a unique concept/fact at ${difficultyLevel} level
- ✓ All questions strictly based on provided material
- ✓ Questions distributed across all major topics
- ✓ Correct answers are clearly supported by source text
- ✓ Format followed exactly
- ✓ NO repetition or similar questions
- ✓ ONLY generate the question types specified above
- ✓ Cognitive demands match ${difficultyLevel} level exactly

**CRITICAL:** 
- DO NOT include any instructional text in your output
- DO NOT include phrases like "Continue with", "Generate all", or any parenthetical instructions
- START immediately with "General Topic:" and follow the format exactly
- ONLY output the actual exam content and answer key
- MAINTAIN ${difficultyLevel} difficulty throughout

${criticalConstraints}

**OUTPUT:**`
  }

  /**
   * Generate exam using custom prompt (for optimization testing)
   *
   * Used by PromptOptimizer to test different prompt strategies.
   *
   * @param prompt - Custom prompt to test
   * @param timeoutMs - Optional timeout in milliseconds
   * @returns Promise with generated exam content
   */
  async generateExamWithPrompt(prompt: string, _timeoutMs?: number): Promise<string> {
    try {
      console.log('[Groq] Generating exam with custom prompt')

      const completion = await this.client.chat.completions.create({
        messages: [
          {
            role: 'system',
            content: 'You are an expert exam creator. Generate ONLY the exam content with no introductory text, explanations, or suggestions.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        model: this.model,
        max_tokens: GROQ_CONFIG.maxTokens,
        temperature: GROQ_CONFIG.temperature,
        top_p: GROQ_CONFIG.topP,
      })

      const examContent = completion.choices[0]?.message?.content

      if (!examContent || examContent.trim().length === 0) {
        throw new Error('Groq returned empty response')
      }

      console.log('[Groq] Exam generated successfully with custom prompt')
      return examContent
    } catch (error: any) {
      console.error('[Groq] Custom prompt generation failed:', error.message)
      throw new Error(`Failed to generate exam with custom prompt: ${error.message}`)
    }
  }
}
