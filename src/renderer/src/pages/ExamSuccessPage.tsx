/**
 * Exam Success Page
 *
 * Shown after exam generation completes.
 * Allows user to connect Google Drive and create documents.
 *
 * User Flow:
 * 1. Exam generated successfully ✅
 * 2. If not connected: [Connect Google Drive] button
 * 3. Once connected: Automatically create Google Doc
 * 4. Show: [Open in Google Docs] [Download PDF] buttons
 * 5. Option to create another exam
 *
 * UX Principles:
 * - Clear success message
 * - One-click Google Drive connection
 * - Automatic document creation (no extra clicks)
 * - Fallback to local storage if Google Drive fails
 * - Clear next actions
 */

import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  CheckCircle2,
  FileText,
  Download,
  ExternalLink,
  Loader2,
  AlertCircle,
  Home,
  RefreshCw,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import type { GeneratedExam } from '../store/useExamGenerationStore'
import { DocumentFormatter } from '../services/DocumentFormatter'

/**
 * State passed from ExamGenerationProgressPage
 */
interface LocationState {
  exam: GeneratedExam
}

/**
 * Document creation status
 */
type DocumentStatus = 'idle' | 'connecting' | 'creating' | 'success' | 'error'

export function ExamSuccessPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const state = location.state as LocationState | null

  // Local state
  const [documentStatus, setDocumentStatus] = useState<DocumentStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const [documentId, setDocumentId] = useState<string | null>(null)
  const [documentUrl, setDocumentUrl] = useState<string | null>(null)
  const [pdfPath, setPdfPath] = useState<string | null>(null)
  const [isConnectedToGoogleDrive, setIsConnectedToGoogleDrive] = useState(false)
  const [userEmail, setUserEmail] = useState<string | null>(null)

  // Redirect if no exam data
  useEffect(() => {
    if (!state || !state.exam) {
      console.warn('[ExamSuccessPage] No exam data, redirecting to home')
      navigate('/')
    }
  }, [state, navigate])

  // Check Google Drive connection status on mount
  useEffect(() => {
    checkGoogleDriveConnection()
  }, [])

  /**
   * Check if user is already connected to Google Drive
   */
  const checkGoogleDriveConnection = async () => {
    try {
      const isAuthenticated = await window.electron.googleDrive.checkAuth()
      setIsConnectedToGoogleDrive(isAuthenticated)

      if (isAuthenticated) {
        // Get user email
        const result = await window.electron.googleDrive.getUserEmail()
        if (result.success) {
          setUserEmail(result.email)
        }

        // Auto-create document if connected
        await createDocument()
      }
    } catch (error) {
      console.error('[ExamSuccessPage] Failed to check auth:', error)
    }
  }

  /**
   * Connect to Google Drive (OAuth flow)
   */
  const handleConnectGoogleDrive = async () => {
    setDocumentStatus('connecting')
    setError(null)

    try {
      // Step 1: Get OAuth URL
      const urlResult = await window.electron.googleDrive.getAuthUrl()
      if (!urlResult.success) {
        throw new Error(urlResult.error || 'Failed to get auth URL')
      }

      // Step 2: Open browser for OAuth
      await window.electron.openExternalUrl(urlResult.url)

      // Step 3: Wait for user to authorize and paste code
      // TODO: Implement code input dialog
      // For now, we'll show instructions
      alert(
        'Please authorize in the browser that just opened.\n\n' +
          'After authorizing, you will see an authorization code.\n' +
          'Copy the code and paste it in the next dialog.'
      )

      const code = prompt('Enter the authorization code:')
      if (!code) {
        setDocumentStatus('idle')
        return
      }

      // Step 4: Complete authentication
      const authResult = await window.electron.googleDrive.authenticate(code)
      if (!authResult.success) {
        throw new Error(authResult.error || 'Authentication failed')
      }

      // Step 5: Get user email
      const emailResult = await window.electron.googleDrive.getUserEmail()
      if (emailResult.success) {
        setUserEmail(emailResult.email)
      }

      setIsConnectedToGoogleDrive(true)

      // Step 6: Auto-create document
      await createDocument()
    } catch (error) {
      console.error('[ExamSuccessPage] Connection failed:', error)
      setError(error instanceof Error ? error.message : 'Failed to connect to Google Drive')
      setDocumentStatus('error')
    }
  }

  /**
   * Create Google Doc from exam
   */
  const createDocument = async () => {
    if (!state?.exam) return

    setDocumentStatus('creating')
    setError(null)

    try {
      // Format exam for Google Docs
      const formatter = new DocumentFormatter()
      const content = formatter.formatExam(state.exam)

      // Create document
      const title = `${state.exam.topic || 'Generated Exam'}_${Date.now()}`
      const result = await window.electron.googleDrive.createDocument(title, content)

      if (!result.success) {
        throw new Error(result.error || 'Failed to create document')
      }

      setDocumentId(result.documentId!)
      setDocumentUrl(result.url!)
      setDocumentStatus('success')

      console.log('[ExamSuccessPage] Document created:', result.documentId)
    } catch (error) {
      console.error('[ExamSuccessPage] Failed to create document:', error)
      setError(error instanceof Error ? error.message : 'Failed to create document')
      setDocumentStatus('error')
    }
  }

  /**
   * Download PDF
   */
  const handleDownloadPDF = async () => {
    if (!documentId || !state?.exam) return

    try {
      // Use project root + Projects directory
      const projectsDir = 'Projects'
      const filename = `${state.exam.topic.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}.pdf`
      const outputPath = `${projectsDir}/${filename}`

      const result = await window.electron.googleDrive.exportToPDF(documentId, outputPath)

      if (!result.success) {
        throw new Error(result.error || 'Failed to export PDF')
      }

      setPdfPath(result.path!)
      alert(`PDF saved to: ${result.path}`)
    } catch (error) {
      console.error('[ExamSuccessPage] Failed to download PDF:', error)
      alert('Failed to download PDF: ' + (error instanceof Error ? error.message : 'Unknown error'))
    }
  }

  /**
   * Open Google Docs in browser
   */
  const handleOpenInGoogleDocs = async () => {
    if (!documentUrl) return
    await window.electron.openExternalUrl(documentUrl)
  }

  /**
   * Create another exam
   */
  const handleCreateAnother = () => {
    navigate('/exam-config/upload')
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
                {state.exam.totalQuestions} questions created from {state.exam.metadata.sourceFiles.length} file(s)
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
                <span className="ml-2 font-medium">{state.exam.metadata.sourceFiles.join(', ')}</span>
              </div>
              <div>
                <span className="text-muted-foreground">AI Provider:</span>
                <span className="ml-2 font-medium">{state.exam.metadata.aiProvider}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Google Drive Connection */}
        <Card>
          <CardHeader>
            <CardTitle>Save to Google Drive</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Connection Status */}
            {!isConnectedToGoogleDrive && documentStatus !== 'connecting' && (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Connect your Google Drive to save this exam as a Google Doc and export to PDF.
                </p>
                <Button onClick={handleConnectGoogleDrive} className="w-full" size="lg">
                  Connect Google Drive
                </Button>
              </div>
            )}

            {/* Connecting */}
            {documentStatus === 'connecting' && (
              <div className="flex items-center justify-center gap-3 py-4">
                <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
                <span className="text-sm">Connecting to Google Drive...</span>
              </div>
            )}

            {/* Creating Document */}
            {documentStatus === 'creating' && (
              <div className="flex items-center justify-center gap-3 py-4">
                <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
                <span className="text-sm">Creating Google Doc...</span>
              </div>
            )}

            {/* Success */}
            {documentStatus === 'success' && documentUrl && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-green-600">
                  <CheckCircle2 className="h-5 w-5" />
                  <span className="font-medium">Document created successfully!</span>
                </div>
                {userEmail && (
                  <p className="text-sm text-muted-foreground">Connected as {userEmail}</p>
                )}
                <div className="flex gap-3">
                  <Button onClick={handleOpenInGoogleDocs} className="flex-1" variant="outline">
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Open in Google Docs
                  </Button>
                  <Button onClick={handleDownloadPDF} className="flex-1">
                    <Download className="h-4 w-4 mr-2" />
                    Download PDF
                  </Button>
                </div>
                {pdfPath && (
                  <p className="text-xs text-green-600">PDF saved to: {pdfPath}</p>
                )}
              </div>
            )}

            {/* Error */}
            {documentStatus === 'error' && error && (
              <div className="space-y-3">
                <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
                  <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-red-900">Failed to create document</p>
                    <p className="text-sm text-red-700 mt-1">{error}</p>
                  </div>
                </div>
                <Button onClick={createDocument} variant="outline" className="w-full">
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
