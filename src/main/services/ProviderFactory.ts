/**
 * Provider Factory - Creates and manages AI providers based on configuration
 *
 * This factory handles:
 * - Provider instantiation based on environment config
 * - Cross-provider fallback logic
 * - Provider health monitoring
 * - Automatic switching between providers
 */

import { TogetherProvider } from './TogetherProvider'
import type { ExamGenerationConfig } from './TogetherProvider'

export type AIProviderType = 'together'

// Re-export for consumers that import ExamGenerationConfig from ProviderFactory
export type { ExamGenerationConfig }

/**
 * Common interface for all AI providers
 */
export interface IAIProvider {
  generateExam(config: ExamGenerationConfig, sourceText: string): Promise<string>
  testConnection(): Promise<{ success: boolean; message: string; details?: string }>
  getModelInfo(): {
    primaryModel: string
    fallbackModel: string
    config: any
    availableModels: string[]
  }
  switchModel?(newModel: string): boolean
}

/**
 * Provider Factory with fallback management
 */
export class ProviderFactory {
  private provider: IAIProvider | null = null
  private providerType: AIProviderType = 'together'

  constructor() {
    console.log(`[ProviderFactory] Provider: together (TogetherProvider with Qwen3-235B + Groq fallback)`)
  }

  /**
   * Initialize the configured provider
   */
  async initialize(): Promise<void> {
    try {
      this.provider = this.createTogetherProvider()
      console.log('[ProviderFactory] TogetherProvider initialized successfully')
    } catch (error: any) {
      console.error('[ProviderFactory] Failed to initialize TogetherProvider:', error.message)
      throw error
    }
  }

  /**
   * Get the currently active provider
   */
  getCurrentProvider(): IAIProvider {
    if (!this.provider) {
      throw new Error('No provider is currently active. Call initialize() first.')
    }
    return this.provider
  }

  /**
   * Create TogetherProvider instance
   */
  private createTogetherProvider(): TogetherProvider {
    const togetherApiKey = process.env.TOGETHER_API_KEY
    if (!togetherApiKey) {
      throw new Error('TOGETHER_API_KEY not found in environment variables')
    }

    const groqApiKey = process.env.GROQ_API_KEY // optional fallback
    return new TogetherProvider(togetherApiKey, groqApiKey)
  }

  /**
   * Generate exam using the active provider
   */
  async generateExam(config: ExamGenerationConfig, sourceText: string): Promise<string> {
    if (!this.provider) {
      throw new Error('No provider is initialized')
    }

    console.log('[ProviderFactory] Generating exam with TogetherProvider')
    return this.provider.generateExam(config, sourceText)
  }

  /**
   * Test connection for the active provider
   */
  async testAllConnections(): Promise<{
    primary: { success: boolean; message: string; provider: string }
    fallback?: { success: boolean; message: string; provider: string }
  }> {
    const results: any = {}

    if (this.provider) {
      try {
        const testResult = await this.provider.testConnection()
        results.primary = {
          ...testResult,
          provider: this.providerType,
        }
      } catch (error: any) {
        results.primary = {
          success: false,
          message: error.message || 'Connection test failed',
          provider: this.providerType,
        }
      }
    }

    return results
  }

  /**
   * Get current provider type
   */
  getCurrentProviderType(): AIProviderType {
    return this.providerType
  }

  /**
   * No-op: fallback switching is internal to TogetherProvider
   */
  async switchToFallback(): Promise<boolean> {
    console.warn('[ProviderFactory] switchToFallback() is a no-op — TogetherProvider handles fallback internally')
    return false
  }

  /**
   * No-op: single provider, no reset needed
   */
  async resetToPrimary(): Promise<boolean> {
    console.warn('[ProviderFactory] resetToPrimary() is a no-op — only one provider is configured')
    return true
  }

  /**
   * Get detailed provider information
   */
  getProviderInfo() {
    return {
      primary: {
        type: this.providerType,
        active: true,
        available: !!this.provider,
        info: this.provider?.getModelInfo(),
      },
      fallback: null,
      fallbackEnabled: false,
      currentProviderType: this.providerType,
    }
  }

  /**
   * Model switching is handled internally by TogetherProvider
   */
  switchModel(_newModel: string): boolean {
    console.warn('[ProviderFactory] switchModel() is not supported — TogetherProvider manages models internally')
    return false
  }
}
