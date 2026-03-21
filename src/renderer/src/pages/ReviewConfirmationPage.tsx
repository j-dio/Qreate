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
import { ArrowLeft, Sparkles, AlertCircle, CheckCircle } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { ConfigurationSummary } from '../components/ConfigurationSummary'
import { useExamConfigStore } from '../store/useExamConfigStore'
import { useFileUploadStore } from '../store/useFileUploadStore'

export function ReviewConfirmationPage() {
  const navigate = useNavigate()
  const [aiStatus, setAiStatus] = useState<{ 
    connected: boolean; 
    message: string; 
    provider?: string;
    providerInfo?: any;
  }>({
    connected: false,
    message: 'Checking AI connection...'
  })

  // Get state from stores
  const uploadedFiles = useFileUploadStore(state => state.uploadedFiles)
  const totalQuestions = useExamConfigStore(state => state.getTotalQuestions())
  const difficultyDistribution = useExamConfigStore(state => state.difficultyDistribution)

  // Check AI provider connection
  useEffect(() => {
    const checkAiConnection = async () => {
      try {
        // Test AI provider connection
        const connectionResult = await window.electron.ai.testConnection()
        
        if (connectionResult.success) {
          // Get provider info for display
          const providerInfoResult = await window.electron.ai.getProviderInfo()
          
          if (providerInfoResult.success) {
            setAiStatus({
              connected: true,
              message: `Connected to Together AI`,
              provider: providerInfoResult.providerInfo.provider || 'together-ai',
              providerInfo: providerInfoResult.providerInfo
            })
          } else {
            setAiStatus({
              connected: true,
              message: 'Connected to AI provider',
              provider: 'together-ai'
            })
          }
        } else {
          setAiStatus({
            connected: false,
            message: connectionResult.message || 'Failed to connect to AI provider',
            providerInfo: connectionResult.details ? { details: connectionResult.details } : undefined
          })
        }
      } catch (error) {
        console.error('AI connection test failed:', error)
        setAiStatus({
          connected: false,
          message: 'Failed to connect to AI backend'
        })
      }
    }

    checkAiConnection()
  }, [])

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
    const totalDistributed = Object.values(difficultyDistribution).reduce(
      (sum, val) => sum + val,
      0
    )
    if (totalDistributed !== totalQuestions) {
      navigate('/create-exam/difficulty')
      return
    }
  }, [uploadedFiles, totalQuestions, difficultyDistribution, navigate])

  // Calculate estimates for Together AI backend (Qwen3-235B two-pass is slow — ~1 min per 15 questions)
  const estimatedMinutes = Math.max(1, Math.round(totalQuestions / 15))
  const estimatedTime = estimatedMinutes === 1 ? '~1 minute' : `~${estimatedMinutes} minutes`
  const estimatedCost = 'Free' // Together AI free tier

  const handleBack = () => {
    navigate('/create-exam/difficulty')
  }

  const handleGenerate = async () => {
    if (!aiStatus.connected) {
      alert('AI provider not connected. Please check your environment configuration.')
      return
    }

    // Navigate to generation progress page
    // The progress page will automatically start generation
    navigate('/create-exam/generate')
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
          <div className={`flex items-center justify-between p-4 border rounded-lg ${
            aiStatus.connected 
              ? 'bg-green-50 border-green-200' 
              : 'bg-orange-50 border-orange-200'
          }`}>
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${
                aiStatus.connected ? 'bg-green-100' : 'bg-orange-100'
              }`}>
                {aiStatus.connected ? (
                  <CheckCircle className="h-5 w-5 text-green-600" />
                ) : (
                  <Sparkles className="h-5 w-5 text-orange-600" />
                )}
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">
                  Using Together AI (Backend)
                </p>
                <p className="text-xs text-gray-600">
                  Two-pass generation with Qwen3-235B for higher quality exams
                </p>
              </div>
            </div>
            <div className={`text-xs font-medium px-2 py-1 rounded ${
              aiStatus.connected 
                ? 'bg-green-100 text-green-700' 
                : 'bg-orange-100 text-orange-700'
            }`}>
              {aiStatus.connected ? 'Connected' : 'Disconnected'}
            </div>
          </div>

          {/* Estimates */}
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-500 mb-1">Estimated Time</p>
              <p className="text-lg font-semibold text-gray-900">{estimatedTime}</p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-500 mb-1">Estimated Cost</p>
              <p className="text-lg font-semibold text-gray-900">{estimatedCost}</p>
            </div>
          </div>

          {/* Warning if AI provider not connected */}
          {!aiStatus.connected && (
            <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
              <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-red-900 mb-1">AI Provider Not Connected</p>
                <p className="text-red-700 mb-2">{aiStatus.message}</p>
                {aiStatus.providerInfo?.details && (
                  <p className="text-red-600 text-xs mb-2 font-mono">{aiStatus.providerInfo.details}</p>
                )}
                <p className="text-red-700 text-xs">
                  Please ensure your TOGETHER_API_KEY is properly set in the .env.local file.
                  Get one at https://api.together.xyz/settings/api-keys
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
          disabled={!aiStatus.connected}
          className="flex items-center gap-2"
        >
          <Sparkles className="h-4 w-4" />
          Generate Exam
        </Button>
      </div>
    </div>
  )
}
