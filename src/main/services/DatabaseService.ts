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
    try {
      this.db.exec(`
        ALTER TABLE users ADD COLUMN name TEXT NOT NULL DEFAULT ''
      `)
      console.log('[Database] Added name column to users table')
    } catch {
      // Column already exists or other error - this is expected for new installations
      // SQLite will throw "duplicate column name" error if column exists
    }

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
    try {
      this.db.exec(`ALTER TABLE user_usage ADD COLUMN exams_this_week INTEGER NOT NULL DEFAULT 0`)
      console.log('[Database] Added exams_this_week column to user_usage table')
    } catch {
      // Column already exists
    }

    try {
      this.db.exec(`ALTER TABLE user_usage ADD COLUMN last_weekly_reset TEXT NOT NULL DEFAULT (datetime('now'))`)
      console.log('[Database] Added last_weekly_reset column to user_usage table')
    } catch {
      // Column already exists
    }

    try {
      this.db.exec(`ALTER TABLE user_usage ADD COLUMN last_exam_generated TEXT`)
      console.log('[Database] Added last_exam_generated column to user_usage table')
    } catch {
      // Column already exists
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
  }

  /**
   * Get or create user usage record
   *
   * Ensures a usage record exists for the user.
   * Resets daily/monthly counters if needed.
   *
   * @param userId - User ID
   * @returns User usage record
   */
  getUserUsage(userId: number): UserUsage {
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
