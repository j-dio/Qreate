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

import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron'
import path from 'path'
import * as fs from 'fs/promises'
import { FileTextExtractor } from './services/FileTextExtractor'
import { GoogleDriveService } from './services/GoogleDriveService'

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
      result.filePaths.map(async (filePath) => {
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

  console.log('[IPC] Handlers registered successfully')
}
