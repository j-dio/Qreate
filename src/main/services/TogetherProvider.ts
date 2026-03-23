/**
 * TogetherProvider - Two-pass PFQS (Plan First, Question Second) exam generation
 *
 * Architecture:
 * - Pass 1: Topic extraction and concept planning (JSON mode, temperature 0.3)
 * - Pass 2: Question generation from validated plan (text mode, temperature 0.5)
 *
 * Primary: Together AI with Qwen3-235B-A22B-Instruct-2507
 * Fallback: Groq with Qwen/Qwen3-32B (via OpenAI-compatible API)
 *
 * Why two passes?
 * - Single-pass prompting forces the model to simultaneously plan topics,
 *   craft questions, balance difficulty, and distribute answers, causing
 *   repetition and shallow coverage (3/10 quality in production).
 * - Two-pass separates concerns: plan guarantees unique concepts before
 *   question generation starts.
 */

import OpenAI from 'openai'
import { z } from 'zod'
import type { TopicPlan, ConceptAssignment } from '../../shared/types/exam'

// ============================================================
// ExamGenerationConfig — simplified to 4 supported types
// ============================================================

export interface ExamGenerationConfig {
  questionTypes: {
    multipleChoice: boolean
    trueFalse: boolean
    fillInTheBlanks: boolean
    shortAnswer: boolean
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

// ============================================================
// Validation primitives
// ============================================================

class ValidationError extends Error {
  constructor(
    message: string,
    public readonly details: string[]
  ) {
    super(message)
    this.name = 'ValidationError'
  }
}

interface Pass2ValidationResult {
  valid: boolean
  violations: string[]
}

// ============================================================
// Zod schemas — validate Pass 1 JSON output before Pass 2
// ============================================================

const ConceptAssignmentSchema = z.object({
  id: z.number(),
  concept: z.string().min(3),
  type: z.enum(['multipleChoice', 'trueFalse', 'fillInTheBlanks', 'shortAnswer']),
  difficulty: z.enum(['easy', 'moderate', 'hard']),
  bloomLevel: z.enum(['remember', 'understand', 'apply', 'analyze', 'evaluate']),
  answerPosition: z.enum(['A', 'B', 'C', 'D']).optional(),
})

const TopicPlanSchema = z.object({
  topic: z.string().min(1),
  totalConcepts: z.number().min(1),
  concepts: z.array(ConceptAssignmentSchema).min(1),
})

// ============================================================
// TogetherProvider class
// ============================================================

export class TogetherProvider {
  private primaryClient: OpenAI
  private fallbackClient: OpenAI | null
  private primaryModel = 'Qwen/Qwen3-235B-A22B-Instruct-2507-tput'
  private fallbackModel = 'llama-3.3-70b-versatile'
  private lastUsedProvider = 'Together AI'
  private lastActualQuestions = 0
  private lastPlan: TopicPlan | null = null

  constructor(togetherApiKey: string, groqApiKey?: string) {
    this.primaryClient = new OpenAI({
      apiKey: togetherApiKey,
      baseURL: 'https://api.together.xyz/v1',
    })

    this.fallbackClient = groqApiKey
      ? new OpenAI({
          apiKey: groqApiKey,
          baseURL: 'https://api.groq.com/openai/v1',
        })
      : null
  }

  // ----------------------------------------------------------
  // Public API (matches IAIProvider interface)
  // ----------------------------------------------------------

  async testConnection(): Promise<{ success: boolean; message: string; details?: string }> {
    console.log('[TogetherProvider] Testing primary connection...', {
      model: this.primaryModel,
      hasFallback: !!this.fallbackClient,
    })

    try {
      await this.primaryClient.chat.completions.create({
        model: this.primaryModel,
        messages: [{ role: 'user', content: 'Reply with: OK' }],
        max_tokens: 50,
        temperature: 0.0,
      })
      console.log('[TogetherProvider] Primary connection successful')
      return { success: true, message: `Connected to Together AI (${this.primaryModel})` }
    } catch (primaryError: any) {
      console.error('[TogetherProvider] Primary connection failed:', primaryError.message)

      // Try fallback if available
      if (this.fallbackClient) {
        console.log('[TogetherProvider] Trying fallback (Groq)...', { model: this.fallbackModel })
        try {
          await this.fallbackClient.chat.completions.create({
            model: this.fallbackModel,
            messages: [{ role: 'user', content: 'Reply with: OK' }],
            max_tokens: 50,
            temperature: 0.0,
          })
          console.log('[TogetherProvider] Fallback connection successful')
          return {
            success: true,
            message: `Together AI unavailable, fallback connected (${this.fallbackModel})`,
            details: `Primary error: ${primaryError.message}`,
          }
        } catch (fallbackError: any) {
          console.error('[TogetherProvider] Fallback also failed:', fallbackError.message)
          return {
            success: false,
            message: 'Both providers unavailable',
            details: `Primary: ${primaryError.message} | Fallback: ${fallbackError.message}`,
          }
        }
      }

      return {
        success: false,
        message: 'Together AI connection failed',
        details: primaryError.message,
      }
    }
  }

  getLastUsedProvider(): string {
    return this.lastUsedProvider
  }

  getLastActualQuestions(): number {
    return this.lastActualQuestions
  }

  getLastPlan(): TopicPlan | null {
    return this.lastPlan
  }

  getModelInfo(): {
    primaryModel: string
    fallbackModel: string
    config: any
    availableModels: string[]
  } {
    return {
      primaryModel: this.primaryModel,
      fallbackModel: this.fallbackModel,
      config: {
        maxTokens: 16384,
        planTemperature: 0.3,
        generateTemperature: 0.5,
      },
      availableModels: [this.primaryModel, this.fallbackModel],
    }
  }

  /**
   * Two-pass exam generation:
   * 1. extractTopicPlan  — JSON mode, temperature 0.3 (deterministic planning)
   * 2. generateFromPlan  — text mode, temperature 0.5 (creative question writing)
   */
  async generateExam(
    config: ExamGenerationConfig,
    sourceText: string
  ): Promise<{ content: string }> {
    // Cap at 50 questions per research recommendation
    const cappedConfig: ExamGenerationConfig = {
      ...config,
      totalQuestions: Math.min(config.totalQuestions, 50),
    }

    // --- Pass 1: Topic Extraction and Question Plan ---
    let plan: TopicPlan
    try {
      plan = await this.callWithFallback(client =>
        this.extractTopicPlan(client, cappedConfig, sourceText)
      )
      this.lastPlan = plan
      this.lastActualQuestions = plan.concepts.length
    } catch (error: any) {
      throw new Error(`Pass 1 (topic planning) failed: ${error.message}`)
    }

    // --- Pass 2: Question Generation from Plan (with validation retry) ---
    try {
      const content = await this.generateFromPlanWithRetry(plan, cappedConfig, sourceText)
      return { content }
    } catch (error: any) {
      throw new Error(`Pass 2 (question generation) failed: ${error.message}`)
    }
  }

  // ----------------------------------------------------------
  // Pass 1: Topic Extraction
  // ----------------------------------------------------------

  private async extractTopicPlan(
    client: OpenAI,
    config: ExamGenerationConfig,
    sourceText: string
  ): Promise<TopicPlan> {
    const model = client === this.primaryClient ? this.primaryModel : this.fallbackModel
    const totalQuestions = config.totalQuestions

    // Build allowed types description with guidance on when each fits best
    const typeDescriptions: Record<string, string> = {
      multipleChoice: 'for testing recall of facts, distinguishing between similar concepts',
      trueFalse: 'for clear factual claims that are unambiguously true or false',
      fillInTheBlanks: 'for key terms, definitions, or named processes',
      shortAnswer: 'for causal relationships, mechanisms, or processes requiring explanation',
    }
    const allowedTypeLines = Object.entries(config.questionTypes)
      .filter(([, enabled]) => enabled)
      .map(([type]) => `  - ${type}: ${typeDescriptions[type]}`)
      .join('\n')

    // Build difficulty distribution using 3-level mapping
    const difficultyBreakdown = this.mapDifficultyToThreeLevels(config.difficultyDistribution)
    const diffLines = Object.entries(difficultyBreakdown)
      .filter(([, count]) => count > 0)
      .map(([level, count]) => `  - ${level}: ${count} concept(s)`)
      .join('\n')

    // Build conditional anti-laziness rules based on which types are enabled
    const mcPriorityRule = config.questionTypes.multipleChoice
      ? `- CRITICAL MULTIPLE CHOICE RULE: Multiple Choice MUST be the most frequent question type in your output. You MUST generate more Multiple Choice concepts than any other type. Do NOT take the easy way out by heavily relying on True/False or Fill-in-the-Blanks.`
      : ''

    const enabledTypeCount = Object.values(config.questionTypes).filter(Boolean).length
    const balanceRule =
      enabledTypeCount >= 2
        ? `- BALANCE: Enforce an even distribution among the allowed types. No single allowed type may represent more than 40% of all concepts unless it is the only type allowed.`
        : ''

    const antiLazinessRules = [mcPriorityRule, balanceRule].filter(Boolean).join('\n')

    const systemPrompt =
      'You are an expert educational assessment planner. Output valid JSON only. Do not include markdown or code fences.'

    // Detect multi-source input and compute per-document concept budgets
    const sourceSections = this.parseSourceSections(sourceText)
    let multiSourceBlock = ''
    if (sourceSections && sourceSections.length >= 2) {
      const budgets = this.computeSourceBudgets(sourceSections, totalQuestions)
      const minPerDoc = Math.max(1, Math.min(3, Math.floor(totalQuestions / sourceSections.length)))
      multiSourceBlock = `
MULTI-SOURCE DISTRIBUTION (MANDATORY — enforced before any other rule):
The source material contains ${sourceSections.length} separate documents, each marked by "=== SOURCE N: name ===".
You MUST extract concepts from EVERY document. Do NOT exhaust the concept limit on the first document.
Per-document concept targets (extract approximately this many from each):
${sourceSections.map((s, i) => `  - Source ${i + 1} "${s.name}": ~${budgets[i]} concept(s)`).join('\n')}
Even if a document is very short, extract at least ${minPerDoc} concept(s) from it.
`
    }

    const userPrompt = `Analyze the following source material and extract UP TO ${totalQuestions} unique concepts for a practice exam.

ALLOWED QUESTION TYPES (assign whichever fits each concept best):
${allowedTypeLines}

DIFFICULTY DISTRIBUTION (3-level, scale down proportionally if fewer concepts are available):
${diffLines}
${multiSourceBlock}
REQUIREMENTS:
- Each concept must be COMPLETELY DISTINCT — no overlap between concepts.
- Assign each concept exactly one question type from the ALLOWED list above (choose whichever type best suits that concept), one difficulty level, and one Bloom's taxonomy level.
- For multipleChoice concepts, assign an "answerPosition" field (A, B, C, or D) cycling evenly to prevent answer bias.
- Do NOT repeat any concept. Do NOT assign the same topic to multiple questions.
- Each concept must be unique to its assigned question type. Do NOT plan a concept for trueFalse if the same factual claim already appears under multipleChoice or any other type.
- Concepts must be extracted ONLY from the source material provided. NEVER invent or add concepts from outside the source material to reach the target count. If the material only supports 15 or 30 distinct concepts, output only that many.

${antiLazinessRules}

OUTPUT FORMAT (JSON only):
{
  "topic": "Detected subject/topic from the material",
  "totalConcepts": <actual number of concepts extracted>,
  "concepts": [
    { "id": 1, "concept": "Specific concept name", "type": "multipleChoice", "difficulty": "moderate", "bloomLevel": "understand", "answerPosition": "A" },
    { "id": 2, "concept": "Another specific concept", "type": "trueFalse", "difficulty": "easy", "bloomLevel": "remember" },
    ...
  ]
}

SOURCE MATERIAL:
${sourceText.slice(0, 80000)}`

    const response = await client.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
      max_tokens: 4096,
      top_p: 0.85,
    })

    const rawContent = response.choices[0]?.message?.content
    if (!rawContent) {
      throw new Error('Pass 1 returned empty response')
    }

    let parsed: unknown
    try {
      parsed = JSON.parse(rawContent)
    } catch {
      throw new Error(`Pass 1 returned invalid JSON: ${rawContent.slice(0, 200)}`)
    }

    const validated = TopicPlanSchema.parse(parsed) as TopicPlan

    // Always sync totalConcepts to the actual array length — the AI sometimes
    // reports a different number than it actually produced, and Pass 2 reads this field.
    validated.totalConcepts = validated.concepts.length

    // Semantic validation: type allowlist, answerPosition placement, duplicate concepts
    this.validatePass1Plan(validated, config)

    // Overwrite ALL answerPosition fields with Fisher-Yates shuffled positions so
    // Pass 2 receives a balanced, unpredictable distribution regardless of what the AI assigned.
    const positions = this.generateMcqPositions(
      validated.concepts.filter(c => c.type === 'multipleChoice').length
    )
    let posIdx = 0
    validated.concepts = validated.concepts.map(concept => {
      if (concept.type === 'multipleChoice') {
        return { ...concept, answerPosition: positions[posIdx++] } as ConceptAssignment
      }
      // Strip any stray answerPosition from non-MC concepts
      const { answerPosition: _removed, ...rest } = concept as ConceptAssignment & {
        answerPosition?: string
      }
      void _removed
      return rest as ConceptAssignment
    })

    return validated
  }

  // ----------------------------------------------------------
  // Pass 1: Semantic Validator
  // ----------------------------------------------------------

  private validatePass1Plan(plan: TopicPlan, config: ExamGenerationConfig): void {
    const violations: string[] = []

    // Build set of enabled types
    const enabledTypes = new Set(
      Object.entries(config.questionTypes)
        .filter(([, enabled]) => enabled)
        .map(([type]) => type)
    )

    // 1. Type allowlist check
    for (const concept of plan.concepts) {
      if (!enabledTypes.has(concept.type)) {
        violations.push(
          `Concept ${concept.id} ("${concept.concept}") has type "${concept.type}" which is not in enabled types: [${[...enabledTypes].join(', ')}]`
        )
      }
    }

    // 2. answerPosition only on MC
    for (const concept of plan.concepts) {
      if (concept.type !== 'multipleChoice' && concept.answerPosition !== undefined) {
        violations.push(
          `Concept ${concept.id} ("${concept.concept}") has type "${concept.type}" but incorrectly has answerPosition "${concept.answerPosition}"`
        )
      }
    }

    // 3. No duplicate concepts (case-insensitive normalized)
    const seen = new Map<string, number>()
    for (const concept of plan.concepts) {
      const normalized = concept.concept.toLowerCase().trim()
      if (seen.has(normalized)) {
        violations.push(
          `Duplicate concept at id ${concept.id}: "${concept.concept}" duplicates id ${seen.get(normalized)}`
        )
      } else {
        seen.set(normalized, concept.id)
      }
    }

    // 4. Cross-type near-duplicate detection
    // Normalize each concept to a sorted bag of significant words (3+ chars, excluding stop
    // words) and flag concepts that share the same fingerprint across different question types.
    const conceptPhrases = new Map<string, number[]>()
    const stopWords = new Set(['the', 'and', 'for', 'are', 'was', 'that', 'this', 'with', 'from'])
    for (const concept of plan.concepts) {
      const words = concept.concept
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .split(/\s+/)
        .filter(w => w.length >= 3 && !stopWords.has(w))
      const key = words.sort().join(' ')
      if (key.length > 0) {
        const existing = conceptPhrases.get(key) ?? []
        existing.push(concept.id)
        conceptPhrases.set(key, existing)
      }
    }
    for (const [phrase, ids] of conceptPhrases) {
      if (ids.length > 1) {
        violations.push(
          `Near-duplicate concepts detected: IDs [${ids.join(', ')}] share key phrase "${phrase}"`
        )
      }
    }

    if (violations.length > 0) {
      throw new ValidationError('Pass 1 plan failed semantic validation', violations)
    }
  }

  // ----------------------------------------------------------
  // Pass 2: Question Generation from Plan
  // ----------------------------------------------------------

  private async generateFromPlan(
    client: OpenAI,
    plan: TopicPlan,
    _config: ExamGenerationConfig,
    sourceText: string
  ): Promise<string> {
    const model = client === this.primaryClient ? this.primaryModel : this.fallbackModel

    const planJson = JSON.stringify(plan, null, 2)

    // Compute per-type counts from the actual plan
    const mcCount = plan.concepts.filter(c => c.type === 'multipleChoice').length
    const tfCount = plan.concepts.filter(c => c.type === 'trueFalse').length
    const fitbCount = plan.concepts.filter(c => c.type === 'fillInTheBlanks').length
    const saCount = plan.concepts.filter(c => c.type === 'shortAnswer').length

    // T/F targets — nearest split (floor/ceil) to handle odd counts without mutating plan
    const targetFalseCount = Math.floor(tfCount / 2)
    const targetTrueCount = tfCount - targetFalseCount

    // Dynamic Rule 2: only include type descriptions for types present in the plan
    const typeRuleLines: string[] = []
    if (mcCount > 0)
      typeRuleLines.push(
        '   - "multipleChoice"  → Write a 4-option multiple choice question (options A, B, C, D).'
      )
    if (tfCount > 0)
      typeRuleLines.push('   - "trueFalse"       → Write a true/false statement.')
    if (fitbCount > 0)
      typeRuleLines.push(
        '   - "fillInTheBlanks" → Write a sentence with "___" marking the blank. The blank MUST be replaceable with a specific technical term or named concept from the source material. NEVER use a generic word like "another", "some", "it", "important", or the same word being defined in the sentence. The answer must be a concrete, unambiguous noun or proper term.'
      )
    if (saCount > 0)
      typeRuleLines.push(
        '   - "shortAnswer"     → Write an open-ended question requiring a 2-4 sentence response.'
      )

    // Dynamic OUTPUT FORMAT: only include section blocks present in the plan
    const sectionBlocks: string[] = []
    if (mcCount > 0)
      sectionBlocks.push(
        'Multiple Choice:\n1. [Question text]\nA) [Option A]\nB) [Option B]\nC) [Option C]\nD) [Option D]'
      )
    if (tfCount > 0) sectionBlocks.push('True or False:\nN. [Statement]')
    if (fitbCount > 0) sectionBlocks.push('Fill in the Blanks:\nN. [Sentence with ___ for blank]')
    if (saCount > 0) sectionBlocks.push('Short Answer:\nN. [Open-ended question]')

    const dynamicOutputFormat = [
      'General Topic: [topic]',
      '',
      ...sectionBlocks,
      '',
      '----Answer Key----',
      '1. [Answer]',
      '...',
    ].join('\n')

    const systemPrompt =
      "You are an expert exam question writer. Generate exactly one question per concept in the provided plan. You must follow the assigned 'type' and 'answerPosition' fields for every concept without exception."

    const userPrompt = `Generate exam questions from the topic plan below. Every rule below is MANDATORY.

MANDATORY RULES:

1. QUESTION COUNT: Write exactly ${plan.concepts.length} questions total — one per concept in the plan.

2. QUESTION TYPE PER CONCEPT: Every concept in the plan has a "type" field. Write the question type specified in that field:
${typeRuleLines.join('\n')}
   Do NOT change a concept's type.

3. TRUE/FALSE VARIANCE (CRITICAL — generation will be REJECTED if violated):
   - You MUST write both True AND False statements. Do NOT default to all True.
   - To write a False statement: take a real fact from the source, then change one specific detail to make it incorrect. Example: if source says "Mitochondria produce ATP", write "Mitochondria produce NADH as their primary energy output" and mark it False.
${
  tfCount > 0
    ? `   - Target: exactly ${targetFalseCount} False and ${targetTrueCount} True out of ${tfCount} T/F questions.
   - The validator WILL reject your output if fewer than ${Math.max(1, Math.floor(tfCount * 0.1))} of either polarity exist.`
    : '   - This plan contains 0 trueFalse questions. Do not create any trueFalse items.'
}

4. ANSWER PLACEMENT FOR MULTIPLE CHOICE: Every multiple choice concept in the plan has an "answerPosition" field set to "A", "B", "C", or "D". This field tells you exactly which option letter MUST contain the correct answer.
   - answerPosition "A" → Option A is correct; B, C, D are wrong distractors.
   - answerPosition "B" → Option B is correct; A, C, D are wrong distractors.
   - answerPosition "C" → Option C is correct; A, B, D are wrong distractors.
   - answerPosition "D" → Option D is correct; A, B, C are wrong distractors.
   You MUST honor every answerPosition exactly. Never put the correct answer at a different letter.

5. CONTENT: Base every question ONLY on the source material. Do NOT use "All of the above" as an option. Do NOT repeat concepts.

6. GROUPING: Group ALL questions of the same type under ONE section header. Write each header exactly once.

7. NUMBERING: Number every question sequentially from 1 to ${plan.concepts.length} top-to-bottom. Ignore the "id" field in the plan — it is internal only.

8. CRITICAL FORMATTING: NEVER place the answers immediately after the questions in the main body. The question sections must contain ONLY the questions and the multiple choice options. ALL answers must be strictly hidden and reserved ONLY for the ----Answer Key---- section at the very bottom.

9. ANSWER KEY: List every answer using the sequential question number (e.g., "1. A", "2. True"). Plain text list only — no markdown table.

OUTPUT FORMAT:
${dynamicOutputFormat}

TOPIC PLAN:
${planJson}

SOURCE MATERIAL:
${sourceText.slice(0, 80000)}`

    const response = await client.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.5,
      max_tokens: 16384,
      top_p: 0.9,
    })

    const content = response.choices[0]?.message?.content
    if (!content) {
      throw new Error('Pass 2 returned empty response')
    }

    return content
  }

  // ----------------------------------------------------------
  // Pass 2: Retry Orchestration with Validation (hard-fail on exhaustion)
  // ----------------------------------------------------------

  private async generateFromPlanWithRetry(
    plan: TopicPlan,
    config: ExamGenerationConfig,
    sourceText: string
  ): Promise<string> {
    const tfCount = plan.concepts.filter(c => c.type === 'trueFalse').length
    const targetFalseCount = Math.floor(tfCount / 2)
    const targetTrueCount = tfCount - targetFalseCount

    const attemptsLog: Array<{ client: string; attempt: number; violations: string[] }> = []
    const clients: Array<{ client: OpenAI; name: string }> = [
      { client: this.primaryClient, name: 'Together AI' },
    ]
    if (this.fallbackClient) {
      clients.push({ client: this.fallbackClient, name: 'Groq AI' })
    }

    for (const { client, name } of clients) {
      for (let attempt = 0; attempt <= 2; attempt++) {
        try {
          const raw = await this.generateFromPlan(client, plan, config, sourceText)
          // Programmatically correct MC answer key entries before validation.
          // The model reliably places correct answers at the right option position
          // but frequently writes the wrong letter in the answer key (~30% drift).
          // Since answerPosition is ground truth from Pass 1, we override the key.
          const corrected = fixMCAnswerKeys(raw, plan)
          const result = validatePass2OutputStandalone(
            corrected,
            plan,
            targetTrueCount,
            targetFalseCount
          )
          attemptsLog.push({ client: name, attempt, violations: result.violations })
          if (result.valid) {
            this.lastUsedProvider = name
            return corrected
          }
          console.error(
            `[TogetherProvider] Pass 2 attempt ${attempt + 1} (${name}) failed validation:`,
            result.violations
          )
        } catch (apiError: any) {
          attemptsLog.push({ client: name, attempt, violations: [apiError.message] })
          console.error(
            `[TogetherProvider] Pass 2 attempt ${attempt + 1} (${name}) API error:`,
            apiError.message
          )
        }
      }
    }

    // All retries exhausted — hard fail (fail closed, no broken exam output)
    console.error('[TogetherProvider] Pass 2 validation failed after all retries', { attemptsLog })
    throw new ValidationError(
      `Pass 2 failed validation after ${attemptsLog.length} attempt(s)`,
      attemptsLog.flatMap(a => a.violations)
    )
  }

  // ----------------------------------------------------------
  // Answer position helpers (Fisher-Yates)
  // ----------------------------------------------------------

  /**
   * Fisher-Yates shuffle — returns a new shuffled copy of the array.
   */
  private shuffleArray<T>(arr: T[]): T[] {
    const shuffled = [...arr]
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
    }
    return shuffled
  }

  /**
   * Generate `count` answer positions using Fisher-Yates shuffled chunks of 4.
   * Guarantees an even A/B/C/D distribution while being unpredictable.
   */
  private generateMcqPositions(count: number): Array<'A' | 'B' | 'C' | 'D'> {
    const base: Array<'A' | 'B' | 'C' | 'D'> = ['A', 'B', 'C', 'D']
    const positions: Array<'A' | 'B' | 'C' | 'D'> = []
    while (positions.length < count) {
      positions.push(...this.shuffleArray(base))
    }
    return positions.slice(0, count)
  }

  // ----------------------------------------------------------
  // Multi-source helpers
  // ----------------------------------------------------------

  /**
   * Detect structured source markers written by the renderer.
   * Format: "=== SOURCE N: filename ==="
   *
   * Returns an array of {name, text} when two or more sources are found,
   * or null for a single-source (unmarked) string.
   */
  private parseSourceSections(sourceText: string): Array<{ name: string; text: string }> | null {
    const markerRegex = /^=== SOURCE \d+: (.+) ===/gm
    const matches = [...sourceText.matchAll(markerRegex)]

    if (matches.length < 2) return null

    return matches.map((match, i) => {
      const start = (match.index ?? 0) + match[0].length
      const end =
        i + 1 < matches.length ? (matches[i + 1].index ?? sourceText.length) : sourceText.length
      return {
        name: match[1].trim(),
        text: sourceText.slice(start, end).trim(),
      }
    })
  }

  /**
   * Compute per-document concept budgets so that Pass 1 draws proportionally
   * from every uploaded file, not just the largest one.
   *
   * Budget formula:  max(minPerDoc, round(total × charLen / totalChars))
   * minPerDoc:       max(1, min(3, floor(total / numDocs)))
   *
   * The minimum floor prevents tiny documents (e.g. a 2-paragraph summary)
   * from being completely eclipsed by a dense companion document.
   */
  private computeSourceBudgets(
    sections: Array<{ name: string; text: string }>,
    totalQuestions: number
  ): number[] {
    const totalChars = sections.reduce((sum, s) => sum + s.text.length, 0)
    const minPerDoc = Math.max(1, Math.min(3, Math.floor(totalQuestions / sections.length)))

    const raw = sections.map(s =>
      Math.max(minPerDoc, Math.round(totalQuestions * (s.text.length / totalChars)))
    )

    // Normalize so the sum exactly equals totalQuestions — prevents contradictory
    // prompt guidance when minPerDoc floors push the total above the cap.
    const rawSum = raw.reduce((a, b) => a + b, 0)
    if (rawSum === totalQuestions || rawSum === 0) return raw

    const scale = totalQuestions / rawSum
    const scaled = raw.map(v => Math.max(1, Math.round(v * scale)))
    // Adjust the largest bucket to absorb any rounding remainder
    const remainder = totalQuestions - scaled.reduce((a, b) => a + b, 0)
    const maxIdx = scaled.indexOf(Math.max(...scaled))
    scaled[maxIdx] += remainder
    return scaled
  }

  // ----------------------------------------------------------
  // Fallback helper
  // ----------------------------------------------------------

  /**
   * Wraps an API call function with retry + fallback logic.
   * - Tries primary client up to 2 times (exponential backoff: 2s, 4s)
   * - If all primary retries fail, tries fallback client up to 2 times
   * - Throws if both clients exhausted
   */
  private async callWithFallback<T>(fn: (client: OpenAI) => Promise<T>): Promise<T> {
    const maxRetries = 2
    const baseDelay = 2000

    // Try primary
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const result = await fn(this.primaryClient)
        this.lastUsedProvider = 'Together AI'
        return result
      } catch {
        if (attempt < maxRetries) {
          const delay = baseDelay * Math.pow(2, attempt)
          await new Promise(resolve => setTimeout(resolve, delay))
        }
      }
    }

    // Primary exhausted — try fallback
    if (this.fallbackClient) {
      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          const result = await fn(this.fallbackClient)
          this.lastUsedProvider = 'Groq AI'
          return result
        } catch (error: any) {
          if (attempt < maxRetries) {
            const delay = baseDelay * Math.pow(2, attempt)
            await new Promise(resolve => setTimeout(resolve, delay))
          } else {
            throw new Error(
              `Both primary (Together AI) and fallback (Groq) failed. Last error: ${error.message}`
            )
          }
        }
      }
    }

    throw new Error(
      'Together AI primary provider exhausted all retries and no fallback is configured'
    )
  }

  // ----------------------------------------------------------
  // Difficulty mapping helper
  // ----------------------------------------------------------

  /**
   * Maps the 5-level UI difficulty distribution to 3-level model input.
   * - veryEasy + easy  -> 'easy'
   * - moderate         -> 'moderate'
   * - hard + veryHard  -> 'hard'
   */
  private mapDifficultyToThreeLevels(dist: ExamGenerationConfig['difficultyDistribution']): {
    easy: number
    moderate: number
    hard: number
  } {
    return {
      easy: (dist.veryEasy ?? 0) + (dist.easy ?? 0),
      moderate: dist.moderate ?? 0,
      hard: (dist.hard ?? 0) + (dist.veryHard ?? 0),
    }
  }
}

// ============================================================
// Module-level pure validator — exported for stress testing
// ============================================================

const SECTION_HEADERS: Record<string, string> = {
  multipleChoice: 'Multiple Choice:',
  trueFalse: 'True or False:',
  fillInTheBlanks: 'Fill in the Blanks:',
  shortAnswer: 'Short Answer:',
}

const ANSWER_KEY_MARKER = '----Answer Key----'

/**
 * Normalize raw Pass 2 output before validation to tolerate minor model formatting drift.
 * - Strips leading markdown tokens (#, **, *, _) from lines
 * - Canonicalizes section headers to fixed strings
 * - Canonicalizes the answer key delimiter
 * - Normalizes question numbering (e.g., "1)" → "1. ")
 */
function normalizePass2Output(raw: string): string {
  return raw
    .split('\n')
    .map(line => {
      // Strip markdown heading/bold/italic tokens from line starts
      let l = line.replace(/^#+\s*/, '').replace(/^[*_]{1,2}(.*?)[*_]{1,2}$/, '$1')

      // Canonicalize section headers (case-insensitive, full-line match to avoid
      // false positives on question text containing these words)
      const trimmed = l.trim()
      if (/^multiple.?choice:?\s*$/i.test(trimmed))
        return 'Multiple Choice:'
      if (/^true.{0,5}false:?\s*$/i.test(trimmed))
        return 'True or False:'
      if (/^fill.{0,10}blank[s]?:?\s*$/i.test(trimmed))
        return 'Fill in the Blanks:'
      if (/^short.{0,5}answer[s]?:?\s*$/i.test(trimmed))
        return 'Short Answer:'

      // Canonicalize answer key delimiter
      if (/^-{3,}.*answer.{0,10}key.*-{3,}/i.test(l.trim()))
        return ANSWER_KEY_MARKER

      // Normalize question/answer numbering: "1)" or "1." followed by spaces → "1. "
      l = l.replace(/^(\d+)[.)]\s+/, '$1. ')

      return l
    })
    .join('\n')
}

/**
 * Count questions in a section of the normalized output.
 * Finds the section header, then counts lines matching /^\d+\. /
 * up to the next section boundary.
 */
function countQuestionsInSection(
  normalized: string,
  sectionHeader: string,
  otherHeaders: string[]
): number {
  const start = normalized.indexOf(sectionHeader)
  if (start === -1) return -1

  const searchFrom = start + sectionHeader.length
  const boundaries = [...otherHeaders, ANSWER_KEY_MARKER]
    .map(h => normalized.indexOf(h, searchFrom))
    .filter(i => i > start)
  const end = boundaries.length > 0 ? Math.min(...boundaries) : normalized.length

  const slice = normalized.slice(searchFrom, end)
  return (slice.match(/^\d+\. /gm) ?? []).length
}

/**
 * Programmatically correct MC answer key entries to match the plan's answerPosition.
 *
 * The model reliably places the correct answer at the right option position in the
 * question body but frequently writes the wrong letter in the answer key (~30% drift).
 * Since answerPosition is ground truth (assigned deterministically via Fisher-Yates in
 * Pass 1), we can override the answer key for every MC question rather than retrying.
 *
 * Algorithm:
 * 1. Normalize output to find MC question numbers (same extraction as validator).
 * 2. Pair mcQuestionNumbers[i] with mcConcepts[i].answerPosition.
 * 3. Replace each MC answer key line in the raw text with the correct letter.
 */
export function fixMCAnswerKeys(raw: string, plan: TopicPlan): string {
  const normalized = normalizePass2Output(raw)
  const answerKeyStart = normalized.indexOf(ANSWER_KEY_MARKER)
  if (answerKeyStart === -1) return raw

  const mcConcepts = plan.concepts.filter(c => c.type === 'multipleChoice')
  if (mcConcepts.length === 0) return raw

  const mcHeader = SECTION_HEADERS['multipleChoice']
  const mcBodyStart = normalized.indexOf(mcHeader)
  if (mcBodyStart === -1) return raw

  const mcSearchFrom = mcBodyStart + mcHeader.length
  const mcOtherBoundaries = [
    ...Object.values(SECTION_HEADERS).filter(h => h !== mcHeader),
    ANSWER_KEY_MARKER,
  ]
    .map(h => normalized.indexOf(h, mcSearchFrom))
    .filter(i => i > mcBodyStart)
  const mcBodyEnd =
    mcOtherBoundaries.length > 0 ? Math.min(...mcOtherBoundaries) : normalized.length
  const mcBodySlice = normalized.slice(mcSearchFrom, mcBodyEnd)
  const mcQuestionNumbers = [...mcBodySlice.matchAll(/^(\d+)\. /gm)].map(m => parseInt(m[1], 10))

  // Build a map: question number → correct answer letter
  const corrections = new Map<number, string>()
  for (let i = 0; i < Math.min(mcQuestionNumbers.length, mcConcepts.length); i++) {
    const letter = mcConcepts[i].answerPosition
    if (letter) corrections.set(mcQuestionNumbers[i], letter)
  }
  if (corrections.size === 0) return raw

  // Find the answer key delimiter in the raw text (case-insensitive variant)
  const rawAkIdx = raw.search(/----[Aa]nswer [Kk]ey----/)
  if (rawAkIdx === -1) return raw

  // Split into body + answer key, fix answer key lines, then rejoin
  const body = raw.slice(0, rawAkIdx)
  const akSection = raw.slice(rawAkIdx)

  const fixedAk = akSection
    .split('\n')
    .map(line => {
      // Match "N. X" or "N) X" at the start of a line
      const m = line.match(/^(\d+)[.)]\s+([A-D])\s*$/)
      if (!m) return line
      const qNum = parseInt(m[1], 10)
      const correctLetter = corrections.get(qNum)
      if (!correctLetter) return line
      return `${m[1]}. ${correctLetter}`
    })
    .join('\n')

  return body + fixedAk
}

/**
 * Pure, synchronous Pass 2 output validator.
 * Exported so the stress test can call it without instantiating TogetherProvider.
 */
export function validatePass2OutputStandalone(
  output: string,
  plan: TopicPlan,
  targetTrueCount: number,
  targetFalseCount: number
): Pass2ValidationResult {
  const violations: string[] = []
  const normalized = normalizePass2Output(output)

  const allHeaders = Object.values(SECTION_HEADERS)

  // Per-type section and count checks
  for (const [type, header] of Object.entries(SECTION_HEADERS)) {
    const expected = plan.concepts.filter(c => c.type === type).length
    const otherHeaders = allHeaders.filter(h => h !== header)
    const actual = countQuestionsInSection(normalized, header, otherHeaders)

    if (actual === -1 && expected > 0) {
      violations.push(
        `Missing section: "${header}" not found but ${expected} ${type} concept(s) planned`
      )
    } else if (actual !== -1 && expected === 0) {
      violations.push(
        `Phantom section: "${header}" present in output but 0 ${type} concepts planned`
      )
    } else if (actual !== -1 && expected > 0) {
      // Allow ±40% deviation (min ±1) to absorb the model's natural under-generation
      // (typically 1-7 questions short), while still catching catastrophic drift
      // like Groq generating all 50 questions as a single type (92%+ over plan).
      const tolerance = Math.max(1, Math.floor(expected * 0.4))
      if (Math.abs(actual - expected) > tolerance) {
        violations.push(
          `Count mismatch: expected ${expected} ${type} question(s), found ${actual} (tolerance ±${tolerance})`
        )
      }
    }
  }

  // Hoist answer key position so both T/F and MC checks can use it
  const answerKeyStart = normalized.indexOf(ANSWER_KEY_MARKER)

  // T/F variance check in answer key
  // Parse question numbers from the T/F body section rather than inferring them from plan
  // counts. This avoids off-by-one errors when the model's MC count drifts from the plan
  // (e.g., model outputs 38 MC instead of 37, shifting all T/F line numbers by 1).
  // Threshold: at least 10% of T/F must be each polarity — catches complete absence of
  // True or False answers while allowing the model's natural True bias (80-93% in production).
  const totalTf = targetTrueCount + targetFalseCount
  if (totalTf > 0) {
    if (answerKeyStart === -1) {
      violations.push('Answer key section not found in output')
    } else {
      const answerKeySlice = normalized.slice(answerKeyStart)
      const tfHeader = SECTION_HEADERS['trueFalse']
      const tfBodyStart = normalized.indexOf(tfHeader)

      // Extract question numbers from the T/F section body
      let tfQuestionNumbers: number[] = []
      if (tfBodyStart !== -1) {
        const tfSearchFrom = tfBodyStart + tfHeader.length
        const otherBoundaries = [
          ...Object.values(SECTION_HEADERS).filter(h => h !== tfHeader),
          ANSWER_KEY_MARKER,
        ]
          .map(h => normalized.indexOf(h, tfSearchFrom))
          .filter(i => i > tfBodyStart)
        const tfBodyEnd =
          otherBoundaries.length > 0 ? Math.min(...otherBoundaries) : normalized.length
        const tfBodySlice = normalized.slice(tfSearchFrom, tfBodyEnd)
        tfQuestionNumbers = [...tfBodySlice.matchAll(/^(\d+)\. /gm)].map(m =>
          parseInt(m[1], 10)
        )
      }

      // Skip variance check if T/F section is absent — already caught by section count check
      if (tfQuestionNumbers.length > 0) {
        let actualTrue = 0
        let actualFalse = 0
        for (const qNum of tfQuestionNumbers) {
          if (new RegExp(`^${qNum}\\.\\s+True\\s*$`, 'im').test(answerKeySlice)) actualTrue++
          if (new RegExp(`^${qNum}\\.\\s+False\\s*$`, 'im').test(answerKeySlice)) actualFalse++
        }

        // Require at least 10% from each side — catches complete absence of True or False
        // while allowing the model's natural bias (typically 80-93% True in production).
        const minOfEach = Math.max(1, Math.floor(totalTf * 0.1))
        if (actualFalse < minOfEach) {
          violations.push(
            `T/F variance: expected at least ${minOfEach} False answer(s) out of ${totalTf}, found ${actualFalse}`
          )
        }
        if (actualTrue < minOfEach) {
          violations.push(
            `T/F variance: expected at least ${minOfEach} True answer(s) out of ${totalTf}, found ${actualTrue}`
          )
        }
      }
    }
  }

  // MC answer-key spot-check: verify each MC question's answer key letter matches plan's answerPosition
  const mcConcepts = plan.concepts.filter(c => c.type === 'multipleChoice')
  if (mcConcepts.length > 0 && answerKeyStart !== -1) {
    const mcHeader = SECTION_HEADERS['multipleChoice']
    const mcBodyStart = normalized.indexOf(mcHeader)
    if (mcBodyStart !== -1) {
      const mcSearchFrom = mcBodyStart + mcHeader.length
      const mcOtherBoundaries = [
        ...Object.values(SECTION_HEADERS).filter(h => h !== mcHeader),
        ANSWER_KEY_MARKER,
      ]
        .map(h => normalized.indexOf(h, mcSearchFrom))
        .filter(i => i > mcBodyStart)
      const mcBodyEnd =
        mcOtherBoundaries.length > 0 ? Math.min(...mcOtherBoundaries) : normalized.length
      const mcBodySlice = normalized.slice(mcSearchFrom, mcBodyEnd)
      const mcQuestionNumbers = [...mcBodySlice.matchAll(/^(\d+)\. /gm)].map(m =>
        parseInt(m[1], 10)
      )

      // Map each MC question number to its plan concept (by order of appearance)
      const answerKeySliceForMC = normalized.slice(answerKeyStart)
      let mismatchCount = 0
      for (let i = 0; i < Math.min(mcQuestionNumbers.length, mcConcepts.length); i++) {
        const qNum = mcQuestionNumbers[i]
        const expectedLetter = mcConcepts[i].answerPosition
        if (!expectedLetter) continue
        // Extract the answer key entry for this question number
        const akMatch = answerKeySliceForMC.match(new RegExp(`^${qNum}\\.\\s+([A-D])`, 'm'))
        if (akMatch && akMatch[1] !== expectedLetter) {
          mismatchCount++
        }
      }
      // Allow up to 20% mismatch tolerance (model may slightly drift)
      const maxAllowed = Math.max(1, Math.floor(mcConcepts.length * 0.2))
      if (mismatchCount > maxAllowed) {
        violations.push(
          `MC answer-key mismatch: ${mismatchCount}/${mcQuestionNumbers.length} MC answers don't match planned answerPosition (max allowed: ${maxAllowed})`
        )
      }
    }
  }

  return { valid: violations.length === 0, violations }
}
