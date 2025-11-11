/**
 * Root App Component
 *
 * Main application entry point with layout and routing.
 *
 * Routing Structure:
 * - /login - Login page (public)
 * - /signup - Signup page (public)
 * - / - Home page (protected, requires authentication)
 * - /settings - Settings page (protected)
 * - /create-exam - File upload (protected)
 * - /create-exam/types - Exam type selection (protected)
 * - /create-exam/difficulty - Difficulty distribution (protected)
 * - /create-exam/review - Review & confirmation (protected)
 * - /create-exam/generate - Exam generation progress (protected)
 * - /create-exam/success - Exam success & Google Drive export (protected)
 *
 * Protected Routes:
 * If user is not authenticated, they are redirected to /login
 */

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { AppLayout } from './components/layout/AppLayout'
import { HomePage } from './pages/HomePage'
import { LoginPage } from './pages/LoginPage'
import { SignupPage } from './pages/SignupPage'
import { SettingsPage } from './pages/SettingsPage'
import { MyExamsPage } from './pages/MyExamsPage'
import { FileUploadPage } from './pages/FileUploadPage'
import { ExamTypeSelectionPage } from './pages/ExamTypeSelectionPage'
import { DifficultyDistributionPage } from './pages/DifficultyDistributionPage'
import { ReviewConfirmationPage } from './pages/ReviewConfirmationPage'
import { ExamGenerationProgressPage } from './pages/ExamGenerationProgressPage'
import { ExamSuccessPage } from './pages/ExamSuccessPage'
import { useAppStore } from './store/useAppStore'

/**
 * Protected Route Component
 *
 * Wraps routes that require authentication.
 * Redirects to /login if user is not authenticated.
 */
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const user = useAppStore(state => state.user)

  if (!user) {
    return <Navigate to="/login" replace />
  }

  return <AppLayout>{children}</AppLayout>
}

/**
 * Public Route Component
 *
 * Wraps routes that don't require authentication (login, signup).
 * Redirects to home page if user is already authenticated.
 */
function PublicRoute({ children }: { children: React.ReactNode }) {
  const user = useAppStore(state => state.user)

  if (user) {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}

function App() {
  const user = useAppStore(state => state.user)
  const sessionToken = useAppStore(state => state.sessionToken)
  const setUserAndSession = useAppStore(state => state.setUserAndSession)
  const logout = useAppStore(state => state.logout)
  const [isInitializing, setIsInitializing] = useState(true)

  // Validate session on app startup
  useEffect(() => {
    const validateExistingSession = async () => {
      // If we have a session token in storage, validate it
      if (sessionToken && !user) {
        try {
          const result = await window.electron.auth.validateSession(sessionToken)
          
          if (result.success && result.valid && result.user) {
            // Session is valid - restore user data
            setUserAndSession(
              {
                id: result.user.id.toString(),
                email: result.user.email,
                name: result.user.name,
                createdAt: result.user.created_at,
                chatgptConnected: false,
                googleDriveConnected: false,
                aiConnected: false,
              },
              sessionToken
            )
            console.log('[Auth] Session restored for user:', result.user.email)
          } else {
            // Session is invalid - clear it
            logout()
            console.log('[Auth] Invalid session cleared')
          }
        } catch (error) {
          console.error('[Auth] Session validation failed:', error)
          logout()
        }
      }
      
      setIsInitializing(false)
    }

    validateExistingSession()
  }, [sessionToken, user, setUserAndSession, logout])

  // Show loading screen while validating session
  if (isInitializing) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <div className="mb-4 text-2xl font-bold">Qreate</div>
          <div className="text-muted-foreground">Loading...</div>
        </div>
      </div>
    )
  }

  return (
    <BrowserRouter>
      <Routes>
        {/* Public Routes */}
        <Route
          path="/login"
          element={
            <PublicRoute>
              <LoginPage />
            </PublicRoute>
          }
        />
        <Route
          path="/signup"
          element={
            <PublicRoute>
              <SignupPage />
            </PublicRoute>
          }
        />

        {/* Protected Routes */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <HomePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings"
          element={
            <ProtectedRoute>
              <SettingsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/my-exams"
          element={
            <ProtectedRoute>
              <MyExamsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/create-exam"
          element={
            <ProtectedRoute>
              <FileUploadPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/create-exam/types"
          element={
            <ProtectedRoute>
              <ExamTypeSelectionPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/create-exam/difficulty"
          element={
            <ProtectedRoute>
              <DifficultyDistributionPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/create-exam/review"
          element={
            <ProtectedRoute>
              <ReviewConfirmationPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/create-exam/generate"
          element={
            <ProtectedRoute>
              <ExamGenerationProgressPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/create-exam/success"
          element={
            <ProtectedRoute>
              <ExamSuccessPage />
            </ProtectedRoute>
          }
        />

        {/* Catch all - redirect to home */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
