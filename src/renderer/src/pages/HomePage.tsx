/**
 * Home Page Component
 *
 * Main dashboard showing user's exam projects and quick actions.
 *
 * Features:
 * - List of recent projects
 * - Create new exam button
 * - Project statistics
 * - Usage quota display (Groq backend)
 */

import {
  Plus,
  FileText,
  Zap,
  Calendar,
  Hash,
  ExternalLink,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '../store/useAppStore'
import { Button } from '../components/ui/Button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/Card'
import { useEffect, useState, useCallback, memo } from 'react'

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
    minQuestionsPerExam: number
    maxQuestionsPerExam: number
    rateLimitDelaySeconds: number
  }
  resetTimes: {
    dailyResetIn: number
    weeklyResetIn: number
    monthlyResetIn: number
  }
}

interface ExamRecord {
  id: number
  user_id: number
  title: string
  topic: string
  total_questions: number
  file_path: string
  created_at: string
}

/**
 * Memoized ExamCard component to prevent unnecessary re-renders
 * Only re-renders when exam data actually changes
 */
const ExamCard = memo(({ exam }: { exam: ExamRecord }) => {
  return (
    <Card
      key={exam.id}
      className="hover:shadow-md transition-shadow cursor-pointer"
      onClick={() => {
        // Open PDF file using local file handler
        window.electron.openLocalFile(exam.file_path).catch(() => {
          alert('Could not open exam file. The file may have been moved or deleted.')
        })
      }}
    >
      <CardHeader>
        <CardTitle className="line-clamp-2 text-base">{exam.title}</CardTitle>
        <CardDescription className="flex items-center gap-2 text-xs">
          <Calendar className="h-3 w-3" />
          {new Date(exam.created_at).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground line-clamp-1">
            <strong>Topic:</strong> {exam.topic}
          </p>
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-1 text-muted-foreground">
              <Hash className="h-3 w-3" />
              {exam.total_questions} questions
            </span>
            <span className="rounded-full px-2 py-1 text-xs font-medium bg-green-100 text-green-700">
              Ready
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
})

ExamCard.displayName = 'ExamCard'

export function HomePage() {
  const navigate = useNavigate()
  const user = useAppStore(state => state.user)
  const sessionToken = useAppStore(state => state.sessionToken)
  const [usageStatus, setUsageStatus] = useState<UsageStatus | null>(null)
  const [recentExams, setRecentExams] = useState<ExamRecord[]>([])
  const [isLoadingExams, setIsLoadingExams] = useState(true)

  // Load recent exams (optimized - only last 24 hours, max 3 exams)
  const loadRecentExams = useCallback(async () => {
    if (!sessionToken || !user) {
      setIsLoadingExams(false)
      return
    }

    try {
      setIsLoadingExams(true)

      // Get only recent exams (last 24 hours, limit 3) - MUCH faster
      const recentExamsResponse = await window.electron.getRecentExams(sessionToken, 3)

      if (recentExamsResponse.success && recentExamsResponse.exams) {
        setRecentExams(recentExamsResponse.exams)
        console.log('[HomePage] Loaded', recentExamsResponse.exams.length, 'recent exams (last 24h)')
      }
    } catch (error) {
      console.error('[HomePage] Failed to load recent exams:', error)
    } finally {
      setIsLoadingExams(false)
    }
  }, [sessionToken, user])


  // Fetch usage status
  useEffect(() => {
    if (!user) return

    const fetchUsageStatus = async () => {
      try {
        const result = await window.electron.groq.getUsageStatus(parseInt(user.id))
        if (result.success) {
          setUsageStatus(result as UsageStatus)
        }
      } catch (error) {
        console.error('[HomePage] Failed to fetch usage status:', error)
      }
    }

    fetchUsageStatus()
  }, [user])

  // Load recent exams
  useEffect(() => {
    loadRecentExams()
  }, [loadRecentExams])

  return (
    <div className="space-y-8">
      {/* Welcome Section */}
      <div>
        <h2 className="text-3xl font-bold tracking-tight min-h-[2.5rem]">
          {user ? `Welcome, ${user.name}!` : 'Welcome to Qreate!'}
        </h2>
        <p className="text-muted-foreground">Create AI-generated exams from your study materials</p>
      </div>

      {/* Usage Quota Banner */}
      {usageStatus ? (
        <Card className="border-green-200 bg-green-50">
          <CardContent className="flex items-center justify-between p-6">
            <div className="flex items-start gap-4">
              <Zap className="h-6 w-6 text-green-600" />
              <div>
                <h3 className="text-lg font-semibold text-green-900">Free AI Exam Generation</h3>
                <p className="text-sm text-green-700">
                  <strong>
                    {Math.max(
                      0,
                      (usageStatus.limits.examsPerWeek || 10) -
                        (usageStatus.usage.examsThisWeek || 0)
                    )}
                    /{usageStatus.limits.examsPerWeek || 10}
                  </strong>{' '}
                  exams remaining this week •{' '}
                  <strong>
                    {Math.max(
                      0,
                      (usageStatus.limits.dailyBurstLimit || 3) -
                        (usageStatus.usage.examsToday || 0)
                    )}
                    /{usageStatus.limits.dailyBurstLimit || 3}
                  </strong>{' '}
                  today • Weekly resets in{' '}
                  {usageStatus.resetTimes.weeklyResetIn && usageStatus.resetTimes.weeklyResetIn > 0
                    ? Math.ceil(usageStatus.resetTimes.weeklyResetIn / (24 * 3600 * 1000))
                    : Math.ceil((7 - new Date().getDay() + 1) % 7 || 7)}{' '}
                  days
                </p>
              </div>
            </div>
            {!usageStatus.canGenerate && (
              <span className="text-sm font-medium text-orange-600">
                {(usageStatus.usage.examsToday || 0) >= (usageStatus.limits.dailyBurstLimit || 3)
                  ? 'Daily Limit Reached'
                  : (usageStatus.usage.examsThisWeek || 0) >=
                      (usageStatus.limits.examsPerWeek || 10)
                    ? 'Weekly Limit Reached'
                    : 'Limit Reached'}
              </span>
            )}
          </CardContent>
        </Card>
      ) : (
        // Skeleton placeholder to prevent layout shift
        <Card className="border-gray-200 bg-gray-50">
          <CardContent className="flex items-center justify-between p-6">
            <div className="flex items-start gap-4">
              <div className="h-6 w-6 bg-gray-300 rounded animate-pulse" />
              <div>
                <div className="h-5 w-40 bg-gray-300 rounded animate-pulse mb-2" />
                <div className="h-4 w-80 bg-gray-300 rounded animate-pulse" />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick Action */}
      <Card className="border-dashed">
        <CardContent className="flex items-center justify-between p-6">
          <div>
            <h3 className="text-lg font-semibold">Create New Exam</h3>
            <p className="text-sm text-muted-foreground">
              Upload your study materials and generate custom exams
            </p>
          </div>
          <Button
            size="lg"
            className="gap-2"
            onClick={() => {
              // Check quota before allowing navigation
              if (usageStatus && !usageStatus.canGenerate) {
                const dailyLimit = usageStatus.limits.dailyBurstLimit || 3
                const weeklyLimit = usageStatus.limits.examsPerWeek || 10
                const examsToday = usageStatus.usage.examsToday || 0

                const reason =
                  examsToday >= dailyLimit
                    ? `Daily limit reached (${dailyLimit}/day). Resets in ${usageStatus.resetTimes.dailyResetIn ? Math.ceil(usageStatus.resetTimes.dailyResetIn / (60 * 60 * 1000)) : 24} hours.`
                    : `Weekly limit reached (${weeklyLimit}/week). Resets in ${usageStatus.resetTimes.weeklyResetIn ? Math.ceil(usageStatus.resetTimes.weeklyResetIn / (24 * 60 * 60 * 1000)) : Math.ceil((7 - new Date().getDay() + 1) % 7 || 7)} days.`
                alert(reason)
              } else {
                navigate('/create-exam')
              }
            }}
            disabled={usageStatus ? !usageStatus.canGenerate : false}
          >
            <Plus className="h-4 w-4" />
            New Exam
          </Button>
        </CardContent>
      </Card>


      {/* Recent Exams */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-2xl font-semibold tracking-tight">Recent Exams</h3>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/my-exams')}
            className="gap-2"
          >
            <ExternalLink className="h-4 w-4" />
            View All
          </Button>
        </div>

        {isLoadingExams ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              <p className="mt-4 text-sm text-muted-foreground">Loading exams...</p>
            </CardContent>
          </Card>
        ) : recentExams.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <FileText className="mb-4 h-12 w-12 text-muted-foreground" />
              <p className="text-center text-sm text-muted-foreground">
                No exams yet. Create your first exam to get started!
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {recentExams.slice(0, 3).map(exam => (
              <ExamCard key={exam.id} exam={exam} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
