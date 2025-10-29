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
 *
 * Protected Routes:
 * If user is not authenticated, they are redirected to /login
 */

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AppLayout } from './components/layout/AppLayout'
import { HomePage } from './pages/HomePage'
import { LoginPage } from './pages/LoginPage'
import { SignupPage } from './pages/SignupPage'
import { SettingsPage } from './pages/SettingsPage'
import { FileUploadPage } from './pages/FileUploadPage'
import { ExamTypeSelectionPage } from './pages/ExamTypeSelectionPage'
import { useAppStore } from './store/useAppStore'

/**
 * Protected Route Component
 *
 * Wraps routes that require authentication.
 * Redirects to /login if user is not authenticated.
 */
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const user = useAppStore((state) => state.user)

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
  const user = useAppStore((state) => state.user)

  if (user) {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}

function App() {
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

        {/* Catch all - redirect to home */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
