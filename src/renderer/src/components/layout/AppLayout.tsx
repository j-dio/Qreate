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

import { FileText } from 'lucide-react'
import { useAppStore } from '../../store/useAppStore'

interface AppLayoutProps {
  children: React.ReactNode
}

export function AppLayout({ children }: AppLayoutProps) {
  const user = useAppStore((state) => state.user)

  return (
    <div className="flex h-screen flex-col bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="flex h-16 items-center px-6">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <FileText className="h-6 w-6 text-primary" />
            <h1 className="text-xl font-bold">Qreate</h1>
          </div>

          {/* Spacer */}
          <div className="flex-1" />

          {/* User info (placeholder for now) */}
          <div className="flex items-center gap-4">
            {user ? (
              <div className="text-sm">
                <p className="font-medium">{user.name}</p>
                <p className="text-xs text-muted-foreground">{user.email}</p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Not logged in</p>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <div className="container mx-auto p-6">{children}</div>
      </main>
    </div>
  )
}
