/**
 * Database Service
 *
 * Manages SQLite database for Qreate application.
 * Handles user data, exam history, and usage tracking.
 *
 * Why SQLite?
 * - No server required (embedded database)
 * - Fast for local operations
 * - Reliable and battle-tested
 * - Easy to backup (single file)
 * - Perfect for desktop apps
 *
 * Schema:
 * - users: User accounts
 * - user_usage: Daily/monthly exam generation quotas
 * - exams: Generated exam metadata and history
 */

import Database from 'better-sqlite3'
import path from 'path'
import { app } from 'electron'
import * as fs from 'fs'

export interface User {
  id: number
  email: string
  name: string
  password_hash: string
  created_at: string
}

export interface UserUsage {
  user_id: number
  exams_today: number
  exams_this_week: number
  exams_this_month: number
  last_daily_reset: string
  last_weekly_reset: string
  last_monthly_reset: string
  total_exams_generated: number
  last_exam_generated: string | null
}

export interface ExamRecord {
  id: number
  user_id: number
  title: string
  topic: string
  total_questions: number
  file_path: string
  created_at: string
}

export class DatabaseService {
  private db: Database.Database

  constructor() {
    // Get app data path (user's AppData on Windows, ~/Library on Mac, ~/.config on Linux)
    const userDataPath = app.getPath('userData')
    const dbPath = path.join(userDataPath, 'qreate.db')

    console.log('[Database] Opening database at:', dbPath)

    // Ensure directory exists
    if (!fs.existsSync(userDataPath)) {
      fs.mkdirSync(userDataPath, { recursive: true })
    }

    // Open database connection
    this.db = new Database(dbPath)

    // Enable foreign keys
    this.db.pragma('foreign_keys = ON')

    // Initialize schema
    this.initializeSchema()

    console.log('[Database] Initialized successfully')
  }

  /**
   * Check if a column exists in a table
   *
   * @param tableName - Name of the table
   * @param columnName - Name of the column to check
   * @returns true if column exists, false otherwise
   */
  private columnExists(tableName: string, columnName: string): boolean {
    try {
      const result = this.db.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{ name: string }>
      return result.some(column => column.name === columnName)
    } catch (error) {
      console.error(`[Database] Error checking column ${tableName}.${columnName}:`, error)
      return false
    }
  }

  /**
   * Add column to table if it doesn't exist
   *
   * @param tableName - Name of the table
   * @param columnName - Name of the column to add
   * @param columnDefinition - SQL column definition (e.g., "TEXT NOT NULL DEFAULT ''")
   * @returns true if column was added or already exists, false if failed
   */
  private addColumnIfNotExists(tableName: string, columnName: string, columnDefinition: string): boolean {
    try {
      if (this.columnExists(tableName, columnName)) {
        console.log(`[Database] Column ${tableName}.${columnName} already exists`)
        return true
      }

      const sql = `ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDefinition}`
      this.db.exec(sql)
      console.log(`[Database] Successfully added column ${tableName}.${columnName}`)
      return true
    } catch (error) {
      console.error(`[Database] Failed to add column ${tableName}.${columnName}:`, error)
      return false
    }
  }

  /**
   * Initialize database schema
   *
   * Creates tables if they don't exist.
   * Uses IF NOT EXISTS so it's safe to run multiple times.
   */
  private initializeSchema(): void {
    // Users table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL DEFAULT '',
        password_hash TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `)

    // Add name column to existing users table if it doesn't exist (migration)
    this.addColumnIfNotExists('users', 'name', `TEXT NOT NULL DEFAULT ''`)

    // User usage tracking table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS user_usage (
        user_id INTEGER PRIMARY KEY,
        exams_today INTEGER NOT NULL DEFAULT 0,
        exams_this_week INTEGER NOT NULL DEFAULT 0,
        exams_this_month INTEGER NOT NULL DEFAULT 0,
        last_daily_reset TEXT NOT NULL DEFAULT (datetime('now')),
        last_weekly_reset TEXT NOT NULL DEFAULT (datetime('now')),
        last_monthly_reset TEXT NOT NULL DEFAULT (datetime('now')),
        total_exams_generated INTEGER NOT NULL DEFAULT 0,
        last_exam_generated TEXT,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `)

    // Migration: Add new columns for weekly tracking if they don't exist
    const weeklyTrackingSuccess = this.addColumnIfNotExists('user_usage', 'exams_this_week', `INTEGER NOT NULL DEFAULT 0`)
    const weeklyResetSuccess = this.addColumnIfNotExists('user_usage', 'last_weekly_reset', `TEXT NOT NULL DEFAULT ''`)
    const lastExamSuccess = this.addColumnIfNotExists('user_usage', 'last_exam_generated', `TEXT`)

    if (!weeklyTrackingSuccess || !weeklyResetSuccess || !lastExamSuccess) {
      console.warn('[Database] Some user_usage columns could not be added. Weekly tracking may not work properly.')
    }

    // Exams history table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS exams (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        topic TEXT NOT NULL,
        total_questions INTEGER NOT NULL,
        file_path TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `)

    // Create indexes for faster queries
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_exams_user_id ON exams(user_id);
      CREATE INDEX IF NOT EXISTS idx_exams_created_at ON exams(created_at);
    `)

    console.log('[Database] Schema initialized')
    
    // Run database health check
    this.performSchemaHealthCheck()
  }

  /**
   * Perform database schema health check
   * Verifies all expected tables and columns exist
   */
  private performSchemaHealthCheck(): void {
    console.log('[Database] Performing schema health check...')
    
    const expectedTables = ['users', 'user_usage', 'exams']
    const expectedColumns = {
      users: ['id', 'email', 'name', 'password_hash', 'created_at'],
      user_usage: ['user_id', 'exams_today', 'exams_this_week', 'exams_this_month', 'last_daily_reset', 'last_weekly_reset', 'last_monthly_reset', 'total_exams_generated', 'last_exam_generated'],
      exams: ['id', 'user_id', 'title', 'topic', 'total_questions', 'file_path', 'created_at']
    }

    let healthIssues = 0

    // Check tables exist
    for (const tableName of expectedTables) {
      try {
        this.db.prepare(`SELECT 1 FROM ${tableName} LIMIT 1`).get()
        console.log(`[Database] ✓ Table ${tableName} exists`)
      } catch (error) {
        console.error(`[Database] ✗ Table ${tableName} missing or corrupted:`, error)
        healthIssues++
      }
    }

    // Check columns exist
    for (const [tableName, columns] of Object.entries(expectedColumns)) {
      for (const columnName of columns) {
        if (this.columnExists(tableName, columnName)) {
          console.log(`[Database] ✓ Column ${tableName}.${columnName} exists`)
        } else {
          console.warn(`[Database] ⚠ Column ${tableName}.${columnName} missing`)
          healthIssues++
        }
      }
    }

    if (healthIssues === 0) {
      console.log('[Database] ✅ Schema health check passed - all tables and columns present')
    } else {
      console.warn(`[Database] ⚠ Schema health check found ${healthIssues} issues - some features may not work properly`)
    }
  }

  /**
   * Get or create user usage record
   *
   * Ensures a usage record exists for the user.
   * Resets daily/monthly counters if needed.
   * Handles missing columns gracefully by attempting to add them.
   *
   * @param userId - User ID
   * @returns User usage record
   */
  getUserUsage(userId: number): UserUsage {
    // Ensure all required columns exist before querying
    const hasWeeklyTracking = this.columnExists('user_usage', 'exams_this_week')
    const hasWeeklyReset = this.columnExists('user_usage', 'last_weekly_reset')
    const hasLastExam = this.columnExists('user_usage', 'last_exam_generated')

    // Attempt to add missing columns if needed
    if (!hasWeeklyTracking) {
      this.addColumnIfNotExists('user_usage', 'exams_this_week', `INTEGER NOT NULL DEFAULT 0`)
    }
    if (!hasWeeklyReset) {
      this.addColumnIfNotExists('user_usage', 'last_weekly_reset', `TEXT NOT NULL DEFAULT ''`)
    }
    if (!hasLastExam) {
      this.addColumnIfNotExists('user_usage', 'last_exam_generated', `TEXT`)
    }
    // Get existing record
    const stmt = this.db.prepare(`
      SELECT * FROM user_usage WHERE user_id = ?
    `)
    let usage = stmt.get(userId) as UserUsage | undefined

    // Create if doesn't exist
    if (!usage) {
      const now = new Date().toISOString()
      this.db
        .prepare(
          `
        INSERT INTO user_usage (
          user_id, exams_today, exams_this_week, exams_this_month, 
          last_daily_reset, last_weekly_reset, last_monthly_reset, 
          total_exams_generated, last_exam_generated
        )
        VALUES (?, 0, 0, 0, ?, ?, ?, 0, NULL)
      `
        )
        .run(userId, now, now, now)

      usage = {
        user_id: userId,
        exams_today: 0,
        exams_this_week: 0,
        exams_this_month: 0,
        last_daily_reset: now,
        last_weekly_reset: now,
        last_monthly_reset: now,
        total_exams_generated: 0,
        last_exam_generated: null,
      }
    }

    // Fix empty weekly reset values from migration (SQLite doesn't allow datetime('now') defaults for ALTER TABLE)
    if (!usage.last_weekly_reset || usage.last_weekly_reset === '') {
      const now = new Date().toISOString()
      this.db
        .prepare(
          `
        UPDATE user_usage
        SET last_weekly_reset = ?
        WHERE user_id = ?
      `
        )
        .run(now, userId)
      
      usage.last_weekly_reset = now
      console.log('[Database] Initialized empty last_weekly_reset for user:', userId)
    }

    // Check if daily reset needed
    const lastDailyReset = new Date(usage.last_daily_reset)
    const now = new Date()

    // Reset if it's a new day (UTC)
    if (
      now.getUTCDate() !== lastDailyReset.getUTCDate() ||
      now.getUTCMonth() !== lastDailyReset.getUTCMonth() ||
      now.getUTCFullYear() !== lastDailyReset.getUTCFullYear()
    ) {
      this.db
        .prepare(
          `
        UPDATE user_usage
        SET exams_today = 0, last_daily_reset = ?
        WHERE user_id = ?
      `
        )
        .run(now.toISOString(), userId)

      usage.exams_today = 0
      usage.last_daily_reset = now.toISOString()
      console.log('[Database] Daily usage reset for user:', userId)
    }

    // Check if weekly reset needed (Monday at 00:00 UTC)
    const lastWeeklyReset = new Date(usage.last_weekly_reset)
    const currentWeekStart = new Date(now)
    currentWeekStart.setUTCDate(now.getUTCDate() - now.getUTCDay() + 1) // Monday
    currentWeekStart.setUTCHours(0, 0, 0, 0)
    
    const lastWeekStart = new Date(lastWeeklyReset)
    lastWeekStart.setUTCDate(lastWeeklyReset.getUTCDate() - lastWeeklyReset.getUTCDay() + 1)
    lastWeekStart.setUTCHours(0, 0, 0, 0)

    if (currentWeekStart.getTime() > lastWeekStart.getTime()) {
      this.db
        .prepare(
          `
        UPDATE user_usage
        SET exams_this_week = 0, last_weekly_reset = ?
        WHERE user_id = ?
      `
        )
        .run(now.toISOString(), userId)

      usage.exams_this_week = 0
      usage.last_weekly_reset = now.toISOString()
      console.log('[Database] Weekly usage reset for user:', userId)
    }

    // Check if monthly reset needed
    const lastMonthlyReset = new Date(usage.last_monthly_reset)

    // Reset if it's a new month
    if (
      now.getUTCMonth() !== lastMonthlyReset.getUTCMonth() ||
      now.getUTCFullYear() !== lastMonthlyReset.getUTCFullYear()
    ) {
      this.db
        .prepare(
          `
        UPDATE user_usage
        SET exams_this_month = 0, last_monthly_reset = ?
        WHERE user_id = ?
      `
        )
        .run(now.toISOString(), userId)

      usage.exams_this_month = 0
      usage.last_monthly_reset = now.toISOString()
      console.log('[Database] Monthly usage reset for user:', userId)
    }

    return usage
  }

  /**
   * Record exam generation
   *
   * Increments usage counters after successful exam generation.
   *
   * @param userId - User ID
   */
  recordExamGeneration(userId: number): void {
    // Ensure usage record exists (with auto-reset)
    this.getUserUsage(userId)

    const now = new Date().toISOString()

    // Increment counters and update last exam timestamp
    this.db
      .prepare(
        `
      UPDATE user_usage
      SET exams_today = exams_today + 1,
          exams_this_week = exams_this_week + 1,
          exams_this_month = exams_this_month + 1,
          total_exams_generated = total_exams_generated + 1,
          last_exam_generated = ?
      WHERE user_id = ?
    `
      )
      .run(now, userId)

    console.log('[Database] Exam generation recorded for user:', userId)
  }

  /**
   * Save exam to history
   *
   * @param userId - User ID
   * @param title - Exam title
   * @param topic - Exam topic
   * @param totalQuestions - Number of questions
   * @param filePath - Path to saved PDF
   * @returns Exam ID
   */
  saveExam(
    userId: number,
    title: string,
    topic: string,
    totalQuestions: number,
    filePath: string
  ): number {
    const result = this.db
      .prepare(
        `
      INSERT INTO exams (user_id, title, topic, total_questions, file_path)
      VALUES (?, ?, ?, ?, ?)
    `
      )
      .run(userId, title, topic, totalQuestions, filePath)

    console.log('[Database] Exam saved:', result.lastInsertRowid)
    return result.lastInsertRowid as number
  }

  /**
   * Get exam history for user
   *
   * @param userId - User ID
   * @param limit - Max number of results (default: 50)
   * @returns Array of exam records
   */
  getExamHistory(userId: number, limit: number = 50): ExamRecord[] {
    const stmt = this.db.prepare(`
      SELECT * FROM exams
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT ?
    `)

    return stmt.all(userId, limit) as ExamRecord[]
  }

  /**
   * Get recent exams for user (last 24 hours only)
   * Optimized for homepage display - reduces memory usage
   *
   * @param userId - User ID
   * @param limit - Max number of results (default: 10)
   * @returns Array of recent exam records
   */
  getRecentExams(userId: number, limit: number = 10): ExamRecord[] {
    const twentyFourHoursAgo = new Date()
    twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24)
    
    const stmt = this.db.prepare(`
      SELECT * FROM exams
      WHERE user_id = ? AND created_at >= ?
      ORDER BY created_at DESC
      LIMIT ?
    `)

    return stmt.all(userId, twentyFourHoursAgo.toISOString(), limit) as ExamRecord[]
  }

  /**
   * Get exam statistics without loading full records
   * Much faster than loading all exams and calculating on client
   *
   * @param userId - User ID
   * @returns Aggregated exam statistics
   */
  getExamStats(userId: number): {
    total: number
    thisWeek: number
    thisMonth: number
    today: number
  } {
    // Calculate date boundaries
    const now = new Date()
    
    // Today (start of day)
    const startOfToday = new Date(now)
    startOfToday.setHours(0, 0, 0, 0)
    
    // This week (Monday start)
    const startOfWeek = new Date(now)
    const dayOfWeek = now.getDay()
    const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1
    startOfWeek.setDate(now.getDate() - daysFromMonday)
    startOfWeek.setHours(0, 0, 0, 0)
    
    // This month
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    startOfMonth.setHours(0, 0, 0, 0)

    // Execute optimized count queries
    const totalStmt = this.db.prepare(`SELECT COUNT(*) as count FROM exams WHERE user_id = ?`)
    const weekStmt = this.db.prepare(`SELECT COUNT(*) as count FROM exams WHERE user_id = ? AND created_at >= ?`)
    const monthStmt = this.db.prepare(`SELECT COUNT(*) as count FROM exams WHERE user_id = ? AND created_at >= ?`)
    const todayStmt = this.db.prepare(`SELECT COUNT(*) as count FROM exams WHERE user_id = ? AND created_at >= ?`)

    const total = (totalStmt.get(userId) as { count: number }).count
    const thisWeek = (weekStmt.get(userId, startOfWeek.toISOString()) as { count: number }).count
    const thisMonth = (monthStmt.get(userId, startOfMonth.toISOString()) as { count: number }).count
    const today = (todayStmt.get(userId, startOfToday.toISOString()) as { count: number }).count

    return { total, thisWeek, thisMonth, today }
  }

  /**
   * Get exam history with pagination
   * For MyExamsPage to handle large exam histories efficiently
   *
   * @param userId - User ID
   * @param page - Page number (1-based)
   * @param pageSize - Number of exams per page (default: 15)
   * @returns Paginated exam records with total count
   */
  getExamHistoryPaginated(userId: number, page: number = 1, pageSize: number = 15): {
    exams: ExamRecord[]
    totalCount: number
    currentPage: number
    totalPages: number
  } {
    // Get total count
    const countStmt = this.db.prepare(`SELECT COUNT(*) as count FROM exams WHERE user_id = ?`)
    const totalCount = (countStmt.get(userId) as { count: number }).count
    const totalPages = Math.ceil(totalCount / pageSize)

    // Get paginated exams
    const offset = (page - 1) * pageSize
    const stmt = this.db.prepare(`
      SELECT * FROM exams
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `)

    const exams = stmt.all(userId, pageSize, offset) as ExamRecord[]

    return {
      exams,
      totalCount,
      currentPage: page,
      totalPages
    }
  }

  /**
   * Clean up old exam metadata (keep records but mark as archived)
   * Helps maintain database performance over time
   *
   * @param olderThanDays - Archive exams older than N days (default: 90)
   * @returns Number of exams archived
   */
  cleanupOldExams(olderThanDays: number = 90): number {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays)

    // For now, just log how many would be cleaned up
    // Future enhancement: add 'archived' column to exams table
    const countStmt = this.db.prepare(`
      SELECT COUNT(*) as count FROM exams 
      WHERE created_at < ?
    `)
    
    const oldExamsCount = (countStmt.get(cutoffDate.toISOString()) as { count: number }).count
    
    if (oldExamsCount > 0) {
      console.log(`[Database] Found ${oldExamsCount} exams older than ${olderThanDays} days that could be archived`)
    }
    
    return oldExamsCount
  }

  /**
   * Get user by email
   *
   * @param email - User email
   * @returns User record or undefined
   */
  getUserByEmail(email: string): User | undefined {
    const stmt = this.db.prepare(`
      SELECT * FROM users WHERE email = ?
    `)
    return stmt.get(email) as User | undefined
  }

  /**
   * Get user by ID
   *
   * @param userId - User ID
   * @returns User object or undefined if not found
   */
  getUserById(userId: number): User | undefined {
    const stmt = this.db.prepare(`
      SELECT * FROM users WHERE id = ?
    `)
    return stmt.get(userId) as User | undefined
  }

  /**
   * Create new user
   *
   * @param email - User email
   * @param name - User's full name
   * @param passwordHash - Bcrypt password hash
   * @returns User ID
   */
  createUser(email: string, name: string, passwordHash: string): number {
    const result = this.db
      .prepare(
        `
      INSERT INTO users (email, name, password_hash)
      VALUES (?, ?, ?)
    `
      )
      .run(email, name, passwordHash)

    const userId = result.lastInsertRowid as number
    console.log('[Database] User created:', userId)

    // Create usage record
    this.getUserUsage(userId)

    return userId
  }

  /**
   * Close database connection
   *
   * Call this when app is closing
   */
  close(): void {
    this.db.close()
    console.log('[Database] Connection closed')
  }
}
