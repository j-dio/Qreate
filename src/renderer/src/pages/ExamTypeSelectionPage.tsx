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

import { ArrowLeft, ArrowRight, BadgeInfo } from 'lucide-react'
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
    <div className="page-shell">
      {/* Header with Progress */}
      <div>
        <div className="step-kicker">
          <span>Phase 2: Exam Configuration</span>
          <span>•</span>
          <span>Step 2 of 4</span>
        </div>
        <h2 className="text-3xl font-extrabold tracking-tight">Configure Question Types</h2>
        <p className="text-muted-foreground mt-1">
          Choose which types of questions to include and set your total question cap
        </p>
      </div>

      {/* Instructions Card */}
      <Card className="border-cyan-200 bg-cyan-50/80">
        <CardContent className="flex items-start gap-3 p-4">
          <BadgeInfo className="mt-0.5 h-5 w-5 flex-shrink-0 text-cyan-700" />
          <div className="space-y-2 text-sm text-cyan-950">
            <p className="font-medium">Tips for selecting question types:</p>
            <ul className="list-inside list-disc space-y-1 text-cyan-900">
              <li>
                Use <strong>Quick Presets</strong> for common exam configurations
              </li>
              <li>
                Check multiple types — the AI picks the best fit for each concept automatically
              </li>
              <li>Total cap must be between 10–50 questions</li>
              <li>At least one question type must be selected</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Exam Type Selection Component */}
      <ExamTypeSelection />

      {/* Navigation */}
      <div className="flex items-center justify-between border-t border-border/80 pt-6">
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
              ? 'Select at least one type and set 10–50 questions to continue'
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
