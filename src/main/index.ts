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

import { app, BrowserWindow, ipcMain, dialog } from 'electron'
import path from 'path'
import * as fs from 'fs/promises'
import { FileTextExtractor } from './services/FileTextExtractor'

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
  // Initialize file text extractor
  const fileTextExtractor = new FileTextExtractor()

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

  console.log('[IPC] Handlers registered successfully')
}
