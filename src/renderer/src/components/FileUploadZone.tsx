/**
 * File Upload Zone Component
 *
 * A drag-and-drop file upload interface with click-to-browse fallback.
 *
 * Features:
 * - Drag and drop files
 * - Click to browse files
 * - Visual feedback during drag
 * - Real-time validation with error messages
 * - Shows upload constraints and rules
 * - Prevents invalid file uploads
 *
 * User Experience Flow:
 * 1. User sees a clear upload zone with instructions
 * 2. User can drag files OR click to browse
 * 3. Visual feedback shows when files are being dragged over
 * 4. Validation happens immediately
 * 5. Clear error messages if validation fails
 * 6. Success feedback if files are accepted
 */

import { useCallback, useState, useEffect } from 'react'
import { Upload, AlertCircle, CheckCircle2, FileText } from 'lucide-react'
import { useFileUploadStore } from '../store/useFileUploadStore'
import { validateFiles, getValidationRulesSummary } from '../utils/fileValidation'
import { Card, CardContent } from './ui/Card'
import { Button } from './ui/Button'

export function FileUploadZone() {
  // Store state
  const { uploadedFiles, totalSize, isDragging, addFiles, setIsDragging, updateFileStatus } =
    useFileUploadStore()

  // Local state
  const [validationError, setValidationError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  // Get validation rules for display
  const rules = getValidationRulesSummary()

  /**
   * Auto-validate pending files
   *
   * This effect automatically updates files from "pending" to "valid" status.
   * In production, this is where we would:
   * 1. Extract text from PDFs (pdf-parse)
   * 2. Extract text from DOCX (mammoth)
   * 3. Run OCR on images (Tesseract)
   *
   * For now, we simulate validation with a short delay.
   *
   * Why useEffect?
   * - Runs after files are added to the store
   * - Automatically processes new files
   * - Keeps component logic separate from store logic
   */
  useEffect(() => {
    // Find all pending files
    const pendingFiles = uploadedFiles.filter(f => f.status === 'pending')

    if (pendingFiles.length === 0) return

    // Simulate validation for each pending file
    pendingFiles.forEach(file => {
      // Update to "validating" status first
      updateFileStatus(file.id, 'validating')

      // After a short delay, mark as "valid"
      // In production, this would be replaced with actual file processing
      setTimeout(() => {
        updateFileStatus(file.id, 'valid')
      }, 500) // 500ms delay to show validation is happening
    })
  }, [uploadedFiles, updateFileStatus])

  /**
   * Handle file selection (from drag-drop or file browser)
   *
   * Process:
   * 1. Clear previous messages
   * 2. Validate files
   * 3. If valid, add to store
   * 4. If invalid, show error
   *
   * useCallback optimization:
   * - Prevents unnecessary re-renders
   * - Memoizes the function so it's not recreated on every render
   * - Only recreates if dependencies change
   */
  const handleFiles = useCallback(
    (files: FileList | null) => {
      // Clear previous messages
      setValidationError(null)
      setSuccessMessage(null)

      if (!files || files.length === 0) return

      // Convert FileList to Array for easier handling
      const fileArray = Array.from(files)

      // Validate files
      const validation = validateFiles(fileArray, uploadedFiles.length, totalSize)

      if (!validation.isValid) {
        // Show error message
        setValidationError(validation.error || 'Invalid files')
        return
      }

      // Files are valid, add them to store
      addFiles(fileArray)

      // Show success message
      const fileWord = fileArray.length === 1 ? 'file' : 'files'
      setSuccessMessage(`Successfully added ${fileArray.length} ${fileWord}`)

      // Clear success message after 3 seconds
      setTimeout(() => setSuccessMessage(null), 3000)
    },
    [uploadedFiles.length, totalSize, addFiles]
  )

  /**
   * Handle drag over event
   *
   * Important: preventDefault() is required to allow drop
   * Without it, the browser would try to open the file instead
   */
  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  /**
   * Handle drag enter event
   *
   * Shows visual feedback that files are being dragged over the zone
   */
  const handleDragEnter = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      e.stopPropagation()
      setIsDragging(true)
    },
    [setIsDragging]
  )

  /**
   * Handle drag leave event
   *
   * Removes visual feedback when drag leaves the zone
   *
   * Note: We check if we're actually leaving the drop zone
   * (not just moving between child elements)
   */
  const handleDragLeave = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      e.stopPropagation()

      // Only set isDragging to false if we're leaving the actual drop zone
      // (not just moving between child elements)
      const rect = e.currentTarget.getBoundingClientRect()
      const x = e.clientX
      const y = e.clientY

      if (x <= rect.left || x >= rect.right || y <= rect.top || y >= rect.bottom) {
        setIsDragging(false)
      }
    },
    [setIsDragging]
  )

  /**
   * Handle drop event
   *
   * Processes the dropped files
   */
  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      e.stopPropagation()
      setIsDragging(false)

      // Get files from the drag event
      const files = e.dataTransfer.files
      handleFiles(files)
    },
    [setIsDragging, handleFiles]
  )

  /**
   * Handle click to browse files
   *
   * Uses Electron's native file dialog to get actual file paths.
   * This is necessary because HTML file inputs don't expose file paths for security.
   */
  const handleClick = useCallback(async () => {
    // Clear previous messages
    setValidationError(null)
    setSuccessMessage(null)

    try {
      // Open Electron file dialog
      const result = await window.electron.openFileDialog()

      if (result.canceled || result.files.length === 0) {
        return
      }

      // Create File-like objects with path property
      const fileArray = result.files.map((fileInfo: any) => {
        // Create a pseudo-File object that has the necessary properties
        const file = {
          name: fileInfo.name,
          size: fileInfo.size,
          type: fileInfo.type,
          path: fileInfo.path, // This is the key property we need!
          lastModified: Date.now(),
        } as File & { path: string }

        return file
      })

      // Validate files
      const validation = validateFiles(fileArray, uploadedFiles.length, totalSize)

      if (!validation.isValid) {
        setValidationError(validation.error || 'Invalid files')
        return
      }

      // Files are valid, add them to store
      addFiles(fileArray)

      // Show success message
      const fileWord = fileArray.length === 1 ? 'file' : 'files'
      setSuccessMessage(`Successfully added ${fileArray.length} ${fileWord}`)

      // Clear success message after 3 seconds
      setTimeout(() => setSuccessMessage(null), 3000)
    } catch (error) {
      setValidationError(error instanceof Error ? error.message : 'Failed to select files')
    }
  }, [uploadedFiles.length, totalSize, addFiles])

  return (
    <div className="space-y-4">
      {/* Upload Zone */}
      <Card
        className={`border-2 border-dashed transition-all cursor-pointer ${
          isDragging
            ? 'border-blue-500 bg-blue-50'
            : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
        }`}
        onDragOver={handleDragOver}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleClick}
      >
        <CardContent className="flex flex-col items-center justify-center py-12 px-6">
          {/* Icon */}
          <div
            className={`rounded-full p-4 mb-4 transition-colors ${
              isDragging ? 'bg-blue-100' : 'bg-gray-100'
            }`}
          >
            <Upload
              className={`h-8 w-8 transition-colors ${
                isDragging ? 'text-blue-600' : 'text-gray-600'
              }`}
            />
          </div>

          {/* Instructions */}
          <h3 className="text-lg font-semibold mb-2">
            {isDragging ? 'Drop files here' : 'Upload study materials'}
          </h3>
          <p className="text-sm text-muted-foreground text-center mb-4">
            Drag and drop files here, or click to browse
          </p>

          {/* Browse Button (only show when not dragging) */}
          {!isDragging && (
            <Button variant="outline" type="button" className="mb-4">
              Browse Files
            </Button>
          )}

          {/* Validation Rules */}
          <div className="text-xs text-muted-foreground text-center space-y-1">
            <p>Allowed types: {rules.allowedTypes}</p>
            <p>
              Max {rules.maxFiles} files • {rules.maxFileSize} per file • {rules.maxTotalSize} total
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Validation Error Message */}
      {validationError && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="flex items-start gap-3 p-4">
            <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="text-sm font-semibold text-red-900">Upload Error</h4>
              <p className="text-sm text-red-700">{validationError}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Success Message */}
      {successMessage && (
        <Card className="border-green-200 bg-green-50">
          <CardContent className="flex items-center gap-3 p-4">
            <CheckCircle2 className="h-5 w-5 text-green-600" />
            <p className="text-sm font-medium text-green-900">{successMessage}</p>
          </CardContent>
        </Card>
      )}

      {/* Upload Summary */}
      {uploadedFiles.length > 0 && (
        <Card>
          <CardContent className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <FileText className="h-5 w-5 text-gray-600" />
              <div>
                <p className="text-sm font-medium">
                  {uploadedFiles.length} / {rules.maxFiles} files selected
                </p>
                <p className="text-xs text-muted-foreground">
                  Total size: {(totalSize / (1024 * 1024)).toFixed(2)} MB / 200 MB
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
