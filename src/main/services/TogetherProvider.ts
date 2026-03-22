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
    multipleChoice?: number
    trueFalse?: number
    fillInTheBlanks?: number
    shortAnswer?: number
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
  private lastWarning: string | undefined

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

  getLastWarning(): string | undefined {
    return this.lastWarning
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
  ): Promise<{ content: string; warning?: string }> {
    this.lastWarning = undefined

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
      this.lastActualQuestions = plan.concepts.length
    } catch (error: any) {
      throw new Error(`Pass 1 (topic planning) failed: ${error.message}`)
    }

    // --- Pass 2: Question Generation from Plan ---
    try {
      const content = await this.callWithFallback(client =>
        this.generateFromPlan(client, plan, cappedConfig, sourceText)
      )
      return { content, warning: this.lastWarning }
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

    // Build type distribution description
    const typeLines = Object.entries(config.questionTypes)
      .filter(([, count]) => count && count > 0)
      .map(([type, count]) => `  - ${type}: ${count} question(s)`)
      .join('\n')

    // Build difficulty distribution using 3-level mapping
    const difficultyBreakdown = this.mapDifficultyToThreeLevels(config.difficultyDistribution)
    const diffLines = Object.entries(difficultyBreakdown)
      .filter(([, count]) => count > 0)
      .map(([level, count]) => `  - ${level}: ${count} concept(s)`)
      .join('\n')

    const systemPrompt =
      'You are an expert educational assessment planner. Output valid JSON only. Do not include markdown or code fences.'

    const userPrompt = `Analyze the following source material and extract UP TO ${totalQuestions} unique concepts for a practice exam.

QUESTION TYPE DISTRIBUTION (target, scale down proportionally if fewer concepts are available):
${typeLines}

DIFFICULTY DISTRIBUTION (3-level, scale down proportionally if fewer concepts are available):
${diffLines}

REQUIREMENTS:
- Each concept must be COMPLETELY DISTINCT — no overlap between concepts.
- Assign each concept exactly one question type, one difficulty level, and one Bloom's taxonomy level.
- For multipleChoice concepts, assign an "answerPosition" field (A, B, C, or D) cycling evenly to prevent answer bias.
- Do NOT repeat any concept. Do NOT assign the same topic to multiple questions.
- Concepts must be extracted ONLY from the source material provided. NEVER invent or add concepts from outside the source material to reach the target count. If the material only supports 15 or 30 distinct concepts, output only that many.

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

    // If Pass 1 returned fewer concepts than requested, proportionally redistribute types
    if (validated.concepts.length < totalQuestions) {
      this.lastWarning = `Note: The uploaded file did not contain enough distinct information for the requested number of items. The exam has been scaled down to ${validated.concepts.length} questions while maintaining your requested format ratios.`
      this.redistributeConceptTypes(validated.concepts, config)
      const typeCounts = validated.concepts.reduce(
        (acc, c) => ({ ...acc, [c.type]: (acc[c.type] ?? 0) + 1 }),
        {} as Record<string, number>
      )
      console.log('[TogetherProvider] Pass 1 redistributed types:', typeCounts)
    }

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
      return concept
    })

    return validated
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

    // Compute explicit type counts from the plan so Pass 2 has an unambiguous target
    const typeCounts = plan.concepts.reduce(
      (acc, c) => ({ ...acc, [c.type]: (acc[c.type] ?? 0) + 1 }),
      {} as Record<string, number>
    )
    const typeCountLines = [
      ['multipleChoice', 'Multiple Choice'],
      ['trueFalse', 'True or False'],
      ['fillInTheBlanks', 'Fill in the Blanks'],
      ['shortAnswer', 'Short Answer'],
    ]
      .filter(([key]) => (typeCounts[key] ?? 0) > 0)
      .map(([key, label]) => `  - ${label}: ${typeCounts[key]} question(s)`)
      .join('\n')

    const systemPrompt =
      "You are an expert exam question writer. Generate exactly one question per concept in the provided plan. You must follow the assigned 'type' and 'answerPosition' fields for every concept without exception."

    const userPrompt = `Generate exam questions from the topic plan below. Every rule below is MANDATORY.

REQUIRED QUESTION COUNTS (derived from the plan — match these exactly):
${typeCountLines}

MANDATORY RULES:

1. QUESTION COUNT: Write exactly ${plan.concepts.length} questions total — one per concept in the plan.

2. QUESTION TYPE PER CONCEPT: Every concept in the plan has a "type" field. You MUST write that exact question type for that concept:
   - "multipleChoice"  → Write a 4-option multiple choice question (options A, B, C, D).
   - "trueFalse"       → Write a true/false statement.
   - "fillInTheBlanks" → Write a sentence with "___" marking the blank.
   - "shortAnswer"     → Write an open-ended question requiring a 2-4 sentence response.
   Do NOT change a concept's type. Do NOT write more or fewer of any type than the counts above.

3. ANSWER PLACEMENT FOR MULTIPLE CHOICE: Every multiple choice concept in the plan has an "answerPosition" field set to "A", "B", "C", or "D". This field tells you exactly which option letter MUST contain the correct answer.
   - answerPosition "A" → Option A is correct; B, C, D are wrong distractors.
   - answerPosition "B" → Option B is correct; A, C, D are wrong distractors.
   - answerPosition "C" → Option C is correct; A, B, D are wrong distractors.
   - answerPosition "D" → Option D is correct; A, B, C are wrong distractors.
   You MUST honor every answerPosition exactly. Never put the correct answer at a different letter.

4. CONTENT: Base every question ONLY on the source material. Do NOT use "All of the above" as an option. Do NOT repeat concepts.

5. GROUPING: Group ALL questions of the same type under ONE section header. Write each header exactly once.

6. NUMBERING: Number every question sequentially from 1 to ${plan.concepts.length} top-to-bottom. Ignore the "id" field in the plan — it is internal only.

7. ANSWER KEY: List every answer using the sequential question number (e.g., "1. A", "2. True"). Plain text list only — no markdown table.

OUTPUT FORMAT:
General Topic: [topic]

Multiple Choice:
1. [Question text]
A) [Option A]
B) [Option B]
C) [Option C]
D) [Option D]

True or False:
N. [Statement]

Fill in the Blanks:
N. [Sentence with ___ for blank]

Short Answer:
N. [Open-ended question]

----Answer Key----
1. [Answer]
...

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

  /**
   * Proportionally redistribute concept types when Pass 1 returns fewer
   * concepts than requested.  Ensures the user's requested ratios are
   * preserved even when the source material limits coverage.
   */
  private redistributeConceptTypes(
    concepts: ConceptAssignment[],
    config: ExamGenerationConfig
  ): void {
    const actualCount = concepts.length
    const totalRequested = Object.values(config.questionTypes).reduce(
      (sum, v) => sum + (v ?? 0),
      0
    )
    if (totalRequested === 0) return

    const types = [
      'multipleChoice',
      'trueFalse',
      'fillInTheBlanks',
      'shortAnswer',
    ] as const

    // Only redistribute types that were originally requested
    const activeTypes = types.filter(t => (config.questionTypes[t] ?? 0) > 0)

    // Calculate proportional targets; last type absorbs rounding remainder
    const targets: Partial<Record<(typeof types)[number], number>> = {}
    let assigned = 0
    for (let i = 0; i < activeTypes.length; i++) {
      const type = activeTypes[i]
      const requested = config.questionTypes[type] ?? 0
      if (i < activeTypes.length - 1) {
        const target = Math.round(actualCount * (requested / totalRequested))
        targets[type] = target
        assigned += target
      } else {
        targets[type] = actualCount - assigned
      }
    }

    // Overwrite type field sequentially
    let idx = 0
    for (const type of activeTypes) {
      const count = targets[type] ?? 0
      for (let i = 0; i < count; i++) {
        if (idx < concepts.length) {
          concepts[idx].type = type
          idx++
        }
      }
    }
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
