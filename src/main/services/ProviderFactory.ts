import { TogetherProvider } from './TogetherProvider'
import type { ExamGenerationConfig } from './TogetherProvider'

export type { ExamGenerationConfig }

export class ProviderFactory {
  private provider: TogetherProvider | null = null

  async initialize(): Promise<void> {
    const togetherApiKey = process.env.TOGETHER_API_KEY
    if (!togetherApiKey) {
      throw new Error(
        'TOGETHER_API_KEY not found in environment variables. Get one at https://api.together.xyz/settings/api-keys'
      )
    }

    const groqApiKey = process.env.GROQ_API_KEY || undefined

    this.provider = new TogetherProvider(togetherApiKey, groqApiKey)

    console.log('[ProviderFactory] TogetherProvider initialized')
    if (groqApiKey) {
      console.log('[ProviderFactory] Groq fallback configured')
    } else {
      console.log('[ProviderFactory] No Groq fallback (GROQ_API_KEY not set)')
    }
  }

  getCurrentProvider(): TogetherProvider {
    if (!this.provider) {
      throw new Error('Provider not initialized. Call initialize() first.')
    }
    return this.provider
  }

  async generateExam(config: ExamGenerationConfig, sourceText: string): Promise<string> {
    return this.getCurrentProvider().generateExam(config, sourceText)
  }

  async testConnection(): Promise<{ success: boolean; message: string; details?: string }> {
    return this.getCurrentProvider().testConnection()
  }

  getProviderInfo() {
    const provider = this.getCurrentProvider()
    const info = provider.getModelInfo()
    return {
      provider: 'together-ai',
      ...info,
    }
  }
}
