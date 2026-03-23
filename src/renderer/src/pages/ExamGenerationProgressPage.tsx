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

import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Sparkles, FileText, CheckCircle, XCircle, Loader2, AlertCircle } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { useExamGenerationStore } from '../store/useExamGenerationStore'
import { useFileUploadStore } from '../store/useFileUploadStore'
import { useExamConfigStore } from '../store/useExamConfigStore'
import { useAppStore } from '../store/useAppStore'

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

  const uploadedFiles = useFileUploadStore(state => state.uploadedFiles)
  const questionTypes = useExamConfigStore(state => state.questionTypes)
  const difficultyDistribution = useExamConfigStore(state => state.difficultyDistribution)
  const totalQuestions = useExamConfigStore(state => state.getTotalQuestions())
  const user = useAppStore(state => state.user)

  // Validate user came from proper workflow
  useEffect(() => {
    if (!user) {
      navigate('/login')
      return
    }
    if (uploadedFiles.length === 0 || totalQuestions === 0) {
      navigate('/create-exam')
      return
    }
    // No need to check user API keys - provider access is managed server-side
  }, [user, uploadedFiles, totalQuestions, navigate])

  const handleStartGeneration = useCallback(async () => {
    try {
      // Start generation
      startGeneration()

      // Update initial progress
      updateProgress({
        totalFiles: uploadedFiles.length,
        totalQuestionsNeeded: totalQuestions,
        currentFileIndex: 0,
        questionsGenerated: 0,
      })

      // Extract text from all files first
      const fileTexts: string[] = []
      for (let i = 0; i < uploadedFiles.length; i++) {
        const file = uploadedFiles[i]

        // Update progress for file processing
        updateProgress({
          totalFiles: uploadedFiles.length,
          totalQuestionsNeeded: totalQuestions,
          currentFileIndex: i,
          questionsGenerated: 0,
          currentFile: file.name,
          stage: 'processing_files',
        })

        // Extract text from file - handle both path-based and drag-and-drop files
        let result

        if (file.path && !file.isDragAndDrop) {
          // File has a path (from file dialog) - use normal extraction
          console.log(
            `[ExamGeneration] Using path extraction for: ${file.name} (path: ${file.path})`
          )
          result = await window.electron.extractFileText(file.path)
        } else if (file.isDragAndDrop && file.originalFile) {
          // Drag-and-drop file - extract via buffer
          console.log(`[ExamGeneration] Using buffer extraction for: ${file.name}`)
          const originalFile = file.originalFile

          // Convert File to ArrayBuffer then to Uint8Array
          const arrayBuffer = await originalFile.arrayBuffer()
          const uint8Array = new Uint8Array(arrayBuffer)

          // Extract text using buffer method
          result = await window.electron.extractFileTextFromBuffer({
            name: file.name,
            buffer: uint8Array,
            type: file.type,
          })
        } else {
          const errorMsg = `File ${file.name} has no accessible path or content. Path: ${file.path}, isDragAndDrop: ${file.isDragAndDrop}, hasOriginalFile: ${!!file.originalFile}`
          console.error('[ExamGeneration] File access error:', errorMsg)
          throw new Error(errorMsg)
        }

        console.log(`[ExamGeneration] Extraction result for ${file.name}:`, {
          success: result?.success,
          hasText: !!result?.text,
          textLength: result?.text?.length || 0,
          error: result?.error,
        })

        if (result && result.success && result.text) {
          fileTexts.push(result.text)
          console.log(
            `[ExamGeneration] Successfully extracted ${result.text.length} characters from ${file.name}`
          )
        } else {
          const errorMsg = result?.error || 'Unknown error during text extraction'
          console.error(`[ExamGeneration] Failed to extract text from ${file.name}:`, errorMsg)
          throw new Error(`Failed to extract text from ${file.name}: ${errorMsg}`)
        }
      }

      // Combine all file texts with explicit source markers so the AI can see document boundaries.
      // Single-file uploads pass the text directly (no markers needed).
      const combinedText =
        fileTexts.length === 1
          ? fileTexts[0]
          : fileTexts
              .map((text, i) => `=== SOURCE ${i + 1}: ${uploadedFiles[i].name} ===\n${text}`)
              .join('\n\n')

      // Update progress for AI generation
      updateProgress({
        totalFiles: uploadedFiles.length,
        totalQuestionsNeeded: totalQuestions,
        currentFileIndex: uploadedFiles.length,
        questionsGenerated: 0,
        stage: 'generating_exam',
      })

      // Generate exam with backend AI provider
      const config = {
        questionTypes,
        difficultyDistribution,
        totalQuestions,
      }

      const examResult = await window.electron.groq.generateExam(
        config,
        combinedText,
        parseInt(user!.id)
      )

      if (examResult.success && examResult.content) {
        // The IPC handler returns the exam content as 'content', not 'exam'
        setGeneratedExam(examResult.content)

        // Update final progress
        updateProgress({
          totalFiles: uploadedFiles.length,
          totalQuestionsNeeded: totalQuestions,
          currentFileIndex: uploadedFiles.length,
          questionsGenerated: totalQuestions,
          stage: 'completed',
        })

        // Navigate to success page with exam data
        setTimeout(() => {
          navigate('/create-exam/success', {
            state: {
              exam: examResult.content,
              providerUsed: examResult.providerUsed,
              actualQuestions: examResult.actualQuestions,
              requestedQuestions: examResult.requestedQuestions,
            },
          })
        }, 2000)
      } else {
        throw new Error(examResult.error || 'Failed to generate exam')
      }
    } catch (error: any) {
      setError({
        message: error.message || 'Unknown error occurred',
        code: 'GENERATION_ERROR',
        canRetry: true,
        retryCount: 0,
        maxRetries: 3,
      })
    }
  }, [
    startGeneration,
    updateProgress,
    uploadedFiles,
    totalQuestions,
    setGeneratedExam,
    navigate,
    questionTypes,
    difficultyDistribution,
    user,
    setError,
  ])

  // Start generation automatically on mount
  useEffect(() => {
    if (!hasStarted && status === 'idle') {
      setHasStarted(true)
      handleStartGeneration()
    }
  }, [hasStarted, status, handleStartGeneration])

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
    <div className="page-shell max-w-4xl">
      {/* Header */}
      <div className="text-center">
        <div className="mb-4 flex items-center justify-center gap-3">
          <Sparkles className="h-8 w-8 animate-pulse text-primary" />
          <h1 className="text-3xl font-extrabold text-foreground">Generating Your Exam</h1>
        </div>
        <p className="text-muted-foreground">
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
      <Card>
        <CardHeader>
          <CardTitle>Progress</CardTitle>
          <CardDescription>
            {progress.stage === 'generating_exam'
              ? 'Files extracted — AI is generating your exam...'
              : `${Math.min(progress.currentFileIndex + 1, progress.totalFiles)} of ${progress.totalFiles} files processed`}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Progress Bar */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-foreground">Overall Progress</span>
              <span className="text-sm font-semibold text-primary">
                {progress.stage === 'generating_exam'
                  ? 'Generating...'
                  : `${progressPercentage.toFixed(0)}%`}
              </span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-muted">
              {progress.stage === 'generating_exam' ? (
                <div className="h-full w-full animate-pulse bg-primary/60" />
              ) : (
                <div
                  className="h-full bg-primary transition-all duration-500 ease-out"
                  style={{ width: `${progressPercentage}%` }}
                />
              )}
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-3 gap-4">
            <div className="rounded-lg border border-border/70 bg-muted/40 p-4 text-center">
              <p className="mb-1 text-xs text-muted-foreground">Questions Requested</p>
              {progress.stage === 'generating_exam' ? (
                <p className="mt-1 text-sm font-medium text-primary animate-pulse">Generating...</p>
              ) : (
                <p className="text-2xl font-bold text-foreground">
                  {progress.questionsGenerated}
                  <span className="text-sm text-muted-foreground">
                    /{progress.totalQuestionsNeeded}
                  </span>
                </p>
              )}
            </div>
            <div className="rounded-lg border border-border/70 bg-muted/40 p-4 text-center">
              <p className="mb-1 text-xs text-muted-foreground">Current File</p>
              <p className="truncate text-sm font-medium text-foreground">
                {progress.stage === 'generating_exam'
                  ? 'AI processing...'
                  : progress.currentFile || 'Initializing...'}
              </p>
            </div>
            <div className="rounded-lg border border-border/70 bg-muted/40 p-4 text-center">
              <p className="mb-1 text-xs text-muted-foreground">Time Remaining</p>
              <p className="text-2xl font-bold text-foreground">
                {progress.stage === 'generating_exam'
                  ? `~${Math.max(1, Math.round(progress.totalQuestionsNeeded / 15))}m`
                  : formatTimeRemaining(progress.estimatedTimeRemaining)}
              </p>
            </div>
          </div>

          {/* File Processing Status */}
          <div>
            <h3 className="mb-3 text-sm font-medium text-foreground">Files</h3>
            <div className="space-y-2">
              {uploadedFiles.map((file, index) => {
                const isGeneratingAI = progress.stage === 'generating_exam'
                const isProcessing =
                  !isGeneratingAI && index === progress.currentFileIndex && status === 'processing'
                const isCompleted = !isGeneratingAI && index < progress.currentFileIndex
                const isPending = !isGeneratingAI && index > progress.currentFileIndex

                return (
                  <div
                    key={file.id}
                    className={`flex items-center gap-3 p-3 rounded-lg ${
                      isProcessing
                        ? 'border border-primary/30 bg-accent/70'
                        : isCompleted
                          ? 'border border-emerald-200 bg-emerald-50/80'
                          : isGeneratingAI
                            ? 'border border-border/90 bg-muted/50'
                            : 'border border-border/70 bg-muted/30'
                    }`}
                  >
                    <div>
                      {isProcessing && <Loader2 className="h-5 w-5 animate-spin text-primary" />}
                      {isCompleted && <CheckCircle className="h-5 w-5 text-emerald-700" />}
                      {isGeneratingAI && <CheckCircle className="h-5 w-5 text-muted-foreground" />}
                      {isPending && <FileText className="h-5 w-5 text-muted-foreground" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">{file.name}</p>
                    </div>
                    {isProcessing && (
                      <span className="text-xs font-medium text-primary">Processing...</span>
                    )}
                    {isCompleted && (
                      <span className="text-xs font-medium text-emerald-700">Complete</span>
                    )}
                    {isGeneratingAI && (
                      <span className="text-xs font-medium text-muted-foreground">Extracted</span>
                    )}
                  </div>
                )
              })}
              {progress.stage === 'generating_exam' && (
                <div className="flex items-center gap-3 rounded-lg border border-primary/30 bg-accent/70 p-3">
                  <Loader2 className="h-5 w-5 flex-shrink-0 animate-spin text-primary" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">
                      AI generating {progress.totalQuestionsNeeded} questions (two-pass)
                    </p>
                  </div>
                  <span className="text-xs font-medium text-primary">In progress...</span>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Error Card */}
      {status === 'error' && error && (
        <Card className="border-red-200 bg-red-50/90">
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
        <Card className="border-emerald-200 bg-emerald-50/90">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="rounded-full bg-emerald-100 p-3">
                <CheckCircle className="h-8 w-8 text-emerald-700" />
              </div>
              <div className="flex-1">
                <h3 className="mb-1 text-lg font-semibold text-emerald-900">
                  Exam Generated Successfully!
                </h3>
                <p className="text-sm text-emerald-800">
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
