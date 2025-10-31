/**
 * Document Formatter Service
 *
 * Converts GeneratedExam objects into Google Docs API format.
 *
 * Google Docs API uses a request-based approach:
 * - You send an array of "requests" that tell the API what to insert/format
 * - Each request operates on specific text ranges (indices)
 * - Text is inserted first, then formatting is applied
 *
 * Output Structure:
 * 1. Title (Exam Topic)
 * 2. Questions by Type (Multiple Choice, True/False, etc.)
 * 3. [PAGE BREAK]
 * 4. Answer Key
 *
 * Example Google Docs Request:
 * ```json
 * {
 *   "insertText": {
 *     "location": { "index": 1 },
 *     "text": "My Exam\n"
 *   }
 * }
 * ```
 */

import type { GeneratedExam, GeneratedQuestion } from '../store/useExamGenerationStore'

/**
 * Document Formatter
 *
 * Usage:
 * ```ts
 * const formatter = new DocumentFormatter()
 * const requests = formatter.formatExam(exam)
 * await window.electron.googleDrive.createDocument('My Exam', requests)
 * ```
 */
export class DocumentFormatter {
  /**
   * Format exam into Google Docs API requests
   *
   * @param exam - Generated exam to format
   * @returns Array of Google Docs API requests
   */
  formatExam(exam: GeneratedExam): any[] {
    const requests: any[] = []

    // Build document content as text first
    let content = ''
    let questionNumber = 1
    const answerKey: string[] = []

    // Title
    content += `${exam.topic || 'Generated Exam'}\n\n`

    // Group questions by type
    const questionsByType = this.groupQuestionsByType(exam.questions)

    // Format each type section
    for (const [type, questions] of Object.entries(questionsByType)) {
      if (questions.length === 0) continue

      // Section header
      content += `${this.formatQuestionTypeHeader(type)}\n\n`

      // Questions
      for (const question of questions) {
        const { questionText, answerForKey } = this.formatQuestion(question, questionNumber)
        content += questionText + '\n\n'
        answerKey.push(`${questionNumber}. ${answerForKey}`)
        questionNumber++
      }

      content += '\n' // Extra spacing between sections
    }

    // Page break marker
    content += '[PAGE BREAK]\n\n'

    // Answer key
    content += 'Answer Key\n\n'
    content += answerKey.join('\n')

    // Create the insert text request
    requests.push({
      insertText: {
        location: { index: 1 },
        text: content,
      },
    })

    // Apply formatting
    const formatRequests = this.applyFormatting(content)
    requests.push(...formatRequests)

    return requests
  }

  /**
   * Group questions by type for organized display
   */
  private groupQuestionsByType(
    questions: GeneratedQuestion[]
  ): Record<string, GeneratedQuestion[]> {
    const grouped: Record<string, GeneratedQuestion[]> = {
      multipleChoice: [],
      trueFalse: [],
      fillInTheBlanks: [],
      identification: [],
      shortAnswer: [],
      essay: [],
      matching: [],
    }

    for (const question of questions) {
      if (grouped[question.type]) {
        grouped[question.type].push(question)
      }
    }

    return grouped
  }

  /**
   * Format question type header
   */
  private formatQuestionTypeHeader(type: string): string {
    const headers: Record<string, string> = {
      multipleChoice: 'Multiple Choice',
      trueFalse: 'True/False',
      fillInTheBlanks: 'Fill in the Blanks',
      identification: 'Identification',
      shortAnswer: 'Short Answer',
      essay: 'Essay',
      matching: 'Matching',
    }

    return headers[type] || type
  }

  /**
   * Format a single question
   *
   * @param question - Question to format
   * @param number - Question number
   * @returns Formatted question text and answer for key
   */
  private formatQuestion(
    question: GeneratedQuestion,
    number: number
  ): { questionText: string; answerForKey: string } {
    let questionText = `${number}. ${question.question}\n`

    // Add options for multiple choice, true/false, etc.
    if (question.options && question.options.length > 0) {
      question.options.forEach((option, index) => {
        const letter = String.fromCharCode(65 + index) // A, B, C, D...
        questionText += `   ${letter}. ${option}\n`
      })
    }

    // Answer for key
    // Handle both string and string[] answers
    let answerForKey = '(No answer provided)'
    if (question.answer) {
      if (Array.isArray(question.answer)) {
        answerForKey = question.answer.join(', ')
      } else {
        answerForKey = question.answer
      }
    }

    return { questionText, answerForKey }
  }

  /**
   * Apply formatting to the document
   *
   * This includes:
   * - Bold for title
   * - Bold for section headers
   * - Page break
   *
   * Note: In a real implementation, we'd calculate exact text indices
   * for formatting. For now, we'll keep it simple.
   */
  private applyFormatting(content: string): any[] {
    const requests: any[] = []

    // Find the [PAGE BREAK] marker and replace with actual page break
    const pageBreakIndex = content.indexOf('[PAGE BREAK]')
    if (pageBreakIndex !== -1) {
      requests.push({
        insertPageBreak: {
          location: { index: pageBreakIndex + 1 },
        },
      })

      // Delete the [PAGE BREAK] text
      requests.push({
        deleteContentRange: {
          range: {
            startIndex: pageBreakIndex + 1,
            endIndex: pageBreakIndex + 14, // Length of "[PAGE BREAK]\n\n"
          },
        },
      })
    }

    return requests
  }
}
