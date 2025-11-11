/**
 * Electron Main Process
 *
 * This is the entry point for the Electron main process.
 * It runs in Node.js and has access to system APIs.
 *
 * Responsibilities:
 * - Create and manage application windows
 * - Handle system tray, menus, notifications
 * - Provide secure API access to renderer process
 * - Handle IPC communication with renderer
 */

// Load environment variables first (before any other imports)
import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron'
import path from 'path'
import * as fs from 'fs/promises'
import { FileTextExtractor } from './services/FileTextExtractor'
import { GoogleDriveService } from './services/GoogleDriveService'
import { PDFGenerator } from './services/PDFGenerator'
import { GroqProvider } from './services/GroqProvider'
import { RateLimiter } from './services/RateLimiter'
import { DatabaseService } from './services/DatabaseService'
import { UsageTrackingService } from './services/UsageTrackingService'
import { ExamQualityValidator } from './services/ExamQualityValidator'
import { ExamParser } from '../shared/services/ExamParser'
import { AuthService } from './services/AuthService'

// Global reference to prevent garbage collection
let mainWindow: BrowserWindow | null = null

/**
 * Creates the main application window
 */
function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      // Enable Node.js integration in renderer (we'll secure this later with context isolation)
      nodeIntegration: false,
      // Enable context isolation for security
      contextIsolation: true,
      // Preload script path
      preload: path.join(__dirname, '../preload/index.js'),
    },
    // Optional: Hide window until ready to show (prevents flash)
    show: false,
  })

  // Show window when ready
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
  })

  // In development, load from Vite dev server
  // In production, load from built files
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173')
    // Open DevTools in development
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'))
  }

  // Handle window close
  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

/**
 * App Event Handlers
 */

// When Electron is ready, create window and register IPC handlers
app.whenReady().then(() => {
  createWindow()
  registerIpcHandlers()

  // On macOS, re-create window when dock icon is clicked
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

// Quit when all windows are closed (except on macOS)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// Security: Prevent navigation to external sites
app.on('web-contents-created', (_, contents) => {
  contents.on('will-navigate', (event, navigationUrl) => {
    const parsedUrl = new URL(navigationUrl)

    // Only allow local navigation
    if (parsedUrl.origin !== 'http://localhost:5173' && parsedUrl.origin !== 'file://') {
      event.preventDefault()
    }
  })
})

/**
 * IPC Handlers
 *
 * Register handlers for communication between renderer and main process.
 */
function registerIpcHandlers(): void {
  // Initialize services
  const fileTextExtractor = new FileTextExtractor()
  const googleDriveService = new GoogleDriveService()
  const pdfGenerator = new PDFGenerator()

  // Initialize database and usage tracking
  const databaseService = new DatabaseService()
  const usageTrackingService = new UsageTrackingService(databaseService)
  const authService = new AuthService(databaseService)

  // Authentication system is now complete - real users will register through the UI

  // Initialize Groq provider (backend-managed)
  let groqProvider: GroqProvider | null = null
  const rateLimiter = new RateLimiter() // Global rate limiter instance

  try {
    const groqApiKey = process.env.GROQ_API_KEY
    if (groqApiKey) {
      groqProvider = new GroqProvider(groqApiKey)
      console.log('[Groq] Provider initialized successfully')
    } else {
      console.warn('[Groq] API key not found in environment variables')
    }
  } catch (error) {
    console.error('[Groq] Failed to initialize provider:', error)
  }

  /**
   * Open file dialog for selecting files
   *
   * Returns file metadata including absolute paths.
   * Only accepts .txt and .docx files.
   */
  ipcMain.handle('open-file-dialog', async () => {
    const result = await dialog.showOpenDialog(mainWindow!, {
      properties: ['openFile', 'multiSelections'],
      filters: [
        { name: 'Supported Files', extensions: ['txt', 'docx'] },
        { name: 'Text Files', extensions: ['txt'] },
        { name: 'Word Documents', extensions: ['docx'] },
      ],
    })

    if (result.canceled) {
      return { canceled: true, files: [] }
    }

    // Get file stats for each selected file
    const fileStats = await Promise.all(
      result.filePaths.map(async filePath => {
        const stats = await fs.stat(filePath)
        const ext = path.extname(filePath).toLowerCase()

        // Determine MIME type based on extension
        let mimeType = 'application/octet-stream'
        if (ext === '.txt') {
          mimeType = 'text/plain'
        } else if (ext === '.docx') {
          mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        }

        return {
          path: filePath,
          name: path.basename(filePath),
          size: stats.size,
          type: mimeType,
        }
      })
    )

    return { canceled: false, files: fileStats }
  })

  /**
   * Extract text from file
   *
   * Usage from renderer:
   * const result = await window.electron.extractFileText(filePath)
   */
  ipcMain.handle('extract-file-text', async (_, filePath: string) => {
    console.log('[IPC] Extract text request for:', filePath)
    const result = await fileTextExtractor.extractText(filePath)
    console.log('[IPC] Extraction result:', {
      success: result.success,
      textLength: result.text?.length || 0,
      error: result.error,
    })
    return result
  })

  /**
   * Google Drive: Check if authenticated
   */
  ipcMain.handle('google-drive-check-auth', async () => {
    console.log('[IPC] Check Google Drive auth status')
    return googleDriveService.isAuthenticated()
  })

  /**
   * Google Drive: Get OAuth URL
   *
   * Returns the URL to open in browser for authentication.
   */
  ipcMain.handle('google-drive-get-auth-url', async () => {
    console.log('[IPC] Get Google Drive auth URL')
    try {
      const url = await googleDriveService.getAuthUrl()
      return { success: true, url }
    } catch (error) {
      console.error('[IPC] Failed to get auth URL:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get auth URL',
      }
    }
  })

  /**
   * Google Drive: Authenticate with authorization code
   *
   * After user grants permission in browser, complete the OAuth flow.
   */
  ipcMain.handle('google-drive-authenticate', async (_, code: string) => {
    console.log('[IPC] Authenticate Google Drive with code')
    try {
      await googleDriveService.authenticateWithCode(code)
      return { success: true }
    } catch (error) {
      console.error('[IPC] Authentication failed:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Authentication failed',
      }
    }
  })

  /**
   * Google Drive: Get user's email
   */
  ipcMain.handle('google-drive-get-user-email', async () => {
    console.log('[IPC] Get Google Drive user email')
    try {
      const email = await googleDriveService.getUserEmail()
      return { success: true, email }
    } catch (error) {
      console.error('[IPC] Failed to get user email:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get user email',
      }
    }
  })

  /**
   * Google Drive: Disconnect
   */
  ipcMain.handle('google-drive-disconnect', async () => {
    console.log('[IPC] Disconnect Google Drive')
    try {
      googleDriveService.disconnect()
      return { success: true }
    } catch (error) {
      console.error('[IPC] Disconnect failed:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Disconnect failed',
      }
    }
  })

  /**
   * Google Drive: Create document
   *
   * @param title - Document title
   * @param content - Formatted content (Google Docs API requests)
   */
  ipcMain.handle('google-drive-create-document', async (_, title: string, content: any) => {
    console.log('[IPC] Create Google Doc:', title)
    try {
      const documentId = await googleDriveService.createDocument(title, content)
      const url = googleDriveService.getDocumentUrl(documentId)
      return { success: true, documentId, url }
    } catch (error) {
      console.error('[IPC] Failed to create document:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create document',
      }
    }
  })

  /**
   * Google Drive: Export to PDF
   *
   * @param documentId - Google Doc ID
   * @param outputPath - Local file path to save PDF
   */
  ipcMain.handle('google-drive-export-pdf', async (_, documentId: string, outputPath: string) => {
    console.log('[IPC] Export PDF:', documentId, '->', outputPath)
    try {
      await googleDriveService.exportToPDF(documentId, outputPath)
      return { success: true, path: outputPath }
    } catch (error) {
      console.error('[IPC] Failed to export PDF:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to export PDF',
      }
    }
  })

  /**
   * Open URL in default browser
   *
   * Used for opening OAuth URL and Google Docs links.
   */
  ipcMain.handle('open-external-url', async (_, url: string) => {
    console.log('[IPC] Open external URL:', url)
    await shell.openExternal(url)
    return { success: true }
  })

  /**
   * Generate PDF from exam data
   *
   * @param examData - Generated exam object
   * @param outputPath - Relative or absolute path to save PDF
   */
  ipcMain.handle('generate-exam-pdf', async (_, examData: any, outputPath: string) => {
    console.log('[IPC] Generate exam PDF:', outputPath)
    try {
      // Convert relative path to absolute if needed
      const absolutePath = path.isAbsolute(outputPath)
        ? outputPath
        : path.join(process.cwd(), outputPath)

      await pdfGenerator.generateExamPDF(examData, absolutePath)
      return { success: true, path: absolutePath }
    } catch (error) {
      console.error('[IPC] Failed to generate PDF:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to generate PDF',
      }
    }
  })

  /**
   * Groq: Test connection
   *
   * Verifies Groq API is working (backend-managed, no API key needed from user)
   */
  ipcMain.handle('groq-test-connection', async () => {
    console.log('[IPC] Test Groq connection')
    if (!groqProvider) {
      return {
        success: false,
        message: 'Groq provider not initialized',
        details: 'Please set GROQ_API_KEY in .env.local',
      }
    }

    try {
      return await groqProvider.testConnection()
    } catch (error) {
      console.error('[IPC] Groq connection test failed:', error)
      return {
        success: false,
        message: 'Connection test failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  })

  /**
   * Groq: Get usage status
   *
   * Returns current usage stats for the authenticated user (quotas, remaining, reset times)
   *
   * @param userId - User ID (required)
   * @returns Usage status with quotas and stats
   */
  ipcMain.handle('groq-get-usage-status', async (_, userId: number) => {
    console.log('[IPC] Get usage status for user:', userId)

    if (!userId) {
      return {
        success: false,
        error: 'User ID is required. Please log in.',
      }
    }

    try {
      const status = usageTrackingService.getUsageStatus(userId)
      return {
        success: true,
        ...status,
      }
    } catch (error) {
      console.error('[IPC] Failed to get usage status:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get usage status',
      }
    }
  })

  /**
   * Groq: Generate exam
   *
   * Backend-managed exam generation using Groq API.
   * No API key required from user - handled server-side.
   *
   * Features:
   * - Per-user quotas (10/day, 100/month)
   * - Global rate limiting (30 req/min, 14.4k req/day)
   * - Retry logic with exponential backoff
   * - Usage tracking in SQLite database
   *
   * @param config - Exam configuration (types, difficulty, etc.)
   * @param sourceText - Extracted text from uploaded files
   * @param userId - User ID (required)
   * @returns Generated exam content
   */
  ipcMain.handle(
    'groq-generate-exam',
    async (_, config: any, sourceText: string, userId: number) => {
      console.log('[IPC] Generate exam with Groq:', {
        userId,
        totalQuestions: config.totalQuestions,
        sourceTextLength: sourceText.length,
      })

      if (!userId) {
        return {
          success: false,
          error: 'User ID is required. Please log in.',
        }
      }

      if (!groqProvider) {
        return {
          success: false,
          error: 'Groq provider not initialized. Please contact support.',
        }
      }

      // Check user quotas first
      const usageCheck = usageTrackingService.checkUsage(userId, config.totalQuestions)
      if (!usageCheck.canGenerate) {
        console.warn('[UsageTracking] Request blocked:', usageCheck.reason)
        return {
          success: false,
          error: usageCheck.reason,
          usageStatus: usageCheck,
        }
      }

      // Check global rate limits
      const rateLimitCheck = rateLimiter.canMakeRequest()
      if (!rateLimitCheck.allowed) {
        console.warn('[RateLimiter] Request blocked:', rateLimitCheck.reason)
        return {
          success: false,
          error: rateLimitCheck.reason,
        }
      }

      try {
        const examContent = await groqProvider.generateExam(config, sourceText)

        // Parse the exam content into structured format
        console.log('[IPC] Parsing generated exam content...')
        const examParser = new ExamParser()
        const questions = examParser.parseExam(examContent)

        // Create exam object for validation
        const exam = {
          id: `exam-${Date.now()}-${userId}`,
          topic: 'Generated Exam', // TODO: Extract from content
          questions,
          createdAt: new Date(),
          totalQuestions: questions.length,
          metadata: {
            sourceFiles: [], // Will be populated by renderer
            aiProvider: 'groq',
            generationTime: 0,
          },
        }

        // Perform quality validation
        console.log('[IPC] Performing quality validation...')
        const qualityValidator = new ExamQualityValidator(sourceText, {
          minimumQualityScore: 0.7, // 70% quality threshold
          retryOnLowQuality: false, // Don't auto-retry in main process
        })

        const validationResult = await qualityValidator.validateExam(exam)

        console.log('[IPC] Quality validation complete:', {
          valid: validationResult.isValid,
          score: validationResult.overallQualityScore.toFixed(3),
          duplicates: validationResult.duplicatesFound,
          sourceIssues: validationResult.sourceIssues,
        })

        // Record successful request for rate limiting
        rateLimiter.recordRequest()

        // Record exam generation for user quota tracking
        usageTrackingService.recordExamGeneration(userId)

        // Get updated usage status
        const updatedUsage = usageTrackingService.getUsageStatus(userId)

        return {
          success: true,
          content: examContent,
          exam: exam, // Include structured exam data
          qualityMetrics: {
            score: validationResult.overallQualityScore,
            isValid: validationResult.isValid,
            metrics: validationResult.metrics,
            duplicatesFound: validationResult.duplicatesFound,
            sourceIssues: validationResult.sourceIssues,
            difficultyIssues: validationResult.difficultyIssues,
            recommendations: validationResult.recommendations,
          },
          usageStatus: updatedUsage,
        }
      } catch (error) {
        console.error('[IPC] Groq exam generation failed:', error)
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to generate exam',
        }
      }
    }
  )

  /**
   * Authentication: Register new user
   *
   * @param name - User's full name
   * @param email - User's email address
   * @param password - User's password (will be hashed)
   * @returns Authentication response with user data and session token
   */
  ipcMain.handle('auth-register', async (_, name: string, email: string, password: string) => {
    console.log('[IPC] User registration request for email:', email)
    
    try {
      const result = await authService.register({ name, email, password })
      
      if (result.success) {
        console.log('[IPC] User registered successfully:', result.user?.id)
      } else {
        console.log('[IPC] Registration failed:', result.error)
      }
      
      return result
    } catch (error) {
      console.error('[IPC] Registration error:', error)
      return {
        success: false,
        error: 'Registration failed. Please try again.',
      }
    }
  })

  /**
   * Authentication: Login existing user
   *
   * @param email - User's email address
   * @param password - User's password
   * @returns Authentication response with user data and session token
   */
  ipcMain.handle('auth-login', async (_, email: string, password: string) => {
    console.log('[IPC] User login request for email:', email)
    
    try {
      const result = await authService.login({ email, password })
      
      if (result.success) {
        console.log('[IPC] User logged in successfully:', result.user?.id)
      } else {
        console.log('[IPC] Login failed:', result.error)
      }
      
      return result
    } catch (error) {
      console.error('[IPC] Login error:', error)
      return {
        success: false,
        error: 'Login failed. Please try again.',
      }
    }
  })

  /**
   * Authentication: Logout user
   *
   * @param sessionToken - Session token to invalidate
   * @returns Success status
   */
  ipcMain.handle('auth-logout', async (_, sessionToken: string) => {
    console.log('[IPC] User logout request')
    
    try {
      authService.logout(sessionToken)
      console.log('[IPC] User logged out successfully')
      return { success: true }
    } catch (error) {
      console.error('[IPC] Logout error:', error)
      return { success: false, error: 'Logout failed' }
    }
  })

  /**
   * Authentication: Validate session
   *
   * @param sessionToken - Session token to validate
   * @returns Session validation result with user data
   */
  ipcMain.handle('auth-validate-session', async (_, sessionToken: string) => {
    const validation = authService.validateSession(sessionToken)
    
    if (validation.valid && validation.userId) {
      const userData = authService.getUserBySession(sessionToken)
      return {
        success: true,
        valid: true,
        user: userData,
      }
    }
    
    return {
      success: true,
      valid: false,
      error: validation.error,
    }
  })

  /**
   * Get exam history for authenticated user
   *
   * @param sessionToken - Session token for authentication
   * @param limit - Maximum number of exams to return (default: 50)
   * @returns Array of user's exam history
   */
  ipcMain.handle('get-exam-history', async (_, sessionToken: string, limit: number = 50) => {
    console.log('[IPC] Get exam history request')
    
    try {
      // Validate session
      const validation = authService.validateSession(sessionToken)
      
      if (!validation.valid || !validation.userId) {
        return {
          success: false,
          error: 'Invalid session. Please log in again.',
        }
      }
      
      // Get exam history from database
      const examHistory = databaseService.getExamHistory(validation.userId, limit)
      
      console.log('[IPC] Retrieved', examHistory.length, 'exam records for user:', validation.userId)
      
      return {
        success: true,
        exams: examHistory,
      }
    } catch (error) {
      console.error('[IPC] Get exam history error:', error)
      return {
        success: false,
        error: 'Failed to retrieve exam history.',
      }
    }
  })

  /**
   * Save exam to history
   *
   * @param sessionToken - Session token for authentication
   * @param userId - User ID from frontend
   * @param examData - Exam metadata (title, topic, etc.)
   * @param pdfPath - Path to generated PDF file
   * @returns Success status with exam ID
   */
  ipcMain.handle('save-exam-to-history', async (_, sessionToken: string, userId: number, examData: { title: string, topic: string, totalQuestions: number }, pdfPath: string) => {
    console.log('[IPC] Save exam to history request for user:', userId, 'with session token:', sessionToken ? 'present' : 'missing')
    
    try {
      // Validate that the user exists in the database
      const validation = authService.validateUserExists(userId)
      console.log('[IPC] User validation result:', validation)
      
      if (!validation.valid || !validation.userId) {
        console.log('[IPC] User validation failed, reason:', validation.error)
        return {
          success: false,
          error: 'Invalid user. Please log in again.',
        }
      }
      
      // Save exam to database
      const examId = databaseService.saveExam(
        validation.userId,
        examData.title,
        examData.topic,
        examData.totalQuestions,
        pdfPath
      )
      
      console.log('[IPC] Exam saved to history with ID:', examId)
      
      return {
        success: true,
        examId: examId,
      }
    } catch (error) {
      console.error('[IPC] Save exam to history error:', error)
      return {
        success: false,
        error: 'Failed to save exam to history.',
      }
    }
  })

  console.log('[IPC] Handlers registered successfully')
}
