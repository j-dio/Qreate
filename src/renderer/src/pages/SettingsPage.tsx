/**
 * Settings Page
 *
 * UPDATED FOR TOGETHER AI BACKEND:
 * - No longer requires user API keys
 * - Shows backend AI provider info
 * - Displays account and usage information
 */

import { useNavigate } from 'react-router-dom'
import {
  CheckCircle2,
  Gauge,
  Sparkles,
  Loader2,
  ChartNoAxesColumn,
  CalendarClock,
  AlertCircle,
} from 'lucide-react'
import { Button } from '../components/ui/Button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/Card'
import { useAppStore } from '../store/useAppStore'
import { useEffect, useState } from 'react'

interface UsageStatus {
  success: boolean
  canGenerate: boolean
  usage: {
    examsToday: number
    examsThisWeek: number
    examsThisMonth: number
    totalExams: number
  }
  limits: {
    examsPerWeek: number
    dailyBurstLimit: number
    examsPerMonth: number
  }
  resetTimes: {
    dailyResetIn: number
    weeklyResetIn: number
    monthlyResetIn: number
  }
}

interface ProviderStatus {
  loading: boolean
  connected: boolean
  message: string
  providerInfo?: {
    provider?: string
    primaryModel?: string
    fallbackModel?: string
  }
}

export function SettingsPage() {
  const navigate = useNavigate()
  const user = useAppStore(state => state.user)
  const [usageStatus, setUsageStatus] = useState<UsageStatus | null>(null)
  const [providerStatus, setProviderStatus] = useState<ProviderStatus>({
    loading: true,
    connected: false,
    message: 'Checking AI provider status...',
  })

  // Fetch usage status and provider status
  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const connectionResult = await window.electron.ai.testConnection()

        if (connectionResult.success) {
          const providerInfoResult = await window.electron.ai.getProviderInfo()
          setProviderStatus({
            loading: false,
            connected: true,
            message: connectionResult.message || 'Connected to Together AI backend',
            providerInfo: providerInfoResult.success ? providerInfoResult.providerInfo : undefined,
          })
        } else {
          setProviderStatus({
            loading: false,
            connected: false,
            message: connectionResult.message || 'AI provider is unavailable',
          })
        }

        if (user?.id) {
          const userId = parseInt(user.id)
          if (!Number.isNaN(userId)) {
            const usageResult = await window.electron.groq.getUsageStatus(userId)
            if (usageResult.success) {
              setUsageStatus(usageResult as UsageStatus)
            }
          }
        }
      } catch (error) {
        console.error('[SettingsPage] Failed to fetch provider/usage status:', error)
        setProviderStatus({
          loading: false,
          connected: false,
          message: 'Failed to connect to AI backend',
        })
      }
    }

    fetchStatus()
  }, [user?.id])

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <h2 className="text-3xl font-extrabold tracking-tight">Settings</h2>
        <p className="text-muted-foreground">Manage your account and view usage statistics</p>
      </div>

      {/* AI Provider Info */}
      <Card
        className={
          providerStatus.loading
            ? 'border-sky-200 bg-sky-50/80'
            : providerStatus.connected
              ? 'border-emerald-200 bg-emerald-50/80'
              : 'border-red-200 bg-red-50/80'
        }
      >
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles
              className={`h-5 w-5 ${
                providerStatus.loading
                  ? 'text-sky-700'
                  : providerStatus.connected
                    ? 'text-emerald-700'
                    : 'text-red-700'
              }`}
            />
            AI Exam Generation (Powered by Together AI)
          </CardTitle>
          <CardDescription>
            Backend-managed generation using Together AI with automatic fallback.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div
            className={`flex items-center gap-2 ${
              providerStatus.loading
                ? 'text-sky-800'
                : providerStatus.connected
                  ? 'text-emerald-800'
                  : 'text-red-800'
            }`}
          >
            {providerStatus.loading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : providerStatus.connected ? (
              <CheckCircle2 className="h-5 w-5" />
            ) : (
              <AlertCircle className="h-5 w-5" />
            )}
            <span className="font-semibold">
              {providerStatus.loading
                ? 'Checking backend AI service...'
                : providerStatus.connected
                  ? 'Backend AI Service Active'
                  : 'Backend AI Service Unavailable'}
            </span>
          </div>

          <div className="grid gap-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Primary Model:</span>
              <span className="font-medium">
                {providerStatus.providerInfo?.primaryModel || 'Qwen/Qwen3-235B-A22B'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Fallback Model:</span>
              <span className="font-medium">
                {providerStatus.providerInfo?.fallbackModel || 'llama-3.3-70b-versatile'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Estimated Time:</span>
              <span className="font-medium">~3 minutes for larger exams</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Connection:</span>
              <span
                className={`font-medium ${
                  providerStatus.connected ? 'text-emerald-700' : 'text-red-700'
                }`}
              >
                {providerStatus.loading
                  ? 'Checking...'
                  : providerStatus.connected
                    ? 'Connected'
                    : 'Disconnected'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Cost:</span>
              <span className="font-medium text-emerald-700">Completely FREE</span>
            </div>
          </div>

          <div className="pt-2 border-t text-xs text-muted-foreground">
            {providerStatus.message}
          </div>
        </CardContent>
      </Card>

      {/* Usage Statistics */}
      {usageStatus && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ChartNoAxesColumn className="h-5 w-5" />
              Usage Statistics
            </CardTitle>
            <CardDescription>Track your exam generation usage and quota limits</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Daily Usage */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Gauge className="h-4 w-4 text-primary" />
                  <span className="font-medium">Today's Usage</span>
                </div>
                <span className="text-sm text-muted-foreground">
                  Resets in {Math.ceil(usageStatus.resetTimes.dailyResetIn / 3600000)} hours
                </span>
              </div>

              {/* Progress bar */}
              <div className="mb-2 h-2 w-full rounded-full bg-muted">
                <div
                  className="h-2 rounded-full bg-primary transition-all"
                  style={{
                    width: `${(usageStatus.usage.examsToday / usageStatus.limits.dailyBurstLimit) * 100}%`,
                  }}
                />
              </div>

              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">
                  {usageStatus.usage.examsToday} / {usageStatus.limits.dailyBurstLimit} exams used
                </span>
                <span className="font-medium text-primary">
                  {Math.max(0, usageStatus.limits.dailyBurstLimit - usageStatus.usage.examsToday)}{' '}
                  remaining
                </span>
              </div>
            </div>

            {/* Weekly Usage */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <CalendarClock className="h-4 w-4 text-emerald-700" />
                  <span className="font-medium">This Week</span>
                </div>
                <span className="text-sm text-muted-foreground">
                  Resets in {Math.ceil(usageStatus.resetTimes.weeklyResetIn / (24 * 3600000))} days
                </span>
              </div>

              <div className="mb-2 h-2 w-full rounded-full bg-muted">
                <div
                  className="h-2 rounded-full bg-emerald-600 transition-all"
                  style={{
                    width: `${(usageStatus.usage.examsThisWeek / usageStatus.limits.examsPerWeek) * 100}%`,
                  }}
                />
              </div>

              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">
                  {usageStatus.usage.examsThisWeek} / {usageStatus.limits.examsPerWeek} exams used
                </span>
                <span className="font-medium text-emerald-700">
                  {Math.max(0, usageStatus.limits.examsPerWeek - usageStatus.usage.examsThisWeek)}{' '}
                  remaining
                </span>
              </div>
            </div>

            {/* Monthly Usage */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <CalendarClock className="h-4 w-4 text-cyan-700" />
                  <span className="font-medium">This Month</span>
                </div>
                <span className="text-sm text-muted-foreground">Resets on the 1st</span>
              </div>

              {/* Progress bar */}
              <div className="mb-2 h-2 w-full rounded-full bg-muted">
                <div
                  className="h-2 rounded-full bg-cyan-600 transition-all"
                  style={{
                    width: `${(usageStatus.usage.examsThisMonth / usageStatus.limits.examsPerMonth) * 100}%`,
                  }}
                />
              </div>

              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">
                  {usageStatus.usage.examsThisMonth} / {usageStatus.limits.examsPerMonth} exams used
                </span>
                <span className="font-medium text-cyan-700">
                  {usageStatus.limits.examsPerMonth - usageStatus.usage.examsThisMonth} remaining
                </span>
              </div>
            </div>

            {/* Lifetime Stats */}
            <div className="pt-4 border-t">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Total Exams Generated:</span>
                <span className="font-medium">{usageStatus.usage.totalExams}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Account Info */}
      <Card>
        <CardHeader>
          <CardTitle>Account Information</CardTitle>
          <CardDescription>Your Qreate account details</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Email:</span>
            <span className="font-medium">{user?.email || 'test@qreate.app'}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Account Type:</span>
            <span className="font-medium">Free Tier</span>
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex gap-3">
        <Button variant="outline" onClick={() => navigate('/')}>
          Back to Home
        </Button>
      </div>
    </div>
  )
}
