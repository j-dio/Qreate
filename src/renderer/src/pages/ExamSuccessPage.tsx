/**
 * Exam Success Page
 *
 * Shown after exam generation completes.
 * Allows user to download PDF of the generated exam.
 *
 * User Flow:
 * 1. Exam generated successfully ✅
 * 2. Click "Download PDF" to generate and save PDF
 * 3. Option to create another exam or go home
 *
 * UX Principles:
 * - Clear success message
 * - Simple one-click PDF download
 * - Local file generation (no cloud dependencies)
 * - Clear next actions
 */

import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  CheckCircle2,
  FileText,
  Download,
  Loader2,
  AlertCircle,
  Home,
  RefreshCw,
  FolderOpen,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import type { GeneratedExam } from '../store/useExamGenerationStore'

/**
 * State passed from ExamGenerationProgressPage
 */
interface LocationState {
  exam: GeneratedExam
}

/**
 * PDF generation status
 */
type PDFStatus = 'idle' | 'generating' | 'success' | 'error'

export function ExamSuccessPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const state = location.state as LocationState | null

  // Local state
  const [pdfStatus, setPDFStatus] = useState<PDFStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const [pdfPath, setPdfPath] = useState<string | null>(null)

  // Redirect if no exam data
  useEffect(() => {
    if (!state || !state.exam) {
      console.warn('[ExamSuccessPage] No exam data, redirecting to home')
      navigate('/')
    }
  }, [state, navigate])

  /**
   * Generate and download PDF
   */
  const handleDownloadPDF = async () => {
    if (!state?.exam) return

    setPDFStatus('generating')
    setError(null)

    try {
      // DEBUG: Log exam structure
      console.log('[ExamSuccessPage] Exam object:', state.exam)
      console.log('[ExamSuccessPage] First question:', state.exam.questions[0])
      console.log('[ExamSuccessPage] First question options:', state.exam.questions[0]?.options)

      // Create filename from topic
      const sanitizedTopic = state.exam.topic.replace(/[^a-zA-Z0-9]/g, '_')
      const timestamp = Date.now()
      const filename = `${sanitizedTopic}_${timestamp}.pdf`
      const outputPath = `Projects/${filename}`

      console.log('[ExamSuccessPage] Generating PDF:', outputPath)

      // Generate PDF
      const result = await window.electron.generateExamPDF(state.exam, outputPath)

      if (!result.success) {
        throw new Error(result.error || 'Failed to generate PDF')
      }

      setPdfPath(result.path!)
      setPDFStatus('success')

      console.log('[ExamSuccessPage] PDF generated:', result.path)
    } catch (error) {
      console.error('[ExamSuccessPage] Failed to generate PDF:', error)
      setError(error instanceof Error ? error.message : 'Failed to generate PDF')
      setPDFStatus('error')
    }
  }

  /**
   * Open folder containing the PDF
   */
  const handleOpenFolder = () => {
    if (pdfPath) {
      // Extract directory from path
      const folderPath = pdfPath.substring(0, pdfPath.lastIndexOf('\\'))
      window.electron.openExternalUrl(`file:///${folderPath}`)
    }
  }

  /**
   * Create another exam
   */
  const handleCreateAnother = () => {
    navigate('/create-exam/upload')
  }

  if (!state?.exam) {
    return null // Will redirect in useEffect
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Success Header */}
        <Card className="border-green-200 bg-green-50">
          <CardContent className="flex items-center gap-4 p-6">
            <div className="rounded-full bg-green-100 p-3">
              <CheckCircle2 className="h-8 w-8 text-green-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-green-900">Exam Generated Successfully!</h1>
              <p className="text-green-700 mt-1">
                {state.exam.totalQuestions} questions created from{' '}
                {state.exam.metadata.sourceFiles.length} file(s)
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Exam Details */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Exam Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Topic:</span>
                <span className="ml-2 font-medium">{state.exam.topic}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Questions:</span>
                <span className="ml-2 font-medium">{state.exam.totalQuestions}</span>
              </div>
              <div className="col-span-2">
                <span className="text-muted-foreground">Source Files:</span>
                <span className="ml-2 font-medium">
                  {state.exam.metadata.sourceFiles.join(', ')}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">AI Provider:</span>
                <span className="ml-2 font-medium capitalize">
                  {state.exam.metadata.aiProvider}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* PDF Download */}
        <Card>
          <CardHeader>
            <CardTitle>Download Your Exam</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Initial State */}
            {pdfStatus === 'idle' && (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Generate a PDF file of your exam with professionally formatted questions and
                  answer key.
                </p>
                <Button onClick={handleDownloadPDF} className="w-full" size="lg">
                  <Download className="h-4 w-4 mr-2" />
                  Download PDF
                </Button>
              </div>
            )}

            {/* Generating */}
            {pdfStatus === 'generating' && (
              <div className="flex items-center justify-center gap-3 py-4">
                <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
                <span className="text-sm">Generating PDF...</span>
              </div>
            )}

            {/* Success */}
            {pdfStatus === 'success' && pdfPath && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-green-600">
                  <CheckCircle2 className="h-5 w-5" />
                  <span className="font-medium">PDF generated successfully!</span>
                </div>
                <p className="text-xs text-muted-foreground break-all">Saved to: {pdfPath}</p>
                <div className="flex gap-3">
                  <Button onClick={handleOpenFolder} variant="outline" className="flex-1">
                    <FolderOpen className="h-4 w-4 mr-2" />
                    Open Folder
                  </Button>
                  <Button onClick={handleDownloadPDF} variant="outline" className="flex-1">
                    <Download className="h-4 w-4 mr-2" />
                    Download Again
                  </Button>
                </div>
              </div>
            )}

            {/* Error */}
            {pdfStatus === 'error' && error && (
              <div className="space-y-3">
                <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
                  <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-red-900">Failed to generate PDF</p>
                    <p className="text-sm text-red-700 mt-1">{error}</p>
                  </div>
                </div>
                <Button onClick={handleDownloadPDF} variant="outline" className="w-full">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Retry
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex gap-3">
          <Button onClick={handleCreateAnother} className="flex-1" size="lg">
            <FileText className="h-4 w-4 mr-2" />
            Create Another Exam
          </Button>
          <Button onClick={() => navigate('/')} variant="outline" size="lg">
            <Home className="h-4 w-4 mr-2" />
            Go Home
          </Button>
        </div>
      </div>
    </div>
  )
}
