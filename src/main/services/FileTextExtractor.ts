/**
 * File Text Extraction Service
 *
 * Handles extracting text content from various file types.
 * Runs in the Electron main process (Node.js) for secure file access.
 *
 * Supported Formats:
 * - .txt: Plain text files (direct read)
 * - .docx: Word documents (mammoth library)
 *
 * Why in Main Process?
 * - File system access requires Node.js
 * - Security: Renderer process shouldn't have direct file access
 * - Performance: Large file processing happens in Node.js
 */

import * as fs from 'fs/promises'
import * as path from 'path'
import mammoth from 'mammoth'

/**
 * Text Extraction Result
 */
export interface TextExtractionResult {
  success: boolean
  text?: string
  error?: string
  metadata?: {
    fileType: string
    wordCount: number
    charCount: number
  }
}

/**
 * File Text Extractor Service
 *
 * Usage:
 * ```typescript
 * const extractor = new FileTextExtractor()
 * const result = await extractor.extractText('/path/to/file.docx')
 *
 * if (result.success) {
 *   console.log('Extracted text:', result.text)
 * } else {
 *   console.error('Extraction failed:', result.error)
 * }
 * ```
 */
export class FileTextExtractor {
  /**
   * Extract text from a file
   *
   * Automatically detects file type by extension and uses appropriate extraction method.
   */
  async extractText(filePath: string): Promise<TextExtractionResult> {
    try {
      // Validate file exists
      const exists = await this.fileExists(filePath)
      if (!exists) {
        return {
          success: false,
          error: `File not found: ${filePath}`,
        }
      }

      // Get file extension
      const ext = path.extname(filePath).toLowerCase()

      // Route to appropriate extraction method
      switch (ext) {
        case '.txt':
          return await this.extractFromTxt(filePath)

        case '.docx':
          return await this.extractFromDocx(filePath)

        case '.doc':
          return {
            success: false,
            error: 'Legacy .doc format not supported. Please convert to .docx or .txt',
          }

        case '.pdf':
          return {
            success: false,
            error: 'PDF format not yet supported. Please convert to .docx or .txt',
          }

        default:
          return {
            success: false,
            error: `Unsupported file type: ${ext}. Supported formats: .txt, .docx`,
          }
      }
    } catch (error) {
      return {
        success: false,
        error: `Unexpected error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      }
    }
  }

  /**
   * Extract text from .txt file
   *
   * Simple UTF-8 text file reading.
   */
  private async extractFromTxt(filePath: string): Promise<TextExtractionResult> {
    try {
      // Read file as UTF-8 text
      const text = await fs.readFile(filePath, 'utf-8')

      // Validate content
      if (!text || text.trim().length === 0) {
        return {
          success: false,
          error: 'Text file is empty',
        }
      }

      // Clean up text (normalize line endings, remove excessive whitespace)
      const cleanedText = this.cleanText(text)

      return {
        success: true,
        text: cleanedText,
        metadata: {
          fileType: 'txt',
          wordCount: this.countWords(cleanedText),
          charCount: cleanedText.length,
        },
      }
    } catch (error) {
      return {
        success: false,
        error: `Failed to extract from TXT: ${error instanceof Error ? error.message : 'Unknown error'}`,
      }
    }
  }

  /**
   * Extract text from .docx file
   *
   * Uses mammoth library to convert Word document to plain text.
   *
   * Why mammoth?
   * - Simple, focused API (just extract text)
   * - Handles modern .docx format
   * - Lightweight and reliable
   * - MIT licensed
   */
  private async extractFromDocx(filePath: string): Promise<TextExtractionResult> {
    try {
      // Extract text using mammoth
      const result = await mammoth.extractRawText({ path: filePath })

      const text = result.value // Extracted text
      const messages = result.messages // Any warnings/errors

      // Log any warnings from mammoth
      if (messages.length > 0) {
        console.warn('[FileTextExtractor] Mammoth warnings:', messages)
      }

      // Validate content
      if (!text || text.trim().length === 0) {
        return {
          success: false,
          error: 'Word document appears to be empty or contains only images',
        }
      }

      // Clean up text
      const cleanedText = this.cleanText(text)

      return {
        success: true,
        text: cleanedText,
        metadata: {
          fileType: 'docx',
          wordCount: this.countWords(cleanedText),
          charCount: cleanedText.length,
        },
      }
    } catch (error) {
      return {
        success: false,
        error: `Failed to extract from DOCX: ${error instanceof Error ? error.message : 'Unknown error'}`,
      }
    }
  }

  /**
   * Check if file exists
   */
  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath)
      return true
    } catch {
      return false
    }
  }

  /**
   * Clean and normalize extracted text
   *
   * - Normalize line endings (CRLF → LF)
   * - Remove excessive whitespace
   * - Trim leading/trailing whitespace
   */
  private cleanText(text: string): string {
    return text
      .replace(/\r\n/g, '\n') // Normalize line endings
      .replace(/\n{3,}/g, '\n\n') // Max 2 consecutive newlines
      .replace(/[ \t]{2,}/g, ' ') // Replace multiple spaces/tabs with single space
      .trim() // Remove leading/trailing whitespace
  }

  /**
   * Count words in text
   */
  private countWords(text: string): number {
    // Split by whitespace and filter empty strings
    const words = text.split(/\s+/).filter((word) => word.length > 0)
    return words.length
  }
}
