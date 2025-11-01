/**
 * Google Drive Service
 *
 * Handles Google Drive and Google Docs API operations.
 *
 * Features:
 * - OAuth 2.0 authentication
 * - Token management (access + refresh tokens)
 * - Create Google Docs from exam content
 * - Export documents to PDF
 * - Download files to local storage
 *
 * Flow:
 * 1. User clicks "Connect Google Drive"
 * 2. OAuth flow opens browser → user grants permission
 * 3. Tokens stored securely in token.json
 * 4. Future requests use stored tokens (auto-refresh if expired)
 */

import { google } from 'googleapis'
import type { OAuth2Client } from 'google-auth-library'
import * as fs from 'fs'
import * as path from 'path'
import { app } from 'electron'

/**
 * Scopes required for Qreate
 *
 * - drive.file: Create and edit files created by this app
 * - documents: Create and edit Google Docs
 */
const SCOPES = [
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/documents',
]

/**
 * File paths for credentials and tokens
 */
const CREDENTIALS_PATH = path.join(process.cwd(), 'credentials.json')
const TOKEN_PATH = path.join(app.getPath('userData'), 'token.json')

/**
 * Google Drive Service
 *
 * Usage:
 * ```ts
 * const service = new GoogleDriveService()
 * await service.authenticate() // Opens browser for OAuth
 * const docId = await service.createDocument('My Exam', content)
 * await service.exportToPDF(docId, '/path/to/exam.pdf')
 * ```
 */
export class GoogleDriveService {
  private oAuth2Client: OAuth2Client | null = null

  /**
   * Check if credentials file exists
   */
  hasCredentials(): boolean {
    return fs.existsSync(CREDENTIALS_PATH)
  }

  /**
   * Check if user is already authenticated (has valid token)
   */
  isAuthenticated(): boolean {
    if (!fs.existsSync(TOKEN_PATH)) {
      return false
    }

    try {
      const token = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf-8'))
      return !!token.access_token
    } catch {
      return false
    }
  }

  /**
   * Initialize OAuth2 client
   *
   * Reads credentials.json and creates OAuth2 client.
   * This must be called before any operations.
   */
  private async initializeOAuth2Client(): Promise<OAuth2Client> {
    if (!this.hasCredentials()) {
      throw new Error(
        'credentials.json not found. Please follow GOOGLE_OAUTH_SETUP.md to set up Google OAuth.'
      )
    }

    // Read credentials
    const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf-8'))
    const { client_id, client_secret, redirect_uris } = credentials.installed || credentials.web

    // Create OAuth2 client
    const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0])

    // Load token if exists
    if (fs.existsSync(TOKEN_PATH)) {
      const token = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf-8'))
      oAuth2Client.setCredentials(token)
    }

    this.oAuth2Client = oAuth2Client
    return oAuth2Client
  }

  /**
   * Get OAuth2 authentication URL
   *
   * Returns the URL to open in browser for user to grant permission.
   */
  async getAuthUrl(): Promise<string> {
    const oAuth2Client = await this.initializeOAuth2Client()

    const authUrl = oAuth2Client.generateAuthUrl({
      access_type: 'offline', // Get refresh token
      scope: SCOPES,
    })

    return authUrl
  }

  /**
   * Complete OAuth2 authentication with authorization code
   *
   * After user grants permission, Google redirects with a code.
   * Exchange this code for access + refresh tokens.
   *
   * @param code - Authorization code from OAuth redirect
   */
  async authenticateWithCode(code: string): Promise<void> {
    if (!this.oAuth2Client) {
      await this.initializeOAuth2Client()
    }

    // Exchange code for tokens
    const { tokens } = await this.oAuth2Client!.getToken(code)
    this.oAuth2Client!.setCredentials(tokens)

    // Save tokens for future use
    fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens))

    console.log('[GoogleDriveService] Authentication successful, tokens saved')
  }

  /**
   * Get authenticated Google Docs API client
   */
  private async getDocsClient() {
    if (!this.oAuth2Client) {
      await this.initializeOAuth2Client()
    }

    return google.docs({ version: 'v1', auth: this.oAuth2Client! })
  }

  /**
   * Get authenticated Google Drive API client
   */
  private async getDriveClient() {
    if (!this.oAuth2Client) {
      await this.initializeOAuth2Client()
    }

    return google.drive({ version: 'v3', auth: this.oAuth2Client! })
  }

  /**
   * Create a Google Doc with formatted content
   *
   * @param title - Document title
   * @param content - Document content (structured requests for Google Docs API)
   * @returns Document ID
   */
  async createDocument(title: string, content: any): Promise<string> {
    const docs = await this.getDocsClient()

    // Create empty document
    const createResponse = await docs.documents.create({
      requestBody: {
        title,
      },
    })

    const documentId = createResponse.data.documentId!

    // Add content to document
    await docs.documents.batchUpdate({
      documentId,
      requestBody: {
        requests: content,
      },
    })

    console.log('[GoogleDriveService] Created document:', documentId)

    return documentId
  }

  /**
   * Export Google Doc to PDF and download
   *
   * @param documentId - Google Doc ID
   * @param outputPath - Local file path to save PDF
   */
  async exportToPDF(documentId: string, outputPath: string): Promise<void> {
    const drive = await this.getDriveClient()

    // Ensure output directory exists
    const dir = path.dirname(outputPath)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }

    // Export as PDF
    const response = await drive.files.export(
      {
        fileId: documentId,
        mimeType: 'application/pdf',
      },
      { responseType: 'arraybuffer' }
    )

    // Write to file
    fs.writeFileSync(outputPath, Buffer.from(response.data as ArrayBuffer))

    console.log('[GoogleDriveService] Exported PDF to:', outputPath)
  }

  /**
   * Get Google Docs URL for a document
   *
   * @param documentId - Google Doc ID
   * @returns Shareable URL
   */
  getDocumentUrl(documentId: string): string {
    return `https://docs.google.com/document/d/${documentId}/edit`
  }

  /**
   * Disconnect (revoke tokens)
   *
   * Removes stored tokens, requiring re-authentication.
   */
  disconnect(): void {
    if (fs.existsSync(TOKEN_PATH)) {
      fs.unlinkSync(TOKEN_PATH)
    }
    this.oAuth2Client = null
    console.log('[GoogleDriveService] Disconnected')
  }

  /**
   * Get user's email from authenticated account
   */
  async getUserEmail(): Promise<string> {
    const drive = await this.getDriveClient()

    const response = await drive.about.get({
      fields: 'user',
    })

    return response.data.user?.emailAddress || 'Unknown'
  }
}
