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
2. Follow the format below EXACTLY - character for character
3. Use ONLY information from the provided study material
4. ALL questions must be complete sentences with proper formatting
5. For Multiple Choice: ALWAYS include exactly 4 options (A, B, C, D) on separate lines
6. For True/False: Label as "True/False" section, each question is a complete statement
7. Ensure questions are clear, unambiguous, and academically rigorous

**EXACT OUTPUT FORMAT (follow this template precisely):**

General Topic: [Extract the main topic from the study material]

----Exam Content----

Multiple Choice:

1. [Question text here?]
   A. [First option]
   B. [Second option]
   C. [Third option]
   D. [Fourth option]

2. [Next question text here?]
   A. [First option]
   B. [Second option]
   C. [Third option]
   D. [Fourth option]

True/False:

3. [Statement that can be true or false.]

4. [Another statement that can be true or false.]

Fill in the Blanks:

5. [Question text with _____ representing the blank.]

[Continue for all question types...]

[PAGE BREAK]

----Answer Key----

1. A
2. C
3. True
4. False
5. [correct word or phrase]
[Continue for all questions...]

**FORMATTING RULES:**
- Number questions sequentially (1, 2, 3, etc.) across ALL types
- Group questions by type (Multiple Choice first, then True/False, etc.)
- Each multiple choice question MUST have exactly 4 options labeled A, B, C, D
- Each option on its own line, indented with 3 spaces
- One blank line between questions
- Answer key: Just the number and answer (e.g., "1. A", not "1. A. First option")

**QUESTION TYPES & QUANTITIES:**
${questionTypesText}

Total Questions: ${config.totalQuestions}

**DIFFICULTY DISTRIBUTION:**
${difficultyText}

**STUDY MATERIAL:**
${truncatedSource}

**OUTPUT:**
Generate the exam now following the EXACT format above. No introductory text, no explanations, ONLY the formatted exam.`
  }
}
