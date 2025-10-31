/**
 * Preload Script
 *
 * This script runs BEFORE the renderer process loads.
 * It's the ONLY place where we can safely expose Node.js APIs to the renderer.
 *
 * Think of it as a controlled API gateway:
 * - Renderer can ONLY access what we explicitly expose here
 * - Provides security by limiting what the web UI can do
 */

import { contextBridge, ipcRenderer } from 'electron'

/**
 * API exposed to renderer process
 * Accessible in renderer as: window.electron
 */
const electronAPI = {
  // Platform info
  platform: process.platform,

  // Example: Send message to main process
  sendMessage: (channel: string, data: unknown) => {
    // Whitelist of allowed channels for security
    const validChannels = ['toMain']
    if (validChannels.includes(channel)) {
      ipcRenderer.send(channel, data)
    }
  },

  // Example: Receive message from main process
  onMessage: (channel: string, callback: (data: unknown) => void) => {
    const validChannels = ['fromMain']
    if (validChannels.includes(channel)) {
      // Remove listener when component unmounts
      ipcRenderer.on(channel, (_, data) => callback(data))
    }
  },

  // File operations
  openFileDialog: () => {
    return ipcRenderer.invoke('open-file-dialog')
  },

  extractFileText: (filePath: string) => {
    return ipcRenderer.invoke('extract-file-text', filePath)
  },
}

// Expose the API to renderer
contextBridge.exposeInMainWorld('electron', electronAPI)

// Type declaration for TypeScript (we'll create this file next)
export type ElectronAPI = typeof electronAPI
