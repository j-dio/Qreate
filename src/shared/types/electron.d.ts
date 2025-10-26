/**
 * TypeScript Type Declarations for Electron API
 *
 * This file tells TypeScript about the custom APIs we've exposed
 * on the window object via the preload script.
 *
 * The .d.ts extension means "declaration file" - it only contains types, no runtime code.
 */

import type { ElectronAPI } from '../../preload/index'

/**
 * Extend the global Window interface
 * This makes TypeScript aware of window.electron
 */
declare global {
  interface Window {
    electron: ElectronAPI
  }
}

// This export makes it a module (required for declaration merging)
export {}
