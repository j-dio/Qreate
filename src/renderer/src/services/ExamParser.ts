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
    console.log('[ExamParser] Extracting sections from text...')
    console.log('[ExamParser] Full text preview:', examText.substring(0, 500))

    // Extract topic
    const topicMatch = examText.match(/General Topic:\s*(.+)/i)
    const topic = topicMatch ? topicMatch[1].trim() : 'Generated Exam'
    console.log('[ExamParser] Extracted topic:', topic)

    // Try multiple variations of section headers (case-insensitive, flexible dashes)
    let examContentMatch = examText.match(
      /----+\s*Exam Content\s*----+\s*([\s\S]*?)(?:----+\s*Answer Key\s*----+|\[PAGE BREAK\])/i
    )

    // If not found, try without dashes
    if (!examContentMatch) {
      console.log('[ExamParser] Standard format not found, trying alternative formats...')
      examContentMatch = examText.match(
        /Exam Content[:\s]*([\s\S]*?)(?:Answer Key[:\s]|\[PAGE BREAK\])/i
      )
    }

    // If still not found, try to split by "Multiple Choice:" as the start of content
    if (!examContentMatch) {
      console.log(
        '[ExamParser] Alternative format not found, trying to extract from Multiple Choice onwards...'
      )
      examContentMatch = examText.match(
        /(?:Multiple Choice|True\/False|Fill in|Short Answer|Essay|Matching|Identification)[:\s]*([\s\S]*?)(?:Answer Key[:\s]|\[PAGE BREAK\]|$)/i
      )
      if (examContentMatch) {
        // Prepend the question type header we found
        const fullMatch = examText.match(
          /((?:Multiple Choice|True\/False|Fill in|Short Answer|Essay|Matching|Identification)[:\s]*[\s\S]*?)(?:Answer Key[:\s]|\[PAGE BREAK\]|$)/i
        )
        if (fullMatch) {
          examContentMatch[1] = fullMatch[1]
        }
      }
    }

    if (!examContentMatch) {
      console.error('[ExamParser] Could not find exam content in any known format')
      console.error('[ExamParser] Full text:', examText)
      throw new Error('Could not find exam content section in AI response')
    }

    const examContent = examContentMatch[1].trim()
    console.log('[ExamParser] Extracted exam content:', examContent.length, 'characters')

    // Extract answer key (flexible format)
    let answerKeyMatch = examText.match(/----+\s*Answer Key\s*----+\s*([\s\S]*?)$/i)
    if (!answerKeyMatch) {
      answerKeyMatch = examText.match(/Answer Key[:\s]*([\s\S]*?)$/i)
    }

    const answerKey = answerKeyMatch ? answerKeyMatch[1].trim() : ''
    console.log('[ExamParser] Extracted answer key:', answerKey.length, 'characters')

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
  private splitByQuestionType(
    content: string
  ): Array<{ type: GeneratedQuestion['type']; content: string }> {
    const sections: Array<{ type: GeneratedQuestion['type']; content: string }> = []

    console.log('[ExamParser] ========== SPLITTING BY QUESTION TYPE ==========')
    console.log('[ExamParser] Full content length:', content.length)

    // Find all question type headers
    const lines = content.split('\n')
    let currentType: GeneratedQuestion['type'] | null = null
    let currentContent: string[] = []

    for (const line of lines) {
      const trimmedLine = line.trim()

      // Check if this line is a question type header
      const detectedType = this.detectQuestionType(trimmedLine)

      if (detectedType) {
        console.log(`[ExamParser] Found section header: "${trimmedLine}" -> ${detectedType}`)

        // Save previous section
        if (currentType && currentContent.length > 0) {
          const sectionContent = currentContent.join('\n').trim()
          console.log(
            `[ExamParser] Saving previous section (${currentType}): ${sectionContent.length} characters`
          )
          console.log(`[ExamParser] Section preview:`, sectionContent.substring(0, 300))

          sections.push({
            type: currentType,
            content: sectionContent,
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
      const sectionContent = currentContent.join('\n').trim()
      console.log(
        `[ExamParser] Saving final section (${currentType}): ${sectionContent.length} characters`
      )
      console.log(`[ExamParser] Section preview:`, sectionContent.substring(0, 300))

      sections.push({
        type: currentType,
        content: sectionContent,
      })
    }

    console.log(`[ExamParser] Total sections found: ${sections.length}`)
    console.log('[ExamParser] ========== END SPLITTING ==========')

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

    console.log('[ExamParser] Splitting content by question numbers...')
    console.log('[ExamParser] Content length:', content.length)

    // Split by lines and manually group by question numbers
    const lines = content.split('\n')
    let currentQuestionNumber: number | null = null
    let currentQuestionLines: string[] = []

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      // Check if this line starts with a question number (e.g., "1. ", "2. ")
      const questionMatch = line.match(/^(\d+)\.\s+(.+)/)

      if (questionMatch) {
        // Save previous question if exists
        if (currentQuestionNumber !== null && currentQuestionLines.length > 0) {
          const questionText = currentQuestionLines.join('\n').trim()
          console.log(`[ExamParser] Saved Q${currentQuestionNumber}: ${questionText.length} chars`)
          blocks.push({
            number: currentQuestionNumber,
            text: questionText,
          })
        }

        // Start new question
        currentQuestionNumber = parseInt(questionMatch[1], 10)
        currentQuestionLines = [questionMatch[2]] // Start with the question text (after the number)
        console.log(
          `[ExamParser] Found question ${currentQuestionNumber}: "${questionMatch[2].substring(0, 50)}..."`
        )
      } else if (currentQuestionNumber !== null) {
        // Add this line to the current question
        currentQuestionLines.push(line)
      }
    }

    // Save the last question
    if (currentQuestionNumber !== null && currentQuestionLines.length > 0) {
      const questionText = currentQuestionLines.join('\n').trim()
      console.log(`[ExamParser] Saved Q${currentQuestionNumber}: ${questionText.length} chars`)
      blocks.push({
        number: currentQuestionNumber,
        text: questionText,
      })
    }

    console.log(`[ExamParser] Total blocks found: ${blocks.length}`)

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
      console.log(`[ExamParser] ===== Parsing Q${number} (${type}) =====`)
      console.log(`[ExamParser] Raw text block:`, text)

      const lines = text.split('\n').filter(l => l.length > 0)
      console.log(`[ExamParser] Split into ${lines.length} lines`)

      if (lines.length === 0) return null

      // First line is the question (after trimming)
      const questionText = lines[0].trim()
      console.log(`[ExamParser] Question text: "${questionText}"`)

      // Remaining lines are options (for multiple choice, true/false, etc.)
      const options: string[] = []

      console.log(`[ExamParser] Checking ${lines.length - 1} lines for options...`)
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i]
        console.log(`[ExamParser] Line ${i}: "${line}" (length: ${line.length})`)

        // Match various option formats:
        // "A. Option", "   A. Option", "A) Option", "a. Option"
        // More flexible regex that handles indentation and different separators
        const optionMatch = line.match(/^\s*([A-Da-d])[.)\]]\s+(.+)/)

        if (optionMatch) {
          options.push(optionMatch[2].trim())
          console.log(
            `[ExamParser] ✓ Matched! Letter: ${optionMatch[1]}, Text: ${optionMatch[2].trim()}`
          )
        } else {
          console.log(`[ExamParser] ✗ No match for this line`)
        }
      }

      // Log warning if multiple choice has wrong number of options
      if (type === 'multipleChoice' && options.length !== 4) {
        console.warn(
          `[ExamParser] Multiple choice Q${number} has ${options.length} options (expected 4)`
        )
      }

      console.log(`[ExamParser] Final result: Q${number} with ${options.length} options`)

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
