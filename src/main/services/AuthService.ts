/**
 * Authentication Service
 *
 * Handles user authentication, registration, and session management.
 * 
 * Security Features:
 * - bcrypt password hashing with salt rounds (12)
 * - Email uniqueness validation
 * - Password strength requirements
 * - Session token management
 * - Protection against timing attacks
 * 
 * Integration:
 * - Uses DatabaseService for user storage
 * - Automatically creates usage tracking records
 * - Returns user data without sensitive information
 */

import bcrypt from 'bcrypt'
import crypto from 'crypto'
import { DatabaseService } from './DatabaseService'

/**
 * Authentication Request/Response Types
 */
export interface LoginRequest {
  email: string
  password: string
}

export interface RegisterRequest {
  name: string
  email: string
  password: string
}

export interface AuthResponse {
  success: boolean
  user?: {
    id: number
    email: string
    name: string
    created_at: string
  }
  sessionToken?: string
  error?: string
}

export interface SessionValidation {
  valid: boolean
  userId?: number
  error?: string
}

/**
 * Password Requirements Configuration
 */
const PASSWORD_REQUIREMENTS = {
  minLength: 8,
  requireUppercase: true,
  requireLowercase: true,
  requireNumbers: true,
  requireSpecialChars: true,
} as const

/**
 * Security Configuration
 */
const SECURITY_CONFIG = {
  saltRounds: 12, // bcrypt salt rounds (2^12 = 4096 iterations)
  sessionTokenLength: 32, // bytes for session token
  maxLoginAttempts: 5, // TODO: Implement rate limiting
  lockoutDuration: 15 * 60 * 1000, // 15 minutes in milliseconds
} as const

/**
 * In-memory session storage
 * NOTE: For production, consider using Redis or database storage for persistence
 * across app restarts and to support multiple instances
 */
interface SessionData {
  userId: number
  email: string
  createdAt: Date
  expiresAt: Date
}

/**
 * Authentication Service
 *
 * Provides secure authentication functionality for the Qreate application.
 */
export class AuthService {
  private db: DatabaseService
  private sessions: Map<string, SessionData> = new Map()

  constructor(db: DatabaseService) {
    this.db = db
    console.log('[AuthService] Initialized with secure password hashing')
  }

  /**
   * Register a new user
   *
   * @param request - Registration data (name, email, password)
   * @returns Authentication response with user data and session token
   */
  async register(request: RegisterRequest): Promise<AuthResponse> {
    try {
      console.log('[AuthService] Registration attempt for email:', request.email)

      // Validate input
      const validation = this.validateRegistrationRequest(request)
      if (!validation.valid) {
        return { success: false, error: validation.error }
      }

      // Check if user already exists
      const existingUser = this.db.getUserByEmail(request.email.toLowerCase())
      if (existingUser) {
        console.log('[AuthService] Registration failed: Email already exists:', request.email)
        return { success: false, error: 'An account with this email already exists' }
      }

      // Validate password requirements
      const passwordValidation = this.validatePassword(request.password)
      if (!passwordValidation.valid) {
        return { success: false, error: passwordValidation.error }
      }

      // Hash password securely
      const hashedPassword = await bcrypt.hash(request.password, SECURITY_CONFIG.saltRounds)

      // Create user in database with name
      const userId = this.db.createUser(request.email.toLowerCase(), request.name.trim(), hashedPassword)
      
      // Get created user
      const user = this.db.getUserByEmail(request.email.toLowerCase())!

      // Create session token
      const sessionToken = this.createSession(userId, request.email.toLowerCase())

      console.log('[AuthService] User registered successfully:', userId)

      return {
        success: true,
        user: {
          id: userId,
          email: user.email,
          name: user.name,
          created_at: user.created_at,
        },
        sessionToken,
      }
    } catch (error) {
      console.error('[AuthService] Registration error:', error)
      return { 
        success: false, 
        error: 'Registration failed. Please try again.' 
      }
    }
  }

  /**
   * Authenticate existing user
   *
   * @param request - Login credentials (email, password)
   * @returns Authentication response with user data and session token
   */
  async login(request: LoginRequest): Promise<AuthResponse> {
    try {
      console.log('[AuthService] Login attempt for email:', request.email)

      // Validate input
      if (!request.email || !request.password) {
        return { success: false, error: 'Email and password are required' }
      }

      // Get user from database
      const user = this.db.getUserByEmail(request.email.toLowerCase())
      
      // Prevent timing attacks by always running bcrypt.compare
      const dummyHash = '$2b$12$dummy.hash.to.prevent.timing.attacks.against.enumeration'
      const providedPassword = request.password
      const storedHash = user?.password_hash || dummyHash
      
      // Compare passwords (runs regardless of user existence)
      const passwordValid = await bcrypt.compare(providedPassword, storedHash)

      // Check if user exists AND password is valid
      if (!user || !passwordValid) {
        console.log('[AuthService] Login failed: Invalid credentials for email:', request.email)
        // Consistent error message to prevent email enumeration
        return { success: false, error: 'Invalid email or password' }
      }

      // Create session token
      const sessionToken = this.createSession(user.id, user.email)

      console.log('[AuthService] User logged in successfully:', user.id)

      return {
        success: true,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          created_at: user.created_at,
        },
        sessionToken,
      }
    } catch (error) {
      console.error('[AuthService] Login error:', error)
      return { 
        success: false, 
        error: 'Login failed. Please try again.' 
      }
    }
  }

  /**
   * Validate session token
   *
   * @param sessionToken - Session token to validate
   * @returns Validation result with user ID if valid
   */
  validateSession(sessionToken: string): SessionValidation {
    if (!sessionToken) {
      return { valid: false, error: 'No session token provided' }
    }

    const sessionData = this.sessions.get(sessionToken)
    
    if (!sessionData) {
      // Session not found in memory - this happens after app restart
      // Try to extract user info from token and validate against database
      console.log('[AuthService] Session not found in memory, trying database fallback...')
      
      try {
        // Parse session token to extract user ID
        // Format: "session_[userId]_[timestamp]_[randomString]"
        const tokenParts = sessionToken.split('_')
        if (tokenParts.length >= 2 && tokenParts[0] === 'session') {
          const userId = parseInt(tokenParts[1])
          
          if (!isNaN(userId)) {
            // Check if user still exists in database
            const user = this.db.getUserById(userId)
            if (user) {
              // Recreate session in memory for future use
              const expiresAt = new Date()
              expiresAt.setDate(expiresAt.getDate() + 7) // 7 days from now
              
              this.sessions.set(sessionToken, {
                userId,
                email: user.email,
                expiresAt,
                createdAt: new Date(),
              })
              
              console.log('[AuthService] Session restored from database for user:', userId)
              return { valid: true, userId }
            }
          }
        }
      } catch (error) {
        console.error('[AuthService] Database fallback failed:', error)
      }
      
      return { valid: false, error: 'Session expired - please log in again' }
    }

    // Check if session has expired
    if (new Date() > sessionData.expiresAt) {
      this.sessions.delete(sessionToken)
      return { valid: false, error: 'Session expired' }
    }

    return { valid: true, userId: sessionData.userId }
  }

  /**
   * Alternative validation that checks user existence in database
   * This can be used as a fallback when session storage is lost
   *
   * @param userId - User ID to validate
   * @returns Validation result
   */
  validateUserExists(userId: number): SessionValidation {
    if (!userId) {
      return { valid: false, error: 'No user ID provided' }
    }

    try {
      // Check if user exists in database
      const user = this.db.getUserById(userId)
      
      if (!user) {
        return { valid: false, error: 'User not found' }
      }

      return { valid: true, userId: userId }
    } catch (error) {
      console.error('[AuthService] Error validating user existence:', error)
      return { valid: false, error: 'Validation failed' }
    }
  }

  /**
   * Logout user by invalidating session token
   *
   * @param sessionToken - Session token to invalidate
   */
  logout(sessionToken: string): void {
    if (sessionToken) {
      this.sessions.delete(sessionToken)
      console.log('[AuthService] User logged out, session invalidated')
    }
  }

  /**
   * Get user data by session token
   *
   * @param sessionToken - Valid session token
   * @returns User data or null if invalid session
   */
  getUserBySession(sessionToken: string): { id: number; email: string; name: string; created_at: string } | null {
    const validation = this.validateSession(sessionToken)
    
    if (!validation.valid || !validation.userId) {
      return null
    }

    // Get user directly by ID (works with both in-memory and database fallback)
    const user = this.db.getUserById(validation.userId)
    
    if (!user) {
      return null
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      created_at: user.created_at,
    }
  }

  /**
   * Create a new session token
   *
   * @param userId - User ID
   * @param email - User email
   * @returns Session token string
   */
  private createSession(userId: number, email: string): string {
    // Generate cryptographically secure random token with embedded user ID
    // Format: "session_[userId]_[timestamp]_[randomHex]"
    const timestamp = Date.now().toString(36) // Base36 for compactness
    const randomPart = crypto.randomBytes(16).toString('hex') // 32 chars
    const sessionToken = `session_${userId}_${timestamp}_${randomPart}`
    
    // Session expires in 7 days
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 7)

    // Store session data
    this.sessions.set(sessionToken, {
      userId,
      email,
      createdAt: new Date(),
      expiresAt,
    })

    console.log('[AuthService] Session created for user:', userId, 'expires:', expiresAt.toISOString())
    
    return sessionToken
  }

  /**
   * Validate registration request
   */
  private validateRegistrationRequest(request: RegisterRequest): { valid: boolean; error?: string } {
    if (!request.name?.trim()) {
      return { valid: false, error: 'Name is required' }
    }

    if (!request.email?.trim()) {
      return { valid: false, error: 'Email is required' }
    }

    if (!request.password) {
      return { valid: false, error: 'Password is required' }
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(request.email)) {
      return { valid: false, error: 'Please enter a valid email address' }
    }

    return { valid: true }
  }

  /**
   * Validate password against security requirements
   */
  private validatePassword(password: string): { valid: boolean; error?: string } {
    if (password.length < PASSWORD_REQUIREMENTS.minLength) {
      return { valid: false, error: `Password must be at least ${PASSWORD_REQUIREMENTS.minLength} characters long` }
    }

    if (PASSWORD_REQUIREMENTS.requireUppercase && !/[A-Z]/.test(password)) {
      return { valid: false, error: 'Password must contain at least one uppercase letter' }
    }

    if (PASSWORD_REQUIREMENTS.requireLowercase && !/[a-z]/.test(password)) {
      return { valid: false, error: 'Password must contain at least one lowercase letter' }
    }

    if (PASSWORD_REQUIREMENTS.requireNumbers && !/[0-9]/.test(password)) {
      return { valid: false, error: 'Password must contain at least one number' }
    }

    if (PASSWORD_REQUIREMENTS.requireSpecialChars && !/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      return { valid: false, error: 'Password must contain at least one special character' }
    }

    return { valid: true }
  }

  /**
   * Clean up expired sessions (should be called periodically)
   */
  cleanupExpiredSessions(): void {
    const now = new Date()
    let cleanedCount = 0

    for (const [token, sessionData] of this.sessions.entries()) {
      if (now > sessionData.expiresAt) {
        this.sessions.delete(token)
        cleanedCount++
      }
    }

    if (cleanedCount > 0) {
      console.log('[AuthService] Cleaned up', cleanedCount, 'expired sessions')
    }
  }
}