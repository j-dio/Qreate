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
  async generateExam(config: ExamGenerationConfig, sourceText: string): Promise<string> {
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
      const examContent = await this.callWithFallback(client =>
        this.generateFromPlan(client, plan, cappedConfig, sourceText)
      )
      return examContent
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

    // Pre-assign answer positions for MCQ concepts to prevent answer bias
    const answerCycle: Array<'A' | 'B' | 'C' | 'D'> = ['A', 'B', 'C', 'D']
    let mcqIndex = 0

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

    // If model returned concepts without answerPosition for MCQ, assign them now
    const validated = TopicPlanSchema.parse(parsed) as TopicPlan
    validated.concepts = validated.concepts.map(concept => {
      if (concept.type === 'multipleChoice' && !concept.answerPosition) {
        const position = answerCycle[mcqIndex % 4]
        mcqIndex++
        return { ...concept, answerPosition: position } as ConceptAssignment
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

    const systemPrompt =
      "You are an expert exam question writer. Generate exactly one question per concept in the provided plan. Follow the assigned question type, difficulty, and Bloom's taxonomy level exactly for each concept."

    const userPrompt = `Generate exam questions based on the topic plan below. Follow these rules STRICTLY:

RULES:
- Write EXACTLY one question per concept in the plan (${plan.totalConcepts} questions total).
- Base every question ONLY on the source material. Do NOT use "All of the above" as an option.
- Do NOT repeat any concept. Each question must test a distinct idea.
- For Multiple Choice: use the EXACT answerPosition from the plan for the correct answer.
- For True/False: state a clear, unambiguous fact from the material.
- For Fill-in-the-Blanks: use "___" for the blank. Keep blanks to key terms only.
- For Short Answer: require 2-4 sentence responses that apply or analyze content.
- CRITICAL FORMATTING RULE: Group ALL questions of the same type together under ONE section header. Write the section header ONCE at the top of that group. Do NOT repeat the section header (e.g., "Multiple Choice:") before each individual question.
- CRITICAL NUMBERING RULE: Number every question sequentially from 1 to ${plan.totalConcepts} from the top of the exam to the bottom. Completely ignore the original "id" field from the JSON plan — it is for internal planning only and must NOT appear in the output.
- The Answer Key MUST use this same sequential numbering (e.g., "1. A", "2. True"). Do NOT put the Answer Key in a markdown table — use a plain text list only.

OUTPUT FORMAT:
General Topic: [extracted topic]

Multiple Choice:
1. [Question text]
A) [Option A]
B) [Option B]
C) [Option C]
D) [Option D]

True or False:
N. [Statement text]

Fill in the Blanks:
N. [Sentence with ___ for blank]

Short Answer:
N. [Question requiring explanation]

----Answer Key----
[Number]. [Answer]
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
