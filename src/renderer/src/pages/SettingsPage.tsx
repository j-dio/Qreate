/**
 * Settings Page
 *
 * UPDATED FOR GROQ BACKEND:
 * - No longer requires user API keys
 * - Shows backend AI provider info
 * - Displays account and usage information
 */

import { useNavigate } from 'react-router-dom'
import { CheckCircle2, Zap, Sparkles, TrendingUp, Calendar } from 'lucide-react'
import { Button } from '../components/ui/Button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/Card'
import { useAppStore } from '../store/useAppStore'
import { useEffect, useState } from 'react'

interface UsageStatus {
  success: boolean
  usage: {
    examsToday: number
    examsThisMonth: number
    totalExams: number
  }
  limits: {
    examsPerDay: number
    examsPerMonth: number
  }
  resetTimes: {
    dailyResetIn: number
    monthlyResetIn: number
  }
}

export function SettingsPage() {
  const navigate = useNavigate()
  const user = useAppStore(state => state.user)
  const [usageStatus, setUsageStatus] = useState<UsageStatus | null>(null)

  // Fetch usage status on mount
  useEffect(() => {
    const fetchUsageStatus = async () => {
      try {
        const result = await window.electron.groq.getUsageStatus()
        if (result.success) {
          setUsageStatus(result as UsageStatus)
        }
      } catch (error) {
        console.error('[SettingsPage] Failed to fetch usage status:', error)
      }
    }

    fetchUsageStatus()
  }, [])

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Settings</h2>
        <p className="text-muted-foreground">Manage your account and view usage statistics</p>
      </div>

      {/* AI Provider Info */}
      <Card className="border-green-200 bg-green-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-green-600" />
            AI Exam Generation (Powered by Groq)
          </CardTitle>
          <CardDescription>
            Free, fast, and reliable exam generation - no API keys required!
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2 text-green-700">
            <CheckCircle2 className="h-5 w-5" />
            <span className="font-semibold">Backend AI Service Active</span>
          </div>

          <div className="grid gap-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">AI Model:</span>
              <span className="font-medium">Groq Llama 3.3 70B</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Speed:</span>
              <span className="font-medium">~8 seconds for 100 questions</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Reliability:</span>
              <span className="font-medium text-green-600">100% Success Rate</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Cost:</span>
              <span className="font-medium text-green-600">Completely FREE</span>
            </div>
          </div>

          <div className="pt-2 border-t text-xs text-muted-foreground">
            No API key setup required - we handle everything for you!
          </div>
        </CardContent>
      </Card>

      {/* Usage Statistics */}
      {usageStatus && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Usage Statistics
            </CardTitle>
            <CardDescription>Track your exam generation usage and quota limits</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Daily Usage */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4 text-blue-500" />
                  <span className="font-medium">Today's Usage</span>
                </div>
                <span className="text-sm text-muted-foreground">
                  Resets in {Math.ceil(usageStatus.resetTimes.dailyResetIn / 3600000)} hours
                </span>
              </div>

              {/* Progress bar */}
              <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                <div
                  className="bg-blue-500 h-2 rounded-full transition-all"
                  style={{
                    width: `${(usageStatus.usage.examsToday / usageStatus.limits.examsPerDay) * 100}%`,
                  }}
                />
              </div>

              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">
                  {usageStatus.usage.examsToday} / {usageStatus.limits.examsPerDay} exams used
                </span>
                <span className="font-medium text-blue-600">
                  {usageStatus.limits.examsPerDay - usageStatus.usage.examsToday} remaining
                </span>
              </div>
            </div>

            {/* Monthly Usage */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-purple-500" />
                  <span className="font-medium">This Month</span>
                </div>
                <span className="text-sm text-muted-foreground">Resets on the 1st</span>
              </div>

              {/* Progress bar */}
              <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                <div
                  className="bg-purple-500 h-2 rounded-full transition-all"
                  style={{
                    width: `${(usageStatus.usage.examsThisMonth / usageStatus.limits.examsPerMonth) * 100}%`,
                  }}
                />
              </div>

              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">
                  {usageStatus.usage.examsThisMonth} / {usageStatus.limits.examsPerMonth} exams used
                </span>
                <span className="font-medium text-purple-600">
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
