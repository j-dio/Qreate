/**
 * File Upload Store (Zustand)
 *
 * Manages the state for the exam creation workflow, specifically file uploads.
 *
 * Why a separate store from useAppStore?
 * - Separation of concerns: This handles temporary workflow state
 * - useAppStore handles persistent app-wide state (user, projects, settings)
 * - This store manages the multi-step exam creation process
 * - Once exam is created, final data moves to useAppStore's projects
 *
 * State Flow:
 * 1. User uploads files → stored in uploadedFiles[]
 * 2. Files are validated → validation errors tracked
 * 3. User configures exam → stored in examConfig
 * 4. Exam is generated → becomes a Project in useAppStore
 * 5. This store resets for next exam
 */

import { create } from 'zustand'

/**
 * Uploaded File interface
 * Represents a file uploaded by the user for exam generation
 *
 * Properties explained:
 * - id: Unique identifier (using timestamp + random for uniqueness)
 * - file: The actual File object from the browser
 * - name: Original filename
 * - size: File size in bytes
 * - type: MIME type (e.g., 'text/plain', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
 * - path: Absolute file path (for Electron file access)
 * - status: Current processing state
 * - error: Error message if validation/processing fails
 * - extractedText: Text content extracted from the file (populated later)
 */
export interface UploadedFile {
  id: string
  file: File
  name: string
  size: number
  type: string
  path?: string // Added for Electron file access
  isDragAndDrop?: boolean // Marks files from drag-and-drop (no path available)
  originalFile?: File // Store original File object for drag-and-drop files
  status: 'pending' | 'validating' | 'valid' | 'invalid' | 'extracting' | 'ready'
  error?: string
  extractedText?: string
}

/**
 * Validation constraints
 * These enforce the requirements from CLAUDE.md
 *
 * UPDATED: Only .txt and .docx files supported
 * - PDF support disabled (text extraction issues)
 * - Legacy .doc format not supported (convert to .docx)
 * - Images not yet supported (OCR planned for future)
 */
export const VALIDATION_RULES = {
  MAX_FILES: 5, // Maximum number of files
  MAX_FILE_SIZE: 50 * 1024 * 1024, // 50MB per file in bytes
  MAX_TOTAL_SIZE: 200 * 1024 * 1024, // 200MB total in bytes
  ALLOWED_TYPES: {
    // Only text and modern Word documents
    'text/plain': ['txt'],
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['docx'],
  } as const,
}

/**
 * File Upload Store State
 */
interface FileUploadState {
  // State
  uploadedFiles: UploadedFile[]
  isDragging: boolean // Track drag-over state for UI feedback
  totalSize: number // Running total of all file sizes

  // Actions
  addFiles: (files: File[]) => void
  removeFile: (id: string) => void
  updateFileStatus: (id: string, status: UploadedFile['status'], error?: string) => void
  clearAllFiles: () => void
  setIsDragging: (isDragging: boolean) => void

  // Computed helpers
  getFileById: (id: string) => UploadedFile | undefined
  canAddFiles: (fileCount: number) => boolean
  getRemainingFileSlots: () => number
}

/**
 * Create the File Upload Store
 *
 * Note: We're NOT using persist() middleware here because:
 * - This is temporary workflow state, not permanent data
 * - File objects can't be serialized to localStorage
 * - State should reset between exam creation sessions
 */
export const useFileUploadStore = create<FileUploadState>((set, get) => ({
  // Initial state
  uploadedFiles: [],
  isDragging: false,
  totalSize: 0,

  /**
   * Add files to the upload queue
   *
   * Process:
   * 1. Generate unique ID for each file
   * 2. Calculate total size
   * 3. Add to state with 'pending' status
   * 4. Preserve file path if available (from Electron file dialog)
   * 5. Files will be validated in the component
   */
  addFiles: files =>
    set(state => {
      // Create UploadedFile objects with unique IDs
      const newFiles: UploadedFile[] = files.map(file => ({
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        file,
        name: file.name,
        size: file.size,
        type: file.type,
        path: (file as any).path, // Preserve path from Electron file dialog
        isDragAndDrop: (file as any).isDragAndDrop, // Preserve drag-and-drop marker
        originalFile: (file as any)._originalFile, // Preserve original File object for drag-and-drop
        status: 'pending',
      }))

      console.log(
        '[FileUploadStore] Adding files:',
        newFiles.map(f => ({
          name: f.name,
          hasPath: !!f.path,
          path: f.path,
          isDragAndDrop: f.isDragAndDrop,
          hasOriginalFile: !!f.originalFile,
        }))
      )

      // Calculate new total size
      const newTotalSize = state.totalSize + newFiles.reduce((sum, f) => sum + f.size, 0)

      return {
        uploadedFiles: [...state.uploadedFiles, ...newFiles],
        totalSize: newTotalSize,
      }
    }),

  /**
   * Remove a file from the upload queue
   *
   * Also updates the total size by subtracting the removed file's size
   */
  removeFile: id =>
    set(state => {
      const fileToRemove = state.uploadedFiles.find(f => f.id === id)
      if (!fileToRemove) return state

      return {
        uploadedFiles: state.uploadedFiles.filter(f => f.id !== id),
        totalSize: state.totalSize - fileToRemove.size,
      }
    }),

  /**
   * Update a file's status
   *
   * Used during validation and text extraction:
   * pending → validating → valid/invalid
   * valid → extracting → ready
   */
  updateFileStatus: (id, status, error) =>
    set(state => ({
      uploadedFiles: state.uploadedFiles.map(f =>
        f.id === id
          ? {
              ...f,
              status,
              error,
            }
          : f
      ),
    })),

  /**
   * Clear all files and reset state
   *
   * Called when:
   * - User cancels the workflow
   * - Exam is successfully created
   * - User wants to start over
   */
  clearAllFiles: () =>
    set({
      uploadedFiles: [],
      totalSize: 0,
      isDragging: false,
    }),

  /**
   * Set drag state for UI feedback
   *
   * Shows visual feedback when user drags files over the drop zone
   */
  setIsDragging: isDragging => set({ isDragging }),

  /**
   * Helper: Get a specific file by ID
   */
  getFileById: id => get().uploadedFiles.find(f => f.id === id),

  /**
   * Helper: Check if we can add more files
   *
   * Validates against MAX_FILES limit
   */
  canAddFiles: fileCount => {
    const currentCount = get().uploadedFiles.length
    return currentCount + fileCount <= VALIDATION_RULES.MAX_FILES
  },

  /**
   * Helper: Get remaining file slots
   */
  getRemainingFileSlots: () => {
    return VALIDATION_RULES.MAX_FILES - get().uploadedFiles.length
  },
}))
