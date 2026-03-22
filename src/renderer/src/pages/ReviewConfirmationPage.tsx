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
import { ArrowLeft, Bot, AlertCircle, CheckCircle, Sparkles, Loader2 } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { ConfigurationSummary } from '../components/ConfigurationSummary'
import { useExamConfigStore } from '../store/useExamConfigStore'
import { useFileUploadStore } from '../store/useFileUploadStore'

export function ReviewConfirmationPage() {
  const navigate = useNavigate()
  const [isCheckingAi, setIsCheckingAi] = useState(true)
  const [aiStatus, setAiStatus] = useState<{
    connected: boolean
    message: string
    provider?: string
    providerInfo?: any
  }>({
    connected: false,
    message: 'Checking AI connection...',
  })
  // Get state from stores
  const uploadedFiles = useFileUploadStore(state => state.uploadedFiles)
  const totalQuestions = useExamConfigStore(state => state.getTotalQuestions())

  // Check AI provider connection
  useEffect(() => {
    const checkAiConnection = async () => {
      setIsCheckingAi(true)
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
              providerInfo: providerInfoResult.providerInfo,
            })
          } else {
            setAiStatus({
              connected: true,
              message: 'Connected to AI provider',
              provider: 'together-ai',
            })
          }
        } else {
          setAiStatus({
            connected: false,
            message: connectionResult.message || 'Failed to connect to AI provider',
            providerInfo: connectionResult.details
              ? { details: connectionResult.details }
              : undefined,
          })
        }
      } catch (error) {
        console.error('AI connection test failed:', error)
        setAiStatus({
          connected: false,
          message: 'Failed to connect to AI backend',
        })
      } finally {
        setIsCheckingAi(false)
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

  }, [uploadedFiles, totalQuestions, navigate])

  // Calculate estimates for Together AI backend (Qwen3-235B two-pass is slow — ~1 min per 15 questions)
  const estimatedMinutes = Math.max(1, Math.round(totalQuestions / 15))
  const estimatedTime = estimatedMinutes === 1 ? '~1 minute' : `~${estimatedMinutes} minutes`
  const estimatedCost = 'Free' // Together AI free tier

  const handleBack = () => {
    navigate('/create-exam/types')
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
    <div className="page-shell">
      {/* Header */}
      <div>
        <button
          onClick={handleBack}
          className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Question Types</span>
        </button>

        <span className="step-kicker">Step 3 of 3</span>
        <h1 className="text-3xl font-extrabold text-foreground">Review & Confirm</h1>
        <p className="mt-2 text-muted-foreground">
          Step 3 of 3: Review your configuration and generate the exam
        </p>
      </div>

      {/* Progress Indicator */}
      <div>
        <div className="flex items-center gap-2">
          <div className="flex-1">
            <div className="wizard-progress-track overflow-hidden">
              <div className="wizard-progress-fill" style={{ width: '100%' }} />
            </div>
          </div>
          <span className="text-sm font-semibold text-primary">100%</span>
        </div>
        <div className="mt-2 flex justify-between text-xs text-muted-foreground">
          <span>Upload Files</span>
          <span>Question Types</span>
          <span className="font-semibold text-primary">Review</span>
        </div>
      </div>

      {/* Configuration Summary */}
      <ConfigurationSummary />

      {/* AI Provider & Estimates */}
      <Card>
        <CardHeader>
          <CardTitle>AI Provider & Estimates</CardTitle>
          <CardDescription>Processing information</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* AI Provider Info */}
          <div
            className={`flex items-center justify-between rounded-lg border p-4 ${
              isCheckingAi
                ? 'border-sky-200 bg-sky-50'
                : aiStatus.connected
                  ? 'border-emerald-200 bg-emerald-50'
                  : 'border-amber-200 bg-amber-50'
            }`}
          >
            <div className="flex items-center gap-3">
              <div
                className={`rounded-lg p-2 ${
                  isCheckingAi
                    ? 'bg-sky-100'
                    : aiStatus.connected
                      ? 'bg-emerald-100'
                      : 'bg-amber-100'
                }`}
              >
                {isCheckingAi ? (
                  <Loader2 className="h-5 w-5 animate-spin text-sky-700" />
                ) : aiStatus.connected ? (
                  <CheckCircle className="h-5 w-5 text-emerald-700" />
                ) : (
                  <Bot className="h-5 w-5 text-amber-700" />
                )}
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">Using Together AI (Backend)</p>
                <p className="text-xs text-muted-foreground">
                  Two-pass generation with Qwen3-235B for higher quality exams
                </p>
              </div>
            </div>
            <div
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                isCheckingAi
                  ? 'bg-sky-100 text-sky-700'
                  : aiStatus.connected
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-amber-100 text-amber-700'
              }`}
            >
              {isCheckingAi ? 'Checking...' : aiStatus.connected ? 'Connected' : 'Disconnected'}
            </div>
          </div>

          {/* Estimates */}
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-lg border border-border/70 bg-muted/40 p-4">
              <p className="mb-1 text-xs text-muted-foreground">Estimated Time</p>
              <p className="text-lg font-semibold text-foreground">{estimatedTime}</p>
            </div>
            <div className="rounded-lg border border-border/70 bg-muted/40 p-4">
              <p className="mb-1 text-xs text-muted-foreground">Estimated Cost</p>
              <p className="text-lg font-semibold text-foreground">{estimatedCost}</p>
            </div>
          </div>

          {/* Warning if AI provider not connected */}
          {!isCheckingAi && !aiStatus.connected && (
            <div className="status-banner status-banner-error">
              <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-600" />
              <div className="text-sm">
                <p className="mb-1 font-medium text-red-900">AI Provider Not Connected</p>
                <p className="mb-2 text-red-700">{aiStatus.message}</p>
                {aiStatus.providerInfo?.details && (
                  <p className="mb-2 font-mono text-xs text-red-600">
                    {aiStatus.providerInfo.details}
                  </p>
                )}
                <p className="text-xs text-red-700">
                  Please ensure your TOGETHER_API_KEY is properly set in the .env.local file. Get
                  one at https://api.together.xyz/settings/api-keys
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <div className="flex items-center justify-between border-t border-border/80 pt-6">
        <Button variant="outline" onClick={handleBack}>
          Back
        </Button>

        <Button
          onClick={handleGenerate}
          disabled={isCheckingAi || !aiStatus.connected}
          className="flex items-center gap-2"
        >
          <Sparkles className="h-4 w-4" />
          Generate Exam
        </Button>
      </div>
    </div>
  )
}
