/**
 * Exam Type Selection Page (Phase 2: Exam Configuration - Step 2)
 *
 * Second step where users configure question types and quantities.
 *
 * Workflow Position:
 * Phase 1: Authentication ✓
 * Phase 2: Exam Configuration
 *   → Step 1: File Upload ✓
 *   → Step 2: Exam Type Selection (THIS PAGE)
 *   → Step 3: Difficulty Distribution (Next)
 *   → Step 4: Review & Confirmation (Coming)
 * Phase 3: Exam Generation
 *
 * Features:
 * - Configure question types and quantities
 * - Real-time validation
 * - Quick presets
 * - Progress tracking
 * - Navigation with validation
 *
 * UX Principles:
 * - Clear step indicators
 * - Helpful instructions
 * - Presets for quick setup
 * - Disabled "Next" until valid configuration
 * - Easy navigation back
 */

import { ArrowLeft, ArrowRight, Info } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { ExamTypeSelection } from '../components/ExamTypeSelection'
import { Button } from '../components/ui/Button'
import { Card, CardContent } from '../components/ui/Card'
import { useExamConfigStore } from '../store/useExamConfigStore'
import { useFileUploadStore } from '../store/useFileUploadStore'

export function ExamTypeSelectionPage() {
  const navigate = useNavigate()
  const { isQuestionTypesValid } = useExamConfigStore()
  const uploadedFiles = useFileUploadStore(state => state.uploadedFiles)

  // Check if user can proceed
  const canProceed = isQuestionTypesValid()

  /**
   * Handle going back to file upload
   */
  const handleBack = () => {
    navigate('/create-exam')
  }

  /**
   * Handle proceeding to difficulty distribution
   */
  const handleNext = () => {
    if (!canProceed) return

    // Navigate to difficulty distribution page
    navigate('/create-exam/difficulty')
  }

  /**
   * Redirect if no files uploaded
   *
   * User must upload files first before configuring exam
   */
  if (uploadedFiles.length === 0) {
    navigate('/create-exam')
    return null
  }

  return (
    <div className="space-y-6">
      {/* Header with Progress */}
      <div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
          <span>Phase 2: Exam Configuration</span>
          <span>•</span>
          <span>Step 2 of 4</span>
        </div>
        <h2 className="text-3xl font-bold tracking-tight">Configure Question Types</h2>
        <p className="text-muted-foreground mt-1">
          Choose which types of questions you want and how many of each
        </p>
      </div>

      {/* Instructions Card */}
      <Card className="border-blue-200 bg-blue-50">
        <CardContent className="flex items-start gap-3 p-4">
          <Info className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-900 space-y-2">
            <p className="font-medium">Tips for selecting question types:</p>
            <ul className="list-disc list-inside space-y-1 text-blue-800">
              <li>
                Use <strong>Quick Presets</strong> for common exam configurations
              </li>
              <li>
                Mix different types for comprehensive assessment (e.g., Multiple Choice + Essays)
              </li>
              <li>Total must be between 10-200 questions</li>
              <li>You can adjust quantities with +/- buttons or type directly</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Exam Type Selection Component */}
      <ExamTypeSelection />

      {/* Navigation */}
      <div className="flex items-center justify-between pt-6 border-t">
        {/* Back Button */}
        <Button variant="outline" onClick={handleBack} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Back to Files
        </Button>

        {/* Next Button */}
        <Button
          onClick={handleNext}
          disabled={!canProceed}
          className="gap-2"
          title={
            !canProceed
              ? 'Configure at least 10 questions to continue'
              : 'Proceed to difficulty distribution'
          }
        >
          Next: Set Difficulty
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
