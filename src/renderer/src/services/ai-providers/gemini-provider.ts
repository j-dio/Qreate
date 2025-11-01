/**
 * Google Gemini AI Provider
 *
 * Implementation of the IAIProvider interface for Google's Gemini API.
 *
 * Why Gemini?
 * - Completely FREE (1M tokens/month)
 * - No credit card required
 * - Fast and high-quality
 * - Great for students and testing
 *
 * Model: gemini-2.5-flash
 * - Fast and intelligent (Gemini 2.5 generation)
 * - Best price-performance ratio
 * - Excellent for exam generation
 * - Large context window (1M tokens)
 */

import { GoogleGenerativeAI } from '@google/generative-ai'
import type {
  IAIProvider,
  ExamGenerationConfig,
  TestConnectionResult,
} from '../../types/ai-providers'

export class GeminiProvider implements IAIProvider {
  readonly type = 'gemini' as const

  /**
   * Test connection to Gemini API
   *
   * Makes a minimal API call to verify the key works
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

      // Gemini API keys typically start with "AIza"
      if (!apiKey.startsWith('AIza')) {
        return {
          success: false,
          message: 'Invalid API key format. Gemini keys usually start with "AIza"',
        }
      }

      // Initialize Gemini client
      const genAI = new GoogleGenerativeAI(apiKey)
      const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })

      // Make a minimal test call
      const result = await model.generateContent('Say "test successful" if you can read this.')

      const response = await result.response
      const text = response.text()

      if (text && text.length > 0) {
        return {
          success: true,
          message: 'Successfully connected to Google Gemini!',
          details: 'Using model: gemini-2.5-flash',
        }
      }

      return {
        success: false,
        message: 'No response from Gemini API',
      }
    } catch (error: any) {
      // Handle specific error types
      if (error.message?.includes('API_KEY_INVALID')) {
        return {
          success: false,
          message: 'Invalid API key',
          details: 'Please check your API key and try again',
        }
      }

      if (error.message?.includes('quota')) {
        return {
          success: false,
          message: 'API quota exceeded',
          details: 'You have reached the free tier limit. Try again later.',
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
   * Generate exam using Gemini
   *
   * Formats the prompt and calls Gemini API to generate exam content
   */
  async generateExam(
    config: ExamGenerationConfig,
    sourceText: string,
    apiKey: string
  ): Promise<string> {
    try {
      // Initialize Gemini client
      const genAI = new GoogleGenerativeAI(apiKey)
      const model = genAI.getGenerativeModel({
        model: 'gemini-2.5-flash',
        generationConfig: {
          temperature: 0.7, // Balanced creativity and consistency
          topP: 0.9,
          topK: 40,
          maxOutputTokens: 8192, // Allow long exams
        },
      })

      // Build the prompt
      const prompt = this.buildExamPrompt(config, sourceText)

      // Generate content
      const result = await model.generateContent(prompt)
      const response = await result.response
      const examContent = response.text()

      if (!examContent || examContent.trim().length === 0) {
        throw new Error('Gemini returned empty response')
      }

      return examContent
    } catch (error: any) {
      // Re-throw with user-friendly message
      throw new Error(
        `Failed to generate exam: ${error.message || 'Unknown error'}`
      )
    }
  }

  /**
   * Build the exam generation prompt
   *
   * This is critical - the prompt structure determines output quality.
   *
   * Prompt Engineering Principles:
   * 1. Clear role definition (you are an expert exam creator)
   * 2. Explicit format requirements (structure, no extra text)
   * 3. Specific constraints (difficulty levels, question types)
   * 4. Examples (if needed)
   * 5. Output format specification
   */
  private buildExamPrompt(config: ExamGenerationConfig, sourceText: string): string {
    // Extract question type configuration
    const questionTypesText = Object.entries(config.questionTypes)
      .filter(([_, count]) => count && count > 0)
      .map(([type, count]) => {
        // Convert camelCase to readable format
        const readable = type.replace(/([A-Z])/g, ' $1').trim()
        const capitalized = readable.charAt(0).toUpperCase() + readable.slice(1)
        return `  - ${capitalized}: ${count} question(s)`
      })
      .join('\n')

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

    // Truncate source text if too long (Gemini has 1M token limit, but let's be safe)
    const maxSourceLength = 100000 // ~25k words
    const truncatedSource =
      sourceText.length > maxSourceLength
        ? sourceText.substring(0, maxSourceLength) + '\n\n[... content truncated ...]'
        : sourceText

    // Build the prompt
    return `You are an expert exam creator. Your task is to generate an educational exam based on the provided study material.

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
