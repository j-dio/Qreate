/**
 * PDF Generator Service
 *
 * Generates professional PDF exams using Electron's built-in PDF printing.
 *
 * How it works:
 * 1. Create invisible BrowserWindow
 * 2. Load HTML content (formatted exam)
 * 3. Use webContents.printToPDF() to generate PDF
 * 4. Save to local file system
 * 5. Clean up browser window
 *
 * Benefits:
 * - No external dependencies (uses Electron's Chromium)
 * - Full HTML/CSS support for beautiful formatting
 * - Works offline
 * - Fast and reliable
 */

import { BrowserWindow } from 'electron'
import * as fs from 'fs'
import * as path from 'path'

/**
 * Generated Question interface
 */
interface GeneratedQuestion {
  id: string
  type: string
  difficulty: string
  question: string
  options?: string[]
  answer: string | string[]
  explanation?: string
}

/**
 * Generated Exam interface
 */
interface GeneratedExam {
  id: string
  topic: string
  questions: GeneratedQuestion[]
  createdAt: Date
  totalQuestions: number
  metadata: {
    sourceFiles: string[]
    aiProvider: string
    generationTime?: number
  }
}

/**
 * PDF Generator
 *
 * Usage:
 * ```ts
 * const generator = new PDFGenerator()
 * await generator.generateExamPDF(exam, '/path/to/output.pdf')
 * ```
 */
export class PDFGenerator {
  /**
   * Generate PDF from exam data
   *
   * @param examData - Generated exam object OR raw exam content from Groq
   * @param outputPath - Absolute path to save PDF
   * @returns Promise<void>
   */
  async generateExamPDF(examData: GeneratedExam | any, outputPath: string): Promise<void> {
    // Ensure output directory exists
    const dir = path.dirname(outputPath)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }

    // Check if this is raw Groq content or structured exam object
    let html: string
    if (typeof examData.content === 'string') {
      // New Groq format: raw exam content
      html = this.formatGroqExamAsHTML(examData)
    } else if (examData.questions && Array.isArray(examData.questions)) {
      // Old structured format
      html = this.formatExamAsHTML(examData)
    } else {
      throw new Error('Invalid exam data format')
    }

    // Create hidden browser window
    const win = new BrowserWindow({
      show: false,
      webPreferences: {
        offscreen: true,
      },
    })

    // Load HTML content
    await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)

    // Wait for content to render
    await new Promise(resolve => setTimeout(resolve, 1000))

    // Generate PDF
    const pdfData = await win.webContents.printToPDF({
      printBackground: true,
      pageSize: 'Letter',
      margins: {
        top: 0.5,
        bottom: 0.5,
        left: 0.5,
        right: 0.5,
      },
    })

    // Save to file
    fs.writeFileSync(outputPath, pdfData)

    // Clean up
    win.destroy()

    console.log('[PDFGenerator] PDF created:', outputPath)
  }

  /**
   * Format raw Groq exam content as HTML with professional styling
   *
   * @param examData - Raw exam data from Groq
   * @returns HTML string
   */
  /**
   * Renumber questions sequentially in display order.
   *
   * The AI assigns concept IDs globally across all question types, so questions
   * within each type-section end up with non-sequential numbers (e.g., MC gets
   * 1, 7, 12… and T/F gets 3, 4, 5…). This post-processor walks the exam body
   * in display order, builds an old→new mapping, renumbers every question line,
   * and rebuilds the answer key to match — without touching any question text,
   * options, or answer content.
   *
   * Ghost answers (answer-key entries with no corresponding question body) are
   * silently dropped so the key stays consistent with what is actually printed.
   */
  private renumberContent(content: string): string {
    // Locate the answer key delimiter
    const delimiterRegex = /\n(----+\s*Answer Key\s*----+)\s*\n/i
    const delimMatch = content.match(delimiterRegex)

    if (!delimMatch || delimMatch.index === undefined) {
      return content // No recognisable answer key — return as-is
    }

    const examBody = content.slice(0, delimMatch.index)
    const answerKeyRaw = content.slice(delimMatch.index + delimMatch[0].length)
    const delimStr = delimMatch[1]

    // Walk exam body lines in display order, collect question numbers as seen
    const oldToNew = new Map<number, number>()
    let displayCounter = 0
    for (const line of examBody.split('\n')) {
      const m = line.match(/^(\d+)\.\s+\S/)
      if (m) {
        const oldNum = parseInt(m[1], 10)
        if (!oldToNew.has(oldNum)) {
          displayCounter++
          oldToNew.set(oldNum, displayCounter)
        }
      }
    }

    // If numbering is already sequential, nothing to do
    let alreadySequential = true
    let expected = 1
    for (const [oldNum, newNum] of oldToNew) {
      if (oldNum !== newNum || newNum !== expected) {
        alreadySequential = false
        break
      }
      expected++
    }
    if (alreadySequential) return content

    // Renumber question lines in exam body (only lines in oldToNew are affected)
    const renumberedBody = examBody.replace(/^(\d+)(\.\s)/gm, (match, numStr, rest) => {
      const oldNum = parseInt(numStr, 10)
      const newNum = oldToNew.get(oldNum)
      return newNum !== undefined ? `${newNum}${rest}` : match
    })

    // Parse answer key: collect each numbered entry (handles multi-line answers)
    const answerEntries = new Map<number, string>()
    let currentAKNum: number | null = null
    const currentAKLines: string[] = []

    for (const line of answerKeyRaw.split('\n')) {
      const m = line.match(/^(\d+)\.\s+(.+)/)
      if (m) {
        if (currentAKNum !== null && currentAKLines.length > 0) {
          answerEntries.set(currentAKNum, currentAKLines.join('\n'))
          currentAKLines.length = 0
        }
        currentAKNum = parseInt(m[1], 10)
        currentAKLines.push(m[2])
      } else if (currentAKNum !== null && line.trim()) {
        currentAKLines.push(line) // continuation of long answer
      }
    }
    if (currentAKNum !== null && currentAKLines.length > 0) {
      answerEntries.set(currentAKNum, currentAKLines.join('\n'))
    }

    // Rebuild answer key in new display order; drop ghost entries (no matching question body)
    const sortedEntries = Array.from(oldToNew.entries()).sort((a, b) => a[1] - b[1])
    const newAnswerLines: string[] = []
    for (const [oldNum, newNum] of sortedEntries) {
      const answer = answerEntries.get(oldNum)
      if (answer !== undefined) {
        newAnswerLines.push(`${newNum}. ${answer}`)
      }
    }

    return renumberedBody + '\n' + delimStr + '\n' + newAnswerLines.join('\n')
  }

  private formatGroqExamAsHTML(examData: any): string {
    const { content, totalQuestions, metadata } = examData

    // Normalise question numbering to sequential display order before rendering
    const normalisedContent = this.renumberContent(content)

    // Extract topic from content (first line after "General Topic:")
    let topic = 'Generated Exam'
    const topicMatch = normalisedContent.match(/General Topic:\s*(.+?)(?:\n|----)/i)
    if (topicMatch) {
      topic = topicMatch[1].trim()
    }

    // Build HTML
    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${topic}</title>
  <style>
    body {
      font-family: 'Georgia', serif;
      line-height: 1.6;
      margin: 0;
      padding: 20px;
      color: #333;
      background: white;
    }
    .header {
      text-align: center;
      border-bottom: 2px solid #333;
      padding-bottom: 20px;
      margin-bottom: 30px;
    }
    .title {
      font-size: 24px;
      font-weight: bold;
      margin-bottom: 10px;
    }
    .subtitle {
      font-size: 14px;
      color: #666;
    }
    .content {
      white-space: pre-line;
      font-size: 12px;
      line-height: 1.5;
    }
    .page-break {
      page-break-before: always;
    }
    .footer {
      margin-top: 30px;
      text-align: center;
      font-size: 10px;
      color: #666;
      border-top: 1px solid #ccc;
      padding-top: 10px;
      page-break-inside: avoid;
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="title">${topic}</div>
    <div class="subtitle">
      ${totalQuestions} Questions | Generated with Qreate | ${new Date().toLocaleDateString()}
    </div>
  </div>
  
  <div class="content">
${normalisedContent}
  </div>

  <div class="footer">
    Generated with Qreate - AI-Powered Exam Creator | ${metadata?.aiProvider || 'Together AI (Backend)'}
  </div>
</body>
</html>`

    return html
  }

  /**
   * Format exam as HTML with professional styling (legacy format)
   *
   * @param exam - Generated exam object
   * @returns HTML string
   */
  private formatExamAsHTML(exam: GeneratedExam): string {
    // Group questions by type
    const questionsByType = this.groupQuestionsByType(exam.questions)

    // Build HTML
    let html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: 'Georgia', 'Times New Roman', serif;
      font-size: 12pt;
      line-height: 1.6;
      color: #000;
      padding: 40px;
    }

    .header {
      text-align: center;
      border-bottom: 3px solid #000;
      padding-bottom: 20px;
      margin-bottom: 30px;
    }

    .header h1 {
      font-size: 24pt;
      font-weight: bold;
      margin-bottom: 10px;
    }

    .header .meta {
      font-size: 10pt;
      color: #666;
    }

    .section {
      margin-bottom: 30px;
      page-break-inside: avoid;
    }

    .section-title {
      font-size: 16pt;
      font-weight: bold;
      border-bottom: 2px solid #333;
      padding-bottom: 5px;
      margin-bottom: 15px;
    }

    .question {
      margin-bottom: 20px;
      page-break-inside: avoid;
    }

    .question-number {
      font-weight: bold;
      margin-bottom: 5px;
    }

    .question-text {
      margin-bottom: 10px;
    }

    .options {
      margin-left: 20px;
    }

    .option {
      margin-bottom: 5px;
    }

    .page-break {
      page-break-before: always;
    }

    .answer-key {
      margin-top: 40px;
    }

    .answer-key-title {
      font-size: 18pt;
      font-weight: bold;
      border-bottom: 3px solid #000;
      padding-bottom: 10px;
      margin-bottom: 20px;
    }

    .answer-item {
      margin-bottom: 8px;
    }

    .footer {
      margin-top: 30px;
      text-align: center;
      font-size: 9pt;
      color: #999;
      border-top: 1px solid #ccc;
      padding-top: 10px;
      page-break-inside: avoid;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>${this.escapeHtml(exam.topic)}</h1>
    <div class="meta">
      ${exam.totalQuestions} Questions |
      Generated with Qreate |
      ${new Date(exam.createdAt).toLocaleDateString()}
    </div>
  </div>

  <div class="content">
`

    // Add question sections
    let questionNumber = 1
    const answers: { number: number; answer: string }[] = []

    for (const [type, questions] of Object.entries(questionsByType)) {
      if (questions.length === 0) continue

      html += `
    <div class="section">
      <div class="section-title">${this.formatQuestionTypeHeader(type)}</div>
`

      for (const question of questions) {
        const { questionHtml, answer } = this.formatQuestion(question, questionNumber)
        html += questionHtml
        answers.push({ number: questionNumber, answer })
        questionNumber++
      }

      html += `
    </div>
`
    }

    // Add page break before answer key
    html += `
  </div>

  <div class="page-break"></div>

  <div class="answer-key">
    <div class="answer-key-title">Answer Key</div>
`

    // Add answers
    for (const { number, answer } of answers) {
      html += `
    <div class="answer-item">
      <strong>${number}.</strong> ${this.escapeHtml(answer)}
    </div>
`
    }

    html += `
  </div>

  <div class="footer">
    Generated by Qreate - Automated Exam Creator
  </div>
</body>
</html>
`

    return html
  }

  /**
   * Group questions by type
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
   */
  private formatQuestion(
    question: GeneratedQuestion,
    number: number
  ): { questionHtml: string; answer: string } {
    let questionHtml = `
    <div class="question">
      <div class="question-number">${number}.</div>
      <div class="question-text">${this.escapeHtml(question.question)}</div>
`

    // Add options if present
    if (question.options && question.options.length > 0) {
      questionHtml += `
      <div class="options">
`
      question.options.forEach((option, index) => {
        const letter = String.fromCharCode(65 + index) // A, B, C, D...
        questionHtml += `
        <div class="option">${letter}. ${this.escapeHtml(option)}</div>
`
      })
      questionHtml += `
      </div>
`
    }

    questionHtml += `
    </div>
`

    // Format answer
    let answer = 'No answer provided'
    if (question.answer) {
      if (Array.isArray(question.answer)) {
        answer = question.answer.join(', ')
      } else {
        answer = question.answer
      }
    }

    return { questionHtml, answer }
  }

  /**
   * Escape HTML special characters
   */
  private escapeHtml(text: string): string {
    const map: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    }
    return text.replace(/[&<>"']/g, char => map[char])
  }
}
