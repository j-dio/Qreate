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
 */

import { app, BrowserWindow } from 'electron'
import path from 'path'

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

// When Electron is ready, create window
app.whenReady().then(() => {
  createWindow()

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
