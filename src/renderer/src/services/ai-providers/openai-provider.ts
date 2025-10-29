/**
 * OpenAI AI Provider
 *
 * Implementation of the IAIProvider interface for OpenAI's GPT models.
 *
 * Why OpenAI?
 * - Industry-leading quality
 * - Reliable and well-documented
 * - Strong reasoning capabilities
 * - Best for professional use
 *
 * Model: GPT-4o-mini (fast) or GPT-4o (best quality)
 * Cost: ~$0.03-0.10 per exam
 */

import OpenAI from 'openai'
import type {
  IAIProvider,
  ExamGenerationConfig,
  TestConnectionResult,
} from '../../types/ai-providers'

export class OpenAIProvider implements IAIProvider {
  readonly type = 'openai' as const

  /**
   * Test connection to OpenAI API
   */
  async testConnection(apiKey: string): Promise<TestConnectionResult> {
    try {
      // Validate API key format
      if (!apiKey || apiKey.trim().length === 0) {
        return {
          success: false,
          message: 'API key is required',
        }
      }

      // OpenAI API keys start with "sk-"
      if (!apiKey.startsWith('sk-')) {
        return {
          success: false,
          message: 'Invalid API key format. OpenAI keys start with "sk-"',
        }
      }

      // Initialize OpenAI client
      const openai = new OpenAI({
        apiKey,
        dangerouslyAllowBrowser: true, // For Electron app
      })

      // Make a minimal test call
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini', // Fast and cheap for testing
        messages: [
          {
            role: 'user',
            content: 'Say "test successful" if you can read this.',
          },
        ],
        max_tokens: 50,
      })

      const response = completion.choices[0]?.message?.content

      if (response && response.length > 0) {
        return {
          success: true,
          message: 'Successfully connected to OpenAI!',
          details: `Using model: ${completion.model}`,
        }
      }

      return {
        success: false,
        message: 'No response from OpenAI API',
      }
    } catch (error: any) {
      // Handle specific error types
      if (error.status === 401) {
        return {
          success: false,
          message: 'Invalid API key',
          details: 'Please check your API key and try again',
        }
      }

      if (error.status === 429) {
        return {
          success: false,
          message: 'Rate limit exceeded',
          details: 'You have made too many requests. Try again later.',
        }
      }

      if (error.status === 402) {
        return {
          success: false,
          message: 'Insufficient credits',
          details: 'Please add credits to your OpenAI account',
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
   * Generate exam using OpenAI
   */
  async generateExam(
    config: ExamGenerationConfig,
    sourceText: string,
    apiKey: string
  ): Promise<string> {
    try {
      // Initialize OpenAI client
      const openai = new OpenAI({
        apiKey,
        dangerouslyAllowBrowser: true,
      })

      // Build the prompt
      const prompt = this.buildExamPrompt(config, sourceText)

      // Generate content using GPT-4o-mini (good balance of speed/quality/cost)
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini', // Fast and cost-effective
        messages: [
          {
            role: 'system',
            content:
              'You are an expert exam creator. Generate educational exams based on study materials. Follow all formatting requirements exactly.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.7,
        max_tokens: 8192,
      })

      const examContent = completion.choices[0]?.message?.content

      if (!examContent || examContent.trim().length === 0) {
        throw new Error('OpenAI returned empty response')
      }

      return examContent
    } catch (error: any) {
      // Re-throw with user-friendly message
      if (error.status === 402) {
        throw new Error('Insufficient OpenAI credits. Please add funds to your account.')
      }

      throw new Error(`Failed to generate exam: ${error.message || 'Unknown error'}`)
    }
  }

  /**
   * Build the exam generation prompt
   *
   * Same structure as Gemini, but optimized for OpenAI's models
   */
  private buildExamPrompt(config: ExamGenerationConfig, sourceText: string): string {
    // Extract question type configuration
    const questionTypesText = Object.entries(config.questionTypes)
      .filter(([_, count]) => count && count > 0)
      .map(([type, count]) => {
        const readable = type.replace(/([A-Z])/g, ' $1').trim()
        const capitalized = readable.charAt(0).toUpperCase() + readable.slice(1)
        return `  - ${capitalized}: ${count} question(s)`
      })
      .join('\n')

    // Extract difficulty distribution
    const difficultyText = Object.entries(config.difficultyDistribution)
      .filter(([_, count]) => count > 0)
      .map(([level, count]) => {
        const readable = level.replace(/([A-Z])/g, ' $1').trim()
        const capitalized = readable.charAt(0).toUpperCase() + readable.slice(1)
        return `  - ${capitalized}: ${count} question(s)`
      })
      .join('\n')

    // Truncate source text if too long
    const maxSourceLength = 100000
    const truncatedSource =
      sourceText.length > maxSourceLength
        ? sourceText.substring(0, maxSourceLength) + '\n\n[... content truncated ...]'
        : sourceText

    return `You are an expert exam creator. Generate an educational exam based on the provided study material.

**CRITICAL INSTRUCTIONS:**
1. Generate ONLY the exam content - no introductions, explanations, or suggestions
2. Follow the format below EXACTLY
3. Use ONLY information from the provided study material
4. Distribute questions according to the specified difficulty levels
5. Ensure questions are clear, unambiguous, and academically rigorous

**EXAM FORMAT:**

General Topic: [Extract the main topic from the study material]

----Exam Content----

[Group questions by type]
[Number all questions sequentially]
[For multiple choice, use A, B, C, D format]
[For true/false, state clearly]
[For fill in blanks, use _____ for blanks]

[PAGE BREAK]

----Answer Key----

[List all answers in order]
[Multiple choice: 1. A, 2. C, etc.]
[True/false: 1. True, 2. False, etc.]
[Fill in blanks: provide correct words]
[Short answer/essay: provide key points]

**QUESTION TYPES & QUANTITIES:**
${questionTypesText}

Total Questions: ${config.totalQuestions}

**DIFFICULTY DISTRIBUTION:**
${difficultyText}

**STUDY MATERIAL:**
${truncatedSource}

**OUTPUT:**
Generate the exam now. Output ONLY the exam content in the format specified above.`
  }
}
