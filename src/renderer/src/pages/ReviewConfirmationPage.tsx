/**
 * Review & Confirmation Page
 *
 * Phase 2, Step 4: Final review before exam generation
 *
 * User Flow:
 * 1. User arrives from Difficulty Distribution
 * 2. Review all configuration settings
 * 3. See estimated processing time and API usage
 * 4. Can edit any section by clicking Edit buttons
 * 5. Click "Generate Exam" to proceed to Phase 3
 *
 * Validation:
 * - All previous steps must be completed
 * - Redirects if workflow not followed
 */

import { useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { ArrowLeft, Sparkles, AlertCircle } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { ConfigurationSummary } from '../components/ConfigurationSummary'
import { useExamConfigStore } from '../store/useExamConfigStore'
import { useFileUploadStore } from '../store/useFileUploadStore'
import { useAppStore } from '../store/useAppStore'
import { AI_PROVIDERS } from '../types/ai-providers'

export function ReviewConfirmationPage() {
  const navigate = useNavigate()
  const [isGenerating, setIsGenerating] = useState(false)

  // Get state from stores
  const uploadedFiles = useFileUploadStore((state) => state.uploadedFiles)
  const totalQuestions = useExamConfigStore((state) => state.getTotalQuestions())
  const difficultyDistribution = useExamConfigStore((state) => state.difficultyDistribution)
  const selectedAIProvider = useAppStore((state) => state.selectedAIProvider)
  const apiCredentials = useAppStore((state) => state.apiCredentials)

  // Get provider config
  const providerConfig = AI_PROVIDERS[selectedAIProvider]

  // Check if AI provider is connected
  const isAIConnected =
    (selectedAIProvider === 'gemini' && apiCredentials.geminiApiKey) ||
    (selectedAIProvider === 'openai' && apiCredentials.openaiApiKey) ||
    (selectedAIProvider === 'anthropic' && apiCredentials.anthropicApiKey) ||
    (selectedAIProvider === 'ollama' && apiCredentials.ollamaUrl)

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

    // Must have completed difficulty distribution
    const totalDistributed = Object.values(difficultyDistribution).reduce((sum, val) => sum + val, 0)
    if (totalDistributed !== totalQuestions) {
      navigate('/create-exam/difficulty')
      return
    }
  }, [uploadedFiles, totalQuestions, difficultyDistribution, navigate])

  // Calculate estimates
  const estimatedProcessingTime = Math.ceil(uploadedFiles.length * 30) // ~30 seconds per file
  const estimatedCost =
    providerConfig.features.isFree ? 'Free' : `~$${(totalQuestions * 0.001).toFixed(3)}`

  const handleBack = () => {
    navigate('/create-exam/difficulty')
  }

  const handleGenerate = async () => {
    if (!isAIConnected) {
      alert('Please connect your AI provider in Settings first!')
      navigate('/settings')
      return
    }

    setIsGenerating(true)

    // TODO: Phase 3 - Exam Generation
    // This will trigger the AI generation process
    setTimeout(() => {
      alert('Phase 3: Exam Generation (not yet implemented)')
      setIsGenerating(false)
    }, 1500)
  }

  return (
    <div className="container mx-auto max-w-5xl px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={handleBack}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          <span className="text-sm font-medium">Back to Difficulty</span>
        </button>

        <h1 className="text-3xl font-bold text-gray-900">Review & Confirm</h1>
        <p className="text-gray-600 mt-2">
          Step 4 of 4: Review your configuration and generate the exam
        </p>
      </div>

      {/* Progress Indicator */}
      <div className="mb-8">
        <div className="flex items-center gap-2">
          <div className="flex-1">
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-600 transition-all duration-300"
                style={{ width: '100%' }}
              />
            </div>
          </div>
          <span className="text-sm font-medium text-gray-600">100%</span>
        </div>
        <div className="flex justify-between text-xs text-gray-500 mt-2">
          <span>Upload Files</span>
          <span>Question Types</span>
          <span>Difficulty</span>
          <span className="font-semibold text-blue-600">Review</span>
        </div>
      </div>

      {/* Configuration Summary */}
      <ConfigurationSummary />

      {/* AI Provider & Estimates */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>AI Provider & Estimates</CardTitle>
          <CardDescription>Processing information</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* AI Provider Info */}
          <div className="flex items-center justify-between p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Sparkles className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">
                  Using {providerConfig.name}
                </p>
                <p className="text-xs text-gray-600">{providerConfig.description}</p>
              </div>
            </div>
            {!isAIConnected && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate('/settings')}
              >
                Connect
              </Button>
            )}
          </div>

          {/* Estimates */}
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-500 mb-1">Estimated Time</p>
              <p className="text-lg font-semibold text-gray-900">
                ~{estimatedProcessingTime} seconds
              </p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-500 mb-1">Estimated Cost</p>
              <p className="text-lg font-semibold text-gray-900">{estimatedCost}</p>
            </div>
          </div>

          {/* Warning if not connected */}
          {!isAIConnected && (
            <div className="flex items-start gap-3 p-4 bg-orange-50 border border-orange-200 rounded-lg">
              <AlertCircle className="h-5 w-5 text-orange-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-orange-900 mb-1">AI Provider Not Connected</p>
                <p className="text-orange-700">
                  Please connect your {providerConfig.name} API key in Settings before generating
                  the exam.
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <div className="flex items-center justify-between mt-8">
        <Button variant="outline" onClick={handleBack}>
          Back
        </Button>

        <Button
          onClick={handleGenerate}
          disabled={isGenerating || !isAIConnected}
          className="flex items-center gap-2"
        >
          {isGenerating ? (
            <>
              <Sparkles className="h-4 w-4 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" />
              Generate Exam
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
