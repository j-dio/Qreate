/**
 * AI Provider Types and Abstraction Layer
 *
 * This file defines the common interface that all AI providers must implement.
 *
 * Why an abstraction layer?
 * - Allows easy switching between AI providers
 * - Consistent API across different providers (OpenAI, Gemini, Claude, etc.)
 * - Easy to add new providers in the future
 * - User can choose based on cost, quality, or privacy preferences
 *
 * Design Pattern: Strategy Pattern
 * - Each provider is a "strategy" for generating exams
 * - App code doesn't need to know which provider is being used
 * - Provider can be swapped at runtime
 */

/**
 * Supported AI Provider Types
 */
export type AIProviderType = 'openai' | 'gemini' | 'anthropic' | 'ollama'

/**
 * AI Provider Configuration
 *
 * Contains display information and settings for each provider
 */
export interface AIProviderConfig {
  id: AIProviderType
  name: string
  description: string
  features: {
    isFree: boolean
    requiresCreditCard: boolean
    isLocal: boolean
    isRecommended: boolean
  }
  pricing: {
    label: string
    details: string
  }
  setup: {
    apiKeyLabel: string
    apiKeyPlaceholder: string
    apiKeyUrl: string
    instructions: string
  }
}

/**
 * All available AI providers with their configurations
 */
export const AI_PROVIDERS: Record<AIProviderType, AIProviderConfig> = {
  gemini: {
    id: 'gemini',
    name: 'Google Gemini',
    description: 'Fast, high-quality, and completely free with no credit card required',
    features: {
      isFree: true,
      requiresCreditCard: false,
      isLocal: false,
      isRecommended: true,
    },
    pricing: {
      label: 'FREE',
      details: 'Up to 1 million tokens per month free',
    },
    setup: {
      apiKeyLabel: 'Gemini API Key',
      apiKeyPlaceholder: 'AIza...',
      apiKeyUrl: 'https://aistudio.google.com/app/apikey',
      instructions:
        '1. Visit Google AI Studio\n2. Sign in with your Google account\n3. Click "Get API key" or "Create API key"\n4. Create a new project (if prompted)\n5. Copy your API key and paste it here',
    },
  },
  openai: {
    id: 'openai',
    name: 'OpenAI (GPT-4)',
    description: 'Industry-leading quality, requires payment',
    features: {
      isFree: false,
      requiresCreditCard: true,
      isLocal: false,
      isRecommended: false,
    },
    pricing: {
      label: 'PAID',
      details: '$0.03-0.10 per exam (approximately)',
    },
    setup: {
      apiKeyLabel: 'OpenAI API Key',
      apiKeyPlaceholder: 'sk-...',
      apiKeyUrl: 'https://platform.openai.com/api-keys',
      instructions:
        '1. Visit OpenAI Platform\n2. Add payment method\n3. Create new secret key\n4. Copy and paste here',
    },
  },
  anthropic: {
    id: 'anthropic',
    name: 'Anthropic Claude',
    description: 'Excellent quality, $5 free credits on signup',
    features: {
      isFree: false,
      requiresCreditCard: true,
      isLocal: false,
      isRecommended: false,
    },
    pricing: {
      label: '$5 FREE CREDITS',
      details: 'Then $0.25-3.00 per million tokens',
    },
    setup: {
      apiKeyLabel: 'Anthropic API Key',
      apiKeyPlaceholder: 'sk-ant-...',
      apiKeyUrl: 'https://console.anthropic.com/settings/keys',
      instructions:
        '1. Create Anthropic account\n2. Get $5 free credits\n3. Generate API key\n4. Copy and paste here',
    },
  },
  ollama: {
    id: 'ollama',
    name: 'Ollama (Local)',
    description: 'Runs entirely on your computer, 100% private and free',
    features: {
      isFree: true,
      requiresCreditCard: false,
      isLocal: true,
      isRecommended: false,
    },
    pricing: {
      label: 'FREE',
      details: 'Completely free, runs locally',
    },
    setup: {
      apiKeyLabel: 'Ollama URL (optional)',
      apiKeyPlaceholder: 'http://localhost:11434',
      apiKeyUrl: 'https://ollama.ai/',
      instructions:
        '1. Download Ollama from ollama.ai\n2. Install and run\n3. Pull a model: ollama pull llama3\n4. Leave URL as default or customize',
    },
  },
}

/**
 * Test Connection Result
 */
export interface TestConnectionResult {
  success: boolean
  message: string
  details?: string
}

/**
 * AI Provider Interface
 *
 * Every AI provider must implement this interface.
 * This ensures consistent behavior across all providers.
 */
export interface IAIProvider {
  /**
   * Provider type identifier
   */
  readonly type: AIProviderType

  /**
   * Test the connection with the API key
   *
   * Should make a minimal API call to verify:
   * - API key is valid
   * - Service is reachable
   * - Authentication works
   *
   * @param apiKey - The API key to test
   * @returns Promise with success status and message
   */
  testConnection(apiKey: string): Promise<TestConnectionResult>

  /**
   * Generate exam content from source material
   *
   * Takes user's configuration and source materials, returns generated exam.
   *
   * @param config - Exam configuration (types, difficulty, etc.)
   * @param sourceText - Extracted text from uploaded files
   * @param apiKey - API key for authentication
   * @returns Promise with generated exam content
   */
  generateExam(config: ExamGenerationConfig, sourceText: string, apiKey: string): Promise<string>
}

/**
 * Exam Generation Configuration
 *
 * Configuration passed to AI providers for exam generation
 */
export interface ExamGenerationConfig {
  // Question types and quantities
  questionTypes: {
    multipleChoice?: number
    trueFalse?: number
    fillInTheBlanks?: number
    shortAnswer?: number
    essay?: number
    matching?: number
    identification?: number
  }

  // Difficulty distribution
  difficultyDistribution: {
    veryEasy: number
    easy: number
    moderate: number
    hard: number
    veryHard: number
  }

  // Total questions (for validation)
  totalQuestions: number

  // Optional: User preferences
  topic?: string
  instructions?: string
}
