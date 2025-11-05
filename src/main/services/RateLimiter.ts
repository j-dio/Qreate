/**
 * Rate Limiter Service
 *
 * Prevents hitting Groq API rate limits by tracking and throttling requests.
 *
 * Groq Rate Limits:
 * - 30 requests per minute
 * - 14,400 requests per day
 *
 * Implementation:
 * - Token bucket algorithm (simple and effective)
 * - Tracks requests per minute and per day
 * - Blocks requests if limits would be exceeded
 * - Auto-resets buckets when time windows pass
 */

export class RateLimiter {
  // Minute bucket
  private requestsThisMinute: number = 0
  private minuteResetTime: number = Date.now() + 60000

  // Day bucket
  private requestsToday: number = 0
  private dayResetTime: number = this.getNextDayReset()

  // Limits (leave some buffer for safety)
  private readonly MAX_PER_MINUTE = 25 // Groq allows 30, use 25 for safety
  private readonly MAX_PER_DAY = 14000 // Groq allows 14,400, use 14,000 for safety

  /**
   * Check if a request can be made
   *
   * @returns { allowed: boolean, reason?: string }
   */
  canMakeRequest(): { allowed: boolean; reason?: string } {
    // Reset minute bucket if needed
    if (Date.now() >= this.minuteResetTime) {
      this.requestsThisMinute = 0
      this.minuteResetTime = Date.now() + 60000
      console.log('[RateLimiter] Minute bucket reset')
    }

    // Reset day bucket if needed
    if (Date.now() >= this.dayResetTime) {
      this.requestsToday = 0
      this.dayResetTime = this.getNextDayReset()
      console.log('[RateLimiter] Day bucket reset')
    }

    // Check minute limit
    if (this.requestsThisMinute >= this.MAX_PER_MINUTE) {
      const secondsUntilReset = Math.ceil((this.minuteResetTime - Date.now()) / 1000)
      return {
        allowed: false,
        reason: `Rate limit: Too many requests this minute. Try again in ${secondsUntilReset} seconds.`,
      }
    }

    // Check day limit
    if (this.requestsToday >= this.MAX_PER_DAY) {
      const hoursUntilReset = Math.ceil((this.dayResetTime - Date.now()) / 3600000)
      return {
        allowed: false,
        reason: `Daily limit reached (${this.MAX_PER_DAY} requests). Resets in ${hoursUntilReset} hours.`,
      }
    }

    return { allowed: true }
  }

  /**
   * Record a request
   *
   * Call this AFTER a successful API call to increment counters.
   */
  recordRequest(): void {
    this.requestsThisMinute++
    this.requestsToday++

    console.log('[RateLimiter] Request recorded:', {
      thisMinute: this.requestsThisMinute,
      today: this.requestsToday,
      minuteLimit: this.MAX_PER_MINUTE,
      dayLimit: this.MAX_PER_DAY,
    })
  }

  /**
   * Get current usage stats
   */
  getStats(): {
    requestsThisMinute: number
    maxPerMinute: number
    requestsToday: number
    maxPerDay: number
    minuteResetIn: number
    dayResetIn: number
  } {
    return {
      requestsThisMinute: this.requestsThisMinute,
      maxPerMinute: this.MAX_PER_MINUTE,
      requestsToday: this.requestsToday,
      maxPerDay: this.MAX_PER_DAY,
      minuteResetIn: Math.max(0, this.minuteResetTime - Date.now()),
      dayResetIn: Math.max(0, this.dayResetTime - Date.now()),
    }
  }

  /**
   * Calculate next day reset time (midnight UTC)
   */
  private getNextDayReset(): number {
    const now = new Date()
    const tomorrow = new Date(now)
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1)
    tomorrow.setUTCHours(0, 0, 0, 0)
    return tomorrow.getTime()
  }
}
