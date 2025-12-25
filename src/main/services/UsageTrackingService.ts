/**
 * Usage Tracking Service
 *
 * Enforces per-user quotas for exam generation using Groq backend.
 *
 * User Limits (Free Tier):
 * - 10 exams per week
 * - 3 exams per day (burst protection)
 * - 40 exams per month
 * - 10-100 questions per exam
 * - 30 seconds between exam generations (rate limiting)
 *
 * Why quotas?
 * - Prevents abuse of free backend service
 * - Ensures fair usage across all users
 * - Protects against hitting Groq's API limits
 * - Sustainable for free tier offering
 *
 * Implementation:
 * - Uses SQLite database for persistence
 * - Auto-resets daily at midnight UTC
 * - Auto-resets monthly on 1st of month
 * - Tracks total exams generated (analytics)
 */

import { DatabaseService } from './DatabaseService'

export interface UsageQuotas {
  examsPerWeek: number
  dailyBurstLimit: number
  examsPerMonth: number
  minQuestionsPerExam: number
  maxQuestionsPerExam: number
  rateLimitDelaySeconds: number
}

export interface UsageStatus {
  canGenerate: boolean
  reason?: string
  usage: {
    examsToday: number
    examsThisWeek: number
    examsThisMonth: number
    totalExams: number
  }
  limits: UsageQuotas
  resetTimes: {
    dailyResetIn: number // milliseconds
    weeklyResetIn: number // milliseconds
    monthlyResetIn: number // milliseconds
  }
  rateLimitInfo?: {
    mustWaitSeconds: number
    lastExamGenerated: string | null
  }
}

export class UsageTrackingService {
  private db: DatabaseService
  private readonly quotas: UsageQuotas

  constructor(db: DatabaseService) {
    this.db = db

    // Load quotas from environment variables with fallback defaults
    this.quotas = {
      examsPerWeek: parseInt(process.env.MAX_EXAMS_PER_WEEK || '10'),
      dailyBurstLimit: parseInt(process.env.DAILY_BURST_LIMIT || '3'),
      examsPerMonth: parseInt(process.env.MAX_EXAMS_PER_MONTH || '40'),
      minQuestionsPerExam: parseInt(process.env.MIN_QUESTIONS_PER_EXAM || '10'),
      maxQuestionsPerExam: parseInt(process.env.MAX_QUESTIONS_PER_EXAM || '100'),
      rateLimitDelaySeconds: parseInt(process.env.RATE_LIMIT_DELAY_SECONDS || '30'),
    }

    // Override for stress testing only (not automatic in development)
    if (process.env.ENABLE_STRESS_TESTING === 'true') {
      this.quotas.examsPerWeek = 700
      this.quotas.dailyBurstLimit = 100
      this.quotas.examsPerMonth = 3000
      this.quotas.rateLimitDelaySeconds = 0
      console.log('[UsageTracking] Stress testing mode enabled - quotas increased')
    } else {
      console.log('[UsageTracking] Production quotas enabled - normal user limits')
    }

    console.log('[UsageTracking] Initialized with quotas:', this.quotas)
  }

  /**
   * Check if user can generate an exam
   *
   * Verifies daily and monthly quotas.
   * Returns detailed status with usage stats.
   *
   * @param userId - User ID
   * @param questionCount - Number of questions in exam
   * @returns Usage status with permission and details
   */
  checkUsage(userId: number, questionCount: number): UsageStatus {
    // Get current usage (with auto-reset if needed)
    const usage = this.db.getUserUsage(userId)

    // Check question count limits
    if (questionCount < this.quotas.minQuestionsPerExam) {
      return {
        canGenerate: false,
        reason: `Minimum ${this.quotas.minQuestionsPerExam} questions required`,
        usage: {
          examsToday: usage.exams_today,
          examsThisWeek: usage.exams_this_week,
          examsThisMonth: usage.exams_this_month,
          totalExams: usage.total_exams_generated,
        },
        limits: this.quotas,
        resetTimes: this.calculateResetTimes(usage),
      }
    }

    if (questionCount > this.quotas.maxQuestionsPerExam) {
      return {
        canGenerate: false,
        reason: `Maximum ${this.quotas.maxQuestionsPerExam} questions allowed`,
        usage: {
          examsToday: usage.exams_today,
          examsThisWeek: usage.exams_this_week,
          examsThisMonth: usage.exams_this_month,
          totalExams: usage.total_exams_generated,
        },
        limits: this.quotas,
        resetTimes: this.calculateResetTimes(usage),
      }
    }

    // Check rate limiting (must wait between exams)
    const rateLimitInfo = this.checkRateLimit(usage.last_exam_generated)
    if (rateLimitInfo.mustWaitSeconds > 0) {
      return {
        canGenerate: false,
        reason: `Please wait ${rateLimitInfo.mustWaitSeconds} seconds before generating another exam`,
        usage: {
          examsToday: usage.exams_today,
          examsThisWeek: usage.exams_this_week,
          examsThisMonth: usage.exams_this_month,
          totalExams: usage.total_exams_generated,
        },
        limits: this.quotas,
        resetTimes: this.calculateResetTimes(usage),
        rateLimitInfo,
      }
    }

    // Check daily burst limit
    if (usage.exams_today >= this.quotas.dailyBurstLimit) {
      const resetTime = this.calculateResetTimes(usage)
      const hoursUntilReset = Math.ceil(resetTime.dailyResetIn / 3600000)

      return {
        canGenerate: false,
        reason: `Daily limit reached (${this.quotas.dailyBurstLimit} exams per day). Resets in ${hoursUntilReset} hours.`,
        usage: {
          examsToday: usage.exams_today,
          examsThisWeek: usage.exams_this_week,
          examsThisMonth: usage.exams_this_month,
          totalExams: usage.total_exams_generated,
        },
        limits: this.quotas,
        resetTimes: resetTime,
      }
    }

    // Check weekly quota
    if (usage.exams_this_week >= this.quotas.examsPerWeek) {
      const resetTime = this.calculateResetTimes(usage)
      const daysUntilReset = Math.ceil(resetTime.weeklyResetIn / 86400000)

      return {
        canGenerate: false,
        reason: `Weekly limit reached (${this.quotas.examsPerWeek} exams per week). Resets in ${daysUntilReset} days.`,
        usage: {
          examsToday: usage.exams_today,
          examsThisWeek: usage.exams_this_week,
          examsThisMonth: usage.exams_this_month,
          totalExams: usage.total_exams_generated,
        },
        limits: this.quotas,
        resetTimes: resetTime,
      }
    }

    // Check monthly quota
    if (usage.exams_this_month >= this.quotas.examsPerMonth) {
      const resetTime = this.calculateResetTimes(usage)
      const daysUntilReset = Math.ceil(resetTime.monthlyResetIn / 86400000)

      return {
        canGenerate: false,
        reason: `Monthly limit reached (${this.quotas.examsPerMonth} exams). Resets in ${daysUntilReset} days.`,
        usage: {
          examsToday: usage.exams_today,
          examsThisWeek: usage.exams_this_week,
          examsThisMonth: usage.exams_this_month,
          totalExams: usage.total_exams_generated,
        },
        limits: this.quotas,
        resetTimes: resetTime,
      }
    }

    // User can generate
    return {
      canGenerate: true,
      usage: {
        examsToday: usage.exams_today,
        examsThisWeek: usage.exams_this_week,
        examsThisMonth: usage.exams_this_month,
        totalExams: usage.total_exams_generated,
      },
      limits: this.quotas,
      resetTimes: this.calculateResetTimes(usage),
      rateLimitInfo,
    }
  }

  /**
   * Record successful exam generation
   *
   * Call this AFTER successful exam creation.
   * Increments usage counters.
   *
   * @param userId - User ID
   */
  recordExamGeneration(userId: number): void {
    this.db.recordExamGeneration(userId)
    console.log('[UsageTracking] Exam generation recorded for user:', userId)
  }

  /**
   * Get usage status without checking quotas
   *
   * Useful for displaying current usage in UI.
   *
   * @param userId - User ID
   * @returns Current usage status
   */
  getUsageStatus(userId: number): UsageStatus {
    const usage = this.db.getUserUsage(userId)
    const rateLimitInfo = this.checkRateLimit(usage.last_exam_generated)

    return {
      canGenerate: true, // Not checking limits, just showing status
      usage: {
        examsToday: usage.exams_today,
        examsThisWeek: usage.exams_this_week,
        examsThisMonth: usage.exams_this_month,
        totalExams: usage.total_exams_generated,
      },
      limits: this.quotas,
      resetTimes: this.calculateResetTimes(usage),
      rateLimitInfo,
    }
  }

  /**
   * Check rate limiting between exam generations
   */
  private checkRateLimit(lastExamGenerated: string | null): {
    mustWaitSeconds: number
    lastExamGenerated: string | null
  } {
    if (!lastExamGenerated || this.quotas.rateLimitDelaySeconds === 0) {
      return {
        mustWaitSeconds: 0,
        lastExamGenerated,
      }
    }

    const now = Date.now()
    const lastExamTime = new Date(lastExamGenerated).getTime()
    const timeSinceLastExam = now - lastExamTime
    const requiredDelay = this.quotas.rateLimitDelaySeconds * 1000

    const mustWaitSeconds = Math.max(0, Math.ceil((requiredDelay - timeSinceLastExam) / 1000))

    return {
      mustWaitSeconds,
      lastExamGenerated,
    }
  }

  /**
   * Calculate time until daily, weekly, and monthly resets
   */
  private calculateResetTimes(_usage: {
    last_daily_reset: string
    last_weekly_reset: string
    last_monthly_reset: string
  }): {
    dailyResetIn: number
    weeklyResetIn: number
    monthlyResetIn: number
  } {
    const now = new Date()

    // Calculate next day reset (midnight UTC)
    const nextDayReset = new Date()
    nextDayReset.setUTCDate(now.getUTCDate() + 1)
    nextDayReset.setUTCHours(0, 0, 0, 0)

    // Calculate next week reset (Monday at midnight UTC)
    const nextWeekReset = new Date()
    const currentDay = now.getUTCDay() // 0 = Sunday, 1 = Monday, etc.
    const daysUntilMonday = currentDay === 0 ? 1 : 8 - currentDay // Days until next Monday
    nextWeekReset.setUTCDate(now.getUTCDate() + daysUntilMonday)
    nextWeekReset.setUTCHours(0, 0, 0, 0)

    // Calculate next month reset (1st of next month at midnight UTC)
    const nextMonthReset = new Date()
    nextMonthReset.setUTCMonth(now.getUTCMonth() + 1, 1)
    nextMonthReset.setUTCHours(0, 0, 0, 0)

    return {
      dailyResetIn: Math.max(0, nextDayReset.getTime() - now.getTime()),
      weeklyResetIn: Math.max(0, nextWeekReset.getTime() - now.getTime()),
      monthlyResetIn: Math.max(0, nextMonthReset.getTime() - now.getTime()),
    }
  }
}
