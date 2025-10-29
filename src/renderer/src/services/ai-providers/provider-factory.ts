/**
 * AI Provider Factory
 *
 * Factory pattern for creating AI provider instances.
 *
 * Why a factory?
 * - Centralized provider instantiation
 * - Easy to add new providers
 * - Type-safe provider creation
 * - Single source of truth for available providers
 *
 * Usage:
 *   const provider = AIProviderFactory.getProvider('gemini')
 *   const result = await provider.testConnection(apiKey)
 */

import type { AIProviderType, IAIProvider } from '../../types/ai-providers'
import { GeminiProvider } from './gemini-provider'
import { OpenAIProvider } from './openai-provider'

/**
 * AI Provider Factory
 *
 * Creates instances of AI providers based on type
 */
export class AIProviderFactory {
  /**
   * Provider instances cache
   * Reuse instances instead of creating new ones every time
   */
  private static instances: Map<AIProviderType, IAIProvider> = new Map()

  /**
   * Get a provider instance by type
   *
   * @param type - The provider type to instantiate
   * @returns IAIProvider instance
   * @throws Error if provider type is not supported
   */
  static getProvider(type: AIProviderType): IAIProvider {
    // Check if we already have an instance
    if (this.instances.has(type)) {
      return this.instances.get(type)!
    }

    // Create new instance based on type
    let provider: IAIProvider

    switch (type) {
      case 'gemini':
        provider = new GeminiProvider()
        break

      case 'openai':
        provider = new OpenAIProvider()
        break

      case 'anthropic':
        // TODO: Implement Anthropic provider
        throw new Error('Anthropic provider not yet implemented')

      case 'ollama':
        // TODO: Implement Ollama provider
        throw new Error('Ollama provider not yet implemented')

      default:
        throw new Error(`Unsupported provider type: ${type}`)
    }

    // Cache the instance
    this.instances.set(type, provider)

    return provider
  }

  /**
   * Get all available provider types
   *
   * Useful for UI rendering (dropdowns, radio buttons, etc.)
   */
  static getAvailableProviders(): AIProviderType[] {
    return ['gemini', 'openai'] // Add 'anthropic', 'ollama' when implemented
  }

  /**
   * Check if a provider type is available
   */
  static isProviderAvailable(type: AIProviderType): boolean {
    return this.getAvailableProviders().includes(type)
  }

  /**
   * Clear all cached instances
   *
   * Useful for testing or forcing fresh instances
   */
  static clearCache(): void {
    this.instances.clear()
  }
}
