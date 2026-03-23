/**
 * App Layout Component
 *
 * Main layout structure for the application.
 * Contains header and main content area.
 *
 * Layout Structure:
 * ┌─────────────────────────────────┐
 * │          Header                 │
 * ├─────────────────────────────────┤
 * │                                 │
 * │          Main Content           │
 * │                                 │
 * └─────────────────────────────────┘
 */

import { Signpost, SlidersHorizontal, FolderKanban, PlusCircle, UserCircle2 } from 'lucide-react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAppStore } from '../../store/useAppStore'
import { Button } from '../ui/Button'

interface AppLayoutProps {
  children: React.ReactNode
}

export function AppLayout({ children }: AppLayoutProps) {
  const user = useAppStore(state => state.user)
  const logout = useAppStore(state => state.logout)
  const navigate = useNavigate()
  const location = useLocation()

  const handleLogout = () => {
    // Clear user and session from store
    logout()
    // Navigate to login page
    navigate('/login')
  }

  return (
    <div className="flex h-screen flex-col bg-background">
      {/* Header */}
      <header className="border-b border-border/70 bg-card/95 backdrop-blur">
        <div className="flex min-h-16 items-center px-6 py-2">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <img src="/qreate-logo.png" alt="Qreate logo" className="h-16 w-16 object-contain" />
            <h1 className="text-xl font-extrabold">Qreate</h1>
          </div>

          {/* Navigation */}
          <nav className="ml-8 flex items-center gap-1 rounded-xl border border-border/70 bg-muted/50 p-1">
            <Button
              variant={location.pathname === '/' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => navigate('/')}
              className="gap-2"
            >
              <Signpost className="h-4 w-4" />
              Home
            </Button>
            <Button
              variant={location.pathname === '/my-exams' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => navigate('/my-exams')}
              className="gap-2"
            >
              <FolderKanban className="h-4 w-4" />
              My Exams
            </Button>
            <Button
              variant={location.pathname.startsWith('/create-exam') ? 'default' : 'ghost'}
              size="sm"
              onClick={() => navigate('/create-exam')}
              className="gap-2"
            >
              <PlusCircle className="h-4 w-4" />
              Create Exam
            </Button>
          </nav>

          {/* Spacer */}
          <div className="flex-1" />

          {/* User info and actions */}
          <div className="flex items-center gap-4">
            {user ? (
              <>
                <div className="rounded-lg border border-border/70 bg-background/80 px-3 py-2 text-sm">
                  <p className="font-semibold">{user.name}</p>
                  <p className="text-xs text-muted-foreground">{user.email}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate('/settings')}
                    className="gap-2"
                  >
                    <SlidersHorizontal className="h-4 w-4" />
                    Settings
                  </Button>
                  <Button variant="ghost" size="sm" onClick={handleLogout} className="gap-2">
                    <UserCircle2 className="h-4 w-4" />
                    Logout
                  </Button>
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Not logged in</p>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <div className="container mx-auto px-4 py-6 md:px-6">{children}</div>
      </main>
    </div>
  )
}
