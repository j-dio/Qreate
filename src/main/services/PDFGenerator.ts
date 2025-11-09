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
   * @param exam - Generated exam object
   * @param outputPath - Absolute path to save PDF
   * @returns Promise<void>
   */
  async generateExamPDF(exam: GeneratedExam, outputPath: string): Promise<void> {
    // Ensure output directory exists
    const dir = path.dirname(outputPath)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }

    // Create HTML content
    const html = this.formatExamAsHTML(exam)

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
   * Format exam as HTML with professional styling
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
      position: fixed;
      bottom: 20px;
      right: 40px;
      font-size: 9pt;
      color: #999;
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
