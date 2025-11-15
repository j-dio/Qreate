/**
 * File Upload Page (Phase 2: Exam Configuration - Step 1)
 *
 * First step in the exam creation workflow where users upload study materials.
 *
 * Workflow Position:
 * Phase 1: Authentication ✓
 * Phase 2: Exam Configuration
 *   → Step 1: File Upload (THIS PAGE)
 *   → Step 2: Exam Type Selection (Coming next)
 *   → Step 3: Difficulty Distribution (Coming next)
 *   → Step 4: Review & Confirmation (Coming next)
 * Phase 3: Exam Generation
 * Phase 4: Document Creation
 *
 * Features:
 * - File upload with drag-and-drop
 * - File validation and management
 * - Progress tracking
 * - Clear instructions
 * - Prevents progression without valid files
 *
 * UX Principles Applied:
 * - Clear step indicators
 * - Helpful instructions
 * - Immediate validation feedback
 * - Disabled "Next" until requirements met (foolproofing)
 * - Easy navigation back to home
 */

import { useEffect } from 'react'
import { ArrowLeft, ArrowRight, Info } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { FileUploadZone } from '../components/FileUploadZone'
import { FileList } from '../components/FileList'
import { Button } from '../components/ui/Button'
import { Card, CardContent } from '../components/ui/Card'
import { useFileUploadStore } from '../store/useFileUploadStore'
import { useExamConfigStore } from '../store/useExamConfigStore'
import { useExamGenerationStore } from '../store/useExamGenerationStore'

export function FileUploadPage() {
  const navigate = useNavigate()
  const uploadedFiles = useFileUploadStore(state => state.uploadedFiles)

  // Reset all workflow state when entering exam creation
  useEffect(() => {
    console.log('[FileUploadPage] Resetting workflow state for new exam creation')
    
    const clearAllFiles = useFileUploadStore.getState().clearAllFiles
    const resetAll = useExamConfigStore.getState().resetAll
    const reset = useExamGenerationStore.getState().reset
    
    clearAllFiles()
    resetAll()
    reset()
  }, [])

  /**
   * Check if user can proceed to next step
   *
   * Requirements:
   * - At least 1 file uploaded
   * - All files have status 'valid' or 'ready'
   *
   * Why this validation?
   * - Prevents user from proceeding with no files
   * - Ensures all files passed validation
   * - Follows "foolproofing" principle from CLAUDE.md
   */
  const canProceed = uploadedFiles.length > 0 && uploadedFiles.every(f => f.status === 'valid')

  /**
   * Get validation status message
   *
   * Provides clear feedback on what's blocking progression
   */
  const getStatusMessage = () => {
    if (uploadedFiles.length === 0) {
      return 'Upload at least one file to continue'
    }

    const invalidFiles = uploadedFiles.filter(f => f.status === 'invalid')
    if (invalidFiles.length > 0) {
      return `Remove ${invalidFiles.length} invalid file(s) to continue`
    }

    const pendingFiles = uploadedFiles.filter(f => f.status === 'pending')
    if (pendingFiles.length > 0) {
      return `Validating ${pendingFiles.length} file(s)...`
    }

    return 'Ready to proceed!'
  }

  /**
   * Handle proceeding to next step
   *
   * Navigate to exam type selection page
   */
  const handleNext = () => {
    if (!canProceed) return

    // Navigate to exam type selection page
    navigate('/create-exam/types')
  }

  /**
   * Handle going back to home
   *
   * Note: In production, we should warn if there are unsaved changes
   */
  const handleBack = () => {
    if (uploadedFiles.length > 0) {
      const confirmLeave = confirm(
        'Are you sure you want to go back? Your uploaded files will be cleared.'
      )
      if (!confirmLeave) return
    }
    navigate('/')
  }

  return (
    <div className="space-y-6">
      {/* Header with Progress */}
      <div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
          <span>Phase 2: Exam Configuration</span>
          <span>•</span>
          <span>Step 1 of 4</span>
        </div>
        <h2 className="text-3xl font-bold tracking-tight">Upload Study Materials</h2>
        <p className="text-muted-foreground mt-1">
          Upload the documents you want to generate exam questions from
        </p>
      </div>

      {/* Instructions Card */}
      <Card className="border-blue-200 bg-blue-50">
        <CardContent className="flex items-start gap-3 p-4">
          <Info className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-900 space-y-2">
            <p className="font-medium">How it works:</p>
            <ol className="list-decimal list-inside space-y-1 text-blue-800">
              <li>Upload your study materials (PDFs, documents, images, or text files)</li>
              <li>We'll extract the text content from your files</li>
              <li>Configure your exam preferences in the next steps</li>
              <li>AI will generate custom questions based on your materials</li>
            </ol>
          </div>
        </CardContent>
      </Card>

      {/* File Upload Zone */}
      <FileUploadZone />

      {/* File List (only shows if files are uploaded) */}
      <FileList />

      {/* Status and Navigation */}
      <div className="flex items-center justify-between pt-6 border-t">
        {/* Back Button */}
        <Button variant="outline" onClick={handleBack} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Back to Home
        </Button>

        {/* Status Message & Next Button */}
        <div className="flex items-center gap-4">
          {/* Status Message */}
          <p
            className={`text-sm ${
              canProceed
                ? 'text-green-600 font-medium'
                : uploadedFiles.length > 0
                  ? 'text-orange-600'
                  : 'text-muted-foreground'
            }`}
          >
            {getStatusMessage()}
          </p>

          {/* Next Button */}
          <Button
            onClick={handleNext}
            disabled={!canProceed}
            className="gap-2"
            title={!canProceed ? getStatusMessage() : 'Proceed to exam configuration'}
          >
            Next: Configure Exam
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
