/**
 * File List Component
 *
 * Displays uploaded files with management actions.
 *
 * Features:
 * - Shows file details (name, size, type)
 * - Visual status indicators (pending, valid, invalid, extracting)
 * - Remove file action
 * - File type icons
 * - Error messages for invalid files
 * - Progress states for processing
 *
 * Design Philosophy:
 * - Clear visual hierarchy
 * - Immediate feedback on file status
 * - Easy file management (one-click remove)
 * - Accessible and user-friendly
 */

import { FileText, Image, FileType, X, Loader2, CheckCircle2, XCircle, Clock } from 'lucide-react'
import { useFileUploadStore, type UploadedFile } from '../store/useFileUploadStore'
import { formatBytes } from '../utils/fileValidation'
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card'
import { Button } from './ui/Button'

/**
 * Get icon for file type
 *
 * Why file type icons?
 * - Visual recognition is faster than reading extensions
 * - Makes the UI more intuitive and professional
 * - Users can quickly identify file types at a glance
 */
function getFileIcon(file: UploadedFile) {
  const type = file.type.toLowerCase()

  // Document types (PDF, DOCX, DOC, TXT)
  if (
    type.includes('pdf') ||
    type.includes('word') ||
    type.includes('document') ||
    type.includes('text')
  ) {
    return <FileText className="h-5 w-5" />
  }

  // Image types (PNG, JPG)
  if (type.includes('image')) {
    return <Image className="h-5 w-5" />
  }

  // Fallback
  return <FileType className="h-5 w-5" />
}

/**
 * Get status badge for file
 *
 * Status States Explained:
 * - pending: Just uploaded, not yet validated
 * - validating: Currently being checked
 * - valid: Passed validation, ready for text extraction
 * - invalid: Failed validation, shows error
 * - extracting: Text is being extracted from the file
 * - ready: Text extracted, ready for exam generation
 *
 * Visual Design:
 * - Each status has a distinct color and icon
 * - Loading spinners for active states
 * - Clear success/error indicators
 */
function getStatusBadge(file: UploadedFile) {
  switch (file.status) {
    case 'pending':
      return (
        <div className="flex items-center gap-2 text-gray-600">
          <Clock className="h-4 w-4" />
          <span className="text-xs font-medium">Pending</span>
        </div>
      )

    case 'validating':
      return (
        <div className="flex items-center gap-2 text-blue-600">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-xs font-medium">Validating...</span>
        </div>
      )

    case 'valid':
      return (
        <div className="flex items-center gap-2 text-green-600">
          <CheckCircle2 className="h-4 w-4" />
          <span className="text-xs font-medium">Valid</span>
        </div>
      )

    case 'invalid':
      return (
        <div className="flex items-center gap-2 text-red-600">
          <XCircle className="h-4 w-4" />
          <span className="text-xs font-medium">Invalid</span>
        </div>
      )

    case 'extracting':
      return (
        <div className="flex items-center gap-2 text-blue-600">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-xs font-medium">Extracting text...</span>
        </div>
      )

    case 'ready':
      return (
        <div className="flex items-center gap-2 text-green-600">
          <CheckCircle2 className="h-4 w-4" />
          <span className="text-xs font-medium">Ready</span>
        </div>
      )

    default:
      return null
  }
}

/**
 * Individual File Item Component
 *
 * Displays a single file with all its details and actions
 */
function FileItem({ file }: { file: UploadedFile }) {
  const removeFile = useFileUploadStore(state => state.removeFile)

  return (
    <div
      className={`flex items-center justify-between p-4 rounded-lg border transition-colors ${
        file.status === 'invalid' ? 'border-red-200 bg-red-50' : 'border-gray-200 hover:bg-gray-50'
      }`}
    >
      {/* File Info */}
      <div className="flex items-start gap-3 flex-1 min-w-0">
        {/* Icon */}
        <div
          className={`p-2 rounded ${
            file.status === 'invalid'
              ? 'bg-red-100 text-red-600'
              : file.status === 'valid' || file.status === 'ready'
                ? 'bg-green-100 text-green-600'
                : 'bg-gray-100 text-gray-600'
          }`}
        >
          {getFileIcon(file)}
        </div>

        {/* Details */}
        <div className="flex-1 min-w-0">
          {/* File name (truncate if too long) */}
          <h4 className="text-sm font-medium truncate" title={file.name}>
            {file.name}
          </h4>

          {/* File size */}
          <p className="text-xs text-muted-foreground">{formatBytes(file.size)}</p>

          {/* Error message (if invalid) */}
          {file.status === 'invalid' && file.error && (
            <p className="text-xs text-red-600 mt-1">{file.error}</p>
          )}
        </div>
      </div>

      {/* Status & Actions */}
      <div className="flex items-center gap-3 ml-4">
        {/* Status Badge */}
        {getStatusBadge(file)}

        {/* Remove Button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => removeFile(file.id)}
          className="text-red-600 hover:text-red-700 hover:bg-red-50"
          title="Remove file"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}

/**
 * Main File List Component
 *
 * Container for all uploaded files
 */
export function FileList() {
  const uploadedFiles = useFileUploadStore(state => state.uploadedFiles)
  const clearAllFiles = useFileUploadStore(state => state.clearAllFiles)

  // Don't render if no files
  if (uploadedFiles.length === 0) {
    return null
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Uploaded Files ({uploadedFiles.length})</CardTitle>
          {/* Clear All Button */}
          <Button variant="outline" size="sm" onClick={clearAllFiles}>
            Clear All
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {uploadedFiles.map(file => (
          <FileItem key={file.id} file={file} />
        ))}
      </CardContent>
    </Card>
  )
}
