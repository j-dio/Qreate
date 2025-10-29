/**
 * AI Providers Service - Public API
 *
 * Exports all AI provider functionality for use throughout the app
 */

// Factory
export { AIProviderFactory } from './provider-factory'

// Providers
export { GeminiProvider } from './gemini-provider'
export { OpenAIProvider } from './openai-provider'

// Re-export types
export type {
  AIProviderType,
  AIProviderConfig,
  IAIProvider,
  TestConnectionResult,
  ExamGenerationConfig,
} from '../../types/ai-providers'

export { AI_PROVIDERS } from '../../types/ai-providers'
