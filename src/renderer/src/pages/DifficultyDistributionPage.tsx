/**
 * Difficulty Distribution Page
 *
 * Phase 2, Step 3: Configure difficulty distribution
 *
 * User Flow:
 * 1. User arrives from Exam Type Selection
 * 2. Distribute questions across 5 difficulty levels
 * 3. Must sum to total questions exactly
 * 4. Can use auto-distribute for defaults
 * 5. Click "Next" to proceed to Review & Confirmation
 *
 * Validation:
 * - Distribution must equal total questions
 * - Cannot proceed if invalid
 */

import { useNavigate } from 'react-router-dom'
import { useEffect } from 'react'
import { ArrowLeft } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { DifficultyDistribution } from '../components/DifficultyDistribution'
import { useExamConfigStore } from '../store/useExamConfigStore'
import { useFileUploadStore } from '../store/useFileUploadStore'

export function DifficultyDistributionPage() {
  const navigate = useNavigate()

  // Get state from stores
  const totalQuestions = useExamConfigStore((state) => state.getTotalQuestions())
  const difficultyDistribution = useExamConfigStore((state) => state.difficultyDistribution)
  const uploadedFiles = useFileUploadStore((state) => state.uploadedFiles)

  // Validate that user came from proper workflow
  useEffect(() => {
    // Must have uploaded files
    if (uploadedFiles.length === 0) {
      navigate('/create-exam')
      return
    }

    // Must have selected question types
    if (totalQuestions === 0) {
      navigate('/create-exam/types')
      return
    }
  }, [uploadedFiles, totalQuestions, navigate])

  // Calculate if distribution is valid
  const totalDistributed = Object.values(difficultyDistribution).reduce((sum, val) => sum + val, 0)
  const isValid = totalDistributed === totalQuestions

  const handleBack = () => {
    navigate('/create-exam/types')
  }

  const handleNext = () => {
    if (!isValid) return

    // TODO: Navigate to Review & Confirmation page
    // For now, just show alert
    alert('Next: Review & Confirmation (Phase 2, Step 4 - not yet implemented)')
  }

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={handleBack}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          <span className="text-sm font-medium">Back to Question Types</span>
        </button>

        <h1 className="text-3xl font-bold text-gray-900">Configure Difficulty</h1>
        <p className="text-gray-600 mt-2">
          Step 3 of 4: Distribute your {totalQuestions} questions across difficulty levels
        </p>
      </div>

      {/* Progress Indicator */}
      <div className="mb-8">
        <div className="flex items-center gap-2">
          <div className="flex-1">
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-600 transition-all duration-300"
                style={{ width: '75%' }}
              />
            </div>
          </div>
          <span className="text-sm font-medium text-gray-600">75%</span>
        </div>
        <div className="flex justify-between text-xs text-gray-500 mt-2">
          <span>Upload Files</span>
          <span>Question Types</span>
          <span className="font-semibold text-blue-600">Difficulty</span>
          <span>Review</span>
        </div>
      </div>

      {/* Main Content */}
      <Card>
        <CardHeader>
          <CardTitle>Difficulty Distribution</CardTitle>
          <CardDescription>
            Choose how many questions should be at each difficulty level
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DifficultyDistribution />
        </CardContent>
      </Card>

      {/* Navigation Buttons */}
      <div className="flex items-center justify-between mt-8">
        <Button variant="outline" onClick={handleBack}>
          Back
        </Button>

        <Button onClick={handleNext} disabled={!isValid}>
          {isValid ? 'Continue to Review' : 'Complete Distribution First'}
        </Button>
      </div>
    </div>
  )
}
