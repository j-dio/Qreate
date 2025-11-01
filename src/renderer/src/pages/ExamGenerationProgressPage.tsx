/**
 * Exam Generation Progress Page
 *
 * Phase 3, Step 1: Real-time progress tracking during exam generation
 *
 * User Flow:
 * 1. User clicks "Generate Exam" from Review & Confirmation
 * 2. Automatically redirected here
 * 3. See live progress: current file, questions generated, time remaining
 * 4. See success/error states with animations
 * 5. On completion, navigate to Exam Results page
 *
 * Features:
 * - Real-time progress bar
 * - File-by-file processing status
 * - Questions generated counter
 * - Estimated time remaining
 * - Error handling with retry option
 * - Cancel option (future)
 */

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Sparkles, FileText, CheckCircle, XCircle, Loader2, AlertCircle } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { useExamGenerationStore } from '../store/useExamGenerationStore'
import { useFileUploadStore } from '../store/useFileUploadStore'
import { useExamConfigStore } from '../store/useExamConfigStore'
import { useAppStore } from '../store/useAppStore'
import { ExamGenerationService } from '../services/ExamGenerationService'

export function ExamGenerationProgressPage() {
  const navigate = useNavigate()
  const [hasStarted, setHasStarted] = useState(false)

  // Get state from stores
  const {
    status,
    progress,
    error,
    startGeneration,
    updateProgress,
    setError,
    setGeneratedExam,
    reset: resetGeneration,
  } = useExamGenerationStore()

  const uploadedFiles = useFileUploadStore((state) => state.uploadedFiles)
  const questionTypes = useExamConfigStore((state) => state.questionTypes)
  const difficultyDistribution = useExamConfigStore((state) => state.difficultyDistribution)
  const totalQuestions = useExamConfigStore((state) => state.getTotalQuestions())
  const selectedAIProvider = useAppStore((state) => state.selectedAIProvider)
  const apiCredentials = useAppStore((state) => state.apiCredentials)

  // Validate user came from proper workflow
  useEffect(() => {
    if (uploadedFiles.length === 0 || totalQuestions === 0) {
      navigate('/create-exam')
      return
    }

    // Check AI provider is connected
    const isConnected =
      (selectedAIProvider === 'gemini' && apiCredentials.geminiApiKey) ||
      (selectedAIProvider === 'openai' && apiCredentials.openaiApiKey)

    if (!isConnected) {
      navigate('/settings')
      return
    }
  }, [uploadedFiles, totalQuestions, selectedAIProvider, apiCredentials, navigate])

  // Start generation automatically on mount
  useEffect(() => {
    if (!hasStarted && status === 'idle') {
      setHasStarted(true)
      handleStartGeneration()
    }
  }, [hasStarted, status])

  const handleStartGeneration = async () => {
    // Get API key for selected provider
    const apiKey =
      selectedAIProvider === 'gemini'
        ? apiCredentials.geminiApiKey
        : selectedAIProvider === 'openai'
          ? apiCredentials.openaiApiKey
          : ''

    if (!apiKey) {
      setError({
        message: 'API key not found for selected provider',
        code: 'NO_API_KEY',
        canRetry: false,
        retryCount: 0,
        maxRetries: 3,
      })
      return
    }

    // Start generation
    startGeneration()

    // Update initial progress
    updateProgress({
      totalFiles: uploadedFiles.length,
      totalQuestionsNeeded: totalQuestions,
      currentFileIndex: 0,
      questionsGenerated: 0,
    })

    // Create service
    const service = new ExamGenerationService({
      files: uploadedFiles,
      questionTypes,
      difficultyDistribution,
      totalQuestions,
      aiProvider: selectedAIProvider,
      apiKey,
    })

    // Generate exam with progress callback
    const result = await service.generate((progressUpdate) => {
      updateProgress(progressUpdate)
    })

    // Handle result
    if (result.success && result.exam) {
      setGeneratedExam(result.exam)
      // Navigate to success page with exam data
      setTimeout(() => {
        navigate('/create-exam/success', {
          state: { exam: result.exam },
        })
      }, 2000)
    } else if (result.error) {
      setError({
        message: result.error.message,
        code: result.error.code,
        file: result.error.file,
        canRetry: true,
        retryCount: 0,
        maxRetries: 3,
      })
    }
  }

  const handleRetry = () => {
    resetGeneration()
    setHasStarted(false)
  }

  const handleCancel = () => {
    resetGeneration()
    navigate('/create-exam/review')
  }

  // Calculate progress percentage
  const progressPercentage =
    progress.totalQuestionsNeeded > 0
      ? Math.min(100, (progress.questionsGenerated / progress.totalQuestionsNeeded) * 100)
      : 0

  // Format time remaining
  const formatTimeRemaining = (ms: number | null): string => {
    if (ms === null) return '...'
    const seconds = Math.ceil(ms / 1000)
    if (seconds < 60) return `${seconds}s`
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes}m ${remainingSeconds}s`
  }

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      {/* Header */}
      <div className="mb-6 text-center">
        <div className="flex items-center justify-center gap-3 mb-4">
          <Sparkles className="h-8 w-8 text-blue-600 animate-pulse" />
          <h1 className="text-3xl font-bold text-gray-900">Generating Your Exam</h1>
        </div>
        <p className="text-gray-600">
          {status === 'processing'
            ? 'AI is creating questions from your study materials...'
            : status === 'completed'
              ? 'Exam generation complete!'
              : status === 'error'
                ? 'Generation encountered an error'
                : 'Preparing to generate...'}
        </p>
      </div>

      {/* Progress Card */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Progress</CardTitle>
          <CardDescription>
            {progress.currentFileIndex + 1} of {progress.totalFiles} files processed
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Progress Bar */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">Overall Progress</span>
              <span className="text-sm font-semibold text-blue-600">
                {progressPercentage.toFixed(0)}%
              </span>
            </div>
            <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-600 transition-all duration-500 ease-out"
                style={{ width: `${progressPercentage}%` }}
              />
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-3 gap-4">
            <div className="p-4 bg-gray-50 rounded-lg text-center">
              <p className="text-xs text-gray-500 mb-1">Questions Generated</p>
              <p className="text-2xl font-bold text-gray-900">
                {progress.questionsGenerated}
                <span className="text-sm text-gray-500">/{progress.totalQuestionsNeeded}</span>
              </p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg text-center">
              <p className="text-xs text-gray-500 mb-1">Current File</p>
              <p className="text-sm font-medium text-gray-900 truncate">
                {progress.currentFile || 'Initializing...'}
              </p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg text-center">
              <p className="text-xs text-gray-500 mb-1">Time Remaining</p>
              <p className="text-2xl font-bold text-gray-900">
                {formatTimeRemaining(progress.estimatedTimeRemaining)}
              </p>
            </div>
          </div>

          {/* File Processing Status */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-3">Files</h3>
            <div className="space-y-2">
              {uploadedFiles.map((file, index) => {
                const isProcessing = index === progress.currentFileIndex && status === 'processing'
                const isCompleted = index < progress.currentFileIndex
                const isPending = index > progress.currentFileIndex

                return (
                  <div
                    key={file.id}
                    className={`flex items-center gap-3 p-3 rounded-lg ${
                      isProcessing
                        ? 'bg-blue-50 border border-blue-200'
                        : isCompleted
                          ? 'bg-green-50 border border-green-200'
                          : 'bg-gray-50 border border-gray-200'
                    }`}
                  >
                    <div>
                      {isProcessing && <Loader2 className="h-5 w-5 text-blue-600 animate-spin" />}
                      {isCompleted && <CheckCircle className="h-5 w-5 text-green-600" />}
                      {isPending && <FileText className="h-5 w-5 text-gray-400" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{file.name}</p>
                    </div>
                    {isProcessing && (
                      <span className="text-xs font-medium text-blue-600">Processing...</span>
                    )}
                    {isCompleted && (
                      <span className="text-xs font-medium text-green-600">Complete</span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Error Card */}
      {status === 'error' && error && (
        <Card className="mb-6 border-red-200 bg-red-50">
          <CardHeader>
            <div className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-red-600" />
              <CardTitle className="text-red-900">Generation Failed</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-red-800">
                  <p className="font-medium mb-1">{error.message}</p>
                  {error.file && <p className="text-xs">File: {error.file}</p>}
                  {error.code && <p className="text-xs">Error Code: {error.code}</p>}
                </div>
              </div>

              {error.canRetry && (
                <div className="flex gap-3">
                  <Button onClick={handleRetry} variant="outline" size="sm">
                    Retry Generation
                  </Button>
                  <Button onClick={handleCancel} variant="ghost" size="sm">
                    Back to Review
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Success Card */}
      {status === 'completed' && (
        <Card className="border-green-200 bg-green-50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-green-100 rounded-full">
                <CheckCircle className="h-8 w-8 text-green-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-green-900 mb-1">
                  Exam Generated Successfully!
                </h3>
                <p className="text-sm text-green-700">
                  Generated {progress.questionsGenerated} questions from {progress.totalFiles} files
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Cancel Button (only show during processing) */}
      {status === 'processing' && (
        <div className="flex justify-center">
          <Button variant="ghost" onClick={handleCancel} size="sm">
            Cancel
          </Button>
        </div>
      )}
    </div>
  )
}
