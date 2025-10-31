/**
 * Exam Parser Service
 *
 * Parses AI-generated exam text into structured question objects.
 *
 * Expected Format (from Gemini/OpenAI):
 * ```
 * General Topic: Biology Introduction
 *
 * ----Exam Content----
 *
 * Multiple Choice:
 * 1. What is photosynthesis?
 *    A. Process of making food
 *    B. Process of breathing
 *    C. Process of reproduction
 *    D. Process of growth
 *
 * True/False:
 * 2. All plants can photosynthesize.
 *
 * [PAGE BREAK]
 *
 * ----Answer Key----
 *
 * 1. A
 * 2. True
 * ```
 */

import type { GeneratedQuestion } from '../store/useExamGenerationStore'

/**
 * Question Type Mappings
 *
 * Maps the text labels in AI responses to our internal question types
 */
const QUESTION_TYPE_PATTERNS: Record<string, GeneratedQuestion['type']> = {
  'multiple choice': 'multipleChoice',
  'true/false': 'trueFalse',
  'true or false': 'trueFalse',
  'fill in the blank': 'fillInTheBlanks',
  'fill in the blanks': 'fillInTheBlanks',
  'short answer': 'shortAnswer',
  essay: 'essay',
  matching: 'matching',
  identification: 'identification',
}

/**
 * Exam Parser
 *
 * Parses AI-generated exam text into structured data.
 */
export class ExamParser {
  /**
   * Parse AI-generated exam text
   *
   * @param examText - Raw text from AI (Gemini/OpenAI)
   * @returns Array of parsed questions
   */
  parseExam(examText: string): GeneratedQuestion[] {
    console.log('[ExamParser] Starting parse, text length:', examText.length)

    try {
      // Extract sections
      const { topic, examContent, answerKey } = this.extractSections(examText)

      console.log('[ExamParser] Extracted topic:', topic)
      console.log('[ExamParser] Exam content length:', examContent.length)
      console.log('[ExamParser] Answer key length:', answerKey.length)

      // Parse questions from exam content
      const questions = this.parseQuestions(examContent)

      console.log('[ExamParser] Parsed questions:', questions.length)

      // Parse and attach answers
      const answersMap = this.parseAnswers(answerKey)
      this.attachAnswers(questions, answersMap)

      console.log('[ExamParser] Successfully parsed', questions.length, 'questions')

      return questions
    } catch (error) {
      console.error('[ExamParser] Parse failed:', error)
      throw new Error(
        `Failed to parse exam: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  /**
   * Extract main sections from exam text
   */
  private extractSections(examText: string): {
    topic: string
    examContent: string
    answerKey: string
  } {
    // Extract topic
    const topicMatch = examText.match(/General Topic:\s*(.+)/i)
    const topic = topicMatch ? topicMatch[1].trim() : 'Generated Exam'

    // Split by ----Exam Content---- and ----Answer Key----
    const examContentMatch = examText.match(/----Exam Content----\s*([\s\S]*?)(?:----Answer Key----|\[PAGE BREAK\])/i)
    const answerKeyMatch = examText.match(/----Answer Key----\s*([\s\S]*?)$/i)

    if (!examContentMatch) {
      throw new Error('Could not find "----Exam Content----" section')
    }

    const examContent = examContentMatch[1].trim()
    const answerKey = answerKeyMatch ? answerKeyMatch[1].trim() : ''

    return { topic, examContent, answerKey }
  }

  /**
   * Parse questions from exam content section
   */
  private parseQuestions(examContent: string): GeneratedQuestion[] {
    const questions: GeneratedQuestion[] = []

    // Split content by question type headers
    const sections = this.splitByQuestionType(examContent)

    for (const { type, content } of sections) {
      const sectionQuestions = this.parseQuestionSection(type, content)
      questions.push(...sectionQuestions)
    }

    return questions
  }

  /**
   * Split content by question type headers (e.g., "Multiple Choice:", "True/False:")
   */
  private splitByQuestionType(content: string): Array<{ type: GeneratedQuestion['type']; content: string }> {
    const sections: Array<{ type: GeneratedQuestion['type']; content: string }> = []

    // Find all question type headers
    const lines = content.split('\n')
    let currentType: GeneratedQuestion['type'] | null = null
    let currentContent: string[] = []

    for (const line of lines) {
      const trimmedLine = line.trim()

      // Check if this line is a question type header
      const detectedType = this.detectQuestionType(trimmedLine)

      if (detectedType) {
        // Save previous section
        if (currentType && currentContent.length > 0) {
          sections.push({
            type: currentType,
            content: currentContent.join('\n').trim(),
          })
        }

        // Start new section
        currentType = detectedType
        currentContent = []
      } else if (currentType) {
        // Add to current section
        currentContent.push(line)
      }
    }

    // Save final section
    if (currentType && currentContent.length > 0) {
      sections.push({
        type: currentType,
        content: currentContent.join('\n').trim(),
      })
    }

    return sections
  }

  /**
   * Detect question type from header line
   */
  private detectQuestionType(line: string): GeneratedQuestion['type'] | null {
    const lowerLine = line.toLowerCase()

    for (const [pattern, type] of Object.entries(QUESTION_TYPE_PATTERNS)) {
      if (lowerLine.includes(pattern)) {
        return type
      }
    }

    return null
  }

  /**
   * Parse questions from a specific type section
   */
  private parseQuestionSection(
    type: GeneratedQuestion['type'],
    content: string
  ): GeneratedQuestion[] {
    const questions: GeneratedQuestion[] = []

    // Split by question numbers (e.g., "1.", "2.", etc.)
    const questionBlocks = this.splitByQuestionNumber(content)

    for (const { number, text } of questionBlocks) {
      const question = this.parseQuestionBlock(number, type, text)
      if (question) {
        questions.push(question)
      }
    }

    return questions
  }

  /**
   * Split content by question numbers
   */
  private splitByQuestionNumber(content: string): Array<{ number: number; text: string }> {
    const blocks: Array<{ number: number; text: string }> = []

    // Match question numbers like "1.", "2.", etc.
    const regex = /^(\d+)\.\s+(.+?)(?=^\d+\.\s+|$)/gms
    let match

    while ((match = regex.exec(content)) !== null) {
      blocks.push({
        number: parseInt(match[1], 10),
        text: match[2].trim(),
      })
    }

    return blocks
  }

  /**
   * Parse individual question block
   */
  private parseQuestionBlock(
    number: number,
    type: GeneratedQuestion['type'],
    text: string
  ): GeneratedQuestion | null {
    try {
      const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0)

      if (lines.length === 0) return null

      // First line is the question
      const questionText = lines[0]

      // Remaining lines are options (for multiple choice, true/false, etc.)
      const options: string[] = []

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i]
        // Match "A. Option", "B. Option", etc.
        const optionMatch = line.match(/^[A-Z]\.\s+(.+)/)
        if (optionMatch) {
          options.push(optionMatch[1].trim())
        }
      }

      return {
        id: `q-${number}`,
        type,
        difficulty: 'moderate', // Default difficulty (AI doesn't specify)
        question: questionText,
        options: options.length > 0 ? options : undefined,
        answer: '', // Will be filled from answer key
        explanation: '', // Optional
      }
    } catch (error) {
      console.error(`[ExamParser] Failed to parse question ${number}:`, error)
      return null
    }
  }

  /**
   * Parse answer key section
   */
  private parseAnswers(answerKeyText: string): Map<number, string> {
    const answersMap = new Map<number, string>()

    // Match patterns like "1. A", "2. True", "3. photosynthesis"
    const lines = answerKeyText.split('\n')

    for (const line of lines) {
      const trimmedLine = line.trim()
      if (!trimmedLine) continue

      // Match "1. A" or "1: A" or "1) A"
      const match = trimmedLine.match(/^(\d+)[.:\)]\s+(.+)/)

      if (match) {
        const questionNumber = parseInt(match[1], 10)
        const answer = match[2].trim()
        answersMap.set(questionNumber, answer)
      }
    }

    return answersMap
  }

  /**
   * Attach answers from answer key to questions
   */
  private attachAnswers(questions: GeneratedQuestion[], answersMap: Map<number, string>): void {
    for (const question of questions) {
      // Extract question number from ID (e.g., "q-1" -> 1)
      const numberMatch = question.id.match(/q-(\d+)/)

      if (numberMatch) {
        const questionNumber = parseInt(numberMatch[1], 10)
        const answer = answersMap.get(questionNumber)

        if (answer) {
          question.answer = answer
        }
      }
    }
  }
}
