/**
 * Usage Tracking Service
 *
 * Enforces per-user quotas for exam generation using Groq backend.
 *
 * User Limits (Free Tier):
 * - 10 exams per day
 * - 100 exams per month
 * - 10-100 questions per exam
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
  examsPerDay: number
  examsPerMonth: number
  minQuestionsPerExam: number
  maxQuestionsPerExam: number
}

export interface UsageStatus {
  canGenerate: boolean
  reason?: string
  usage: {
    examsToday: number
    examsThisMonth: number
    totalExams: number
  }
  limits: UsageQuotas
  resetTimes: {
    dailyResetIn: number // milliseconds
    monthlyResetIn: number // milliseconds
  }
}

export class UsageTrackingService {
  private db: DatabaseService
  private readonly quotas: UsageQuotas

  constructor(db: DatabaseService) {
    this.db = db

    // Load quotas from environment variables with fallback defaults
    this.quotas = {
      examsPerDay: parseInt(process.env.MAX_EXAMS_PER_DAY || '10'),
      examsPerMonth: parseInt(process.env.MAX_EXAMS_PER_MONTH || '100'),
      minQuestionsPerExam: parseInt(process.env.MIN_QUESTIONS_PER_EXAM || '10'),
      maxQuestionsPerExam: parseInt(process.env.MAX_QUESTIONS_PER_EXAM || '100'),
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
          examsThisMonth: usage.exams_this_month,
          totalExams: usage.total_exams_generated,
        },
        limits: this.quotas,
        resetTimes: this.calculateResetTimes(usage.last_daily_reset, usage.last_monthly_reset),
      }
    }

    if (questionCount > this.quotas.maxQuestionsPerExam) {
      return {
        canGenerate: false,
        reason: `Maximum ${this.quotas.maxQuestionsPerExam} questions allowed`,
        usage: {
          examsToday: usage.exams_today,
          examsThisMonth: usage.exams_this_month,
          totalExams: usage.total_exams_generated,
        },
        limits: this.quotas,
        resetTimes: this.calculateResetTimes(usage.last_daily_reset, usage.last_monthly_reset),
      }
    }

    // Check daily quota
    if (usage.exams_today >= this.quotas.examsPerDay) {
      const resetTime = this.calculateResetTimes(usage.last_daily_reset, usage.last_monthly_reset)
      const hoursUntilReset = Math.ceil(resetTime.dailyResetIn / 3600000)

      return {
        canGenerate: false,
        reason: `Daily limit reached (${this.quotas.examsPerDay} exams). Resets in ${hoursUntilReset} hours.`,
        usage: {
          examsToday: usage.exams_today,
          examsThisMonth: usage.exams_this_month,
          totalExams: usage.total_exams_generated,
        },
        limits: this.quotas,
        resetTimes: resetTime,
      }
    }

    // Check monthly quota
    if (usage.exams_this_month >= this.quotas.examsPerMonth) {
      const resetTime = this.calculateResetTimes(usage.last_daily_reset, usage.last_monthly_reset)
      const daysUntilReset = Math.ceil(resetTime.monthlyResetIn / 86400000)

      return {
        canGenerate: false,
        reason: `Monthly limit reached (${this.quotas.examsPerMonth} exams). Resets in ${daysUntilReset} days.`,
        usage: {
          examsToday: usage.exams_today,
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
        examsThisMonth: usage.exams_this_month,
        totalExams: usage.total_exams_generated,
      },
      limits: this.quotas,
      resetTimes: this.calculateResetTimes(usage.last_daily_reset, usage.last_monthly_reset),
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

    return {
      canGenerate: true, // Not checking limits, just showing status
      usage: {
        examsToday: usage.exams_today,
        examsThisMonth: usage.exams_this_month,
        totalExams: usage.total_exams_generated,
      },
      limits: this.quotas,
      resetTimes: this.calculateResetTimes(usage.last_daily_reset, usage.last_monthly_reset),
    }
  }

  /**
   * Calculate time until daily and monthly resets
   *
   * @param lastDailyReset - Last daily reset timestamp (ISO string)
   * @param lastMonthlyReset - Last monthly reset timestamp (ISO string)
   * @returns Milliseconds until each reset
   */
  private calculateResetTimes(
    lastDailyReset: string,
    lastMonthlyReset: string
  ): {
    dailyResetIn: number
    monthlyResetIn: number
  } {
    const now = new Date()

    // Calculate next day reset (midnight UTC)
    const nextDayReset = new Date(lastDailyReset)
    nextDayReset.setUTCDate(nextDayReset.getUTCDate() + 1)
    nextDayReset.setUTCHours(0, 0, 0, 0)

    // Calculate next month reset (1st of next month at midnight UTC)
    const nextMonthReset = new Date(lastMonthlyReset)
    nextMonthReset.setUTCMonth(nextMonthReset.getUTCMonth() + 1)
    nextMonthReset.setUTCDate(1)
    nextMonthReset.setUTCHours(0, 0, 0, 0)

    return {
      dailyResetIn: Math.max(0, nextDayReset.getTime() - now.getTime()),
      monthlyResetIn: Math.max(0, nextMonthReset.getTime() - now.getTime()),
    }
  }
}
