/**
 * Settings Page - Multi-Provider AI Setup
 *
 * Redesigned to support multiple AI providers with excellent UX.
 *
 * Features:
 * - Provider selection (Gemini, OpenAI, Anthropic, Ollama)
 * - Clear visual indicators (FREE, PAID, RECOMMENDED badges)
 * - Provider-specific instructions and setup
 * - Connection testing with real API calls
 * - Beautiful, intuitive interface
 *
 * UX Principles:
 * - Make free option obvious and easy
 * - Show clear cost information
 * - Provider cards with visual hierarchy
 * - Inline help and instructions
 * - Real-time validation feedback
 */

import { useState, FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CheckCircle2,
  XCircle,
  Loader2,
  ExternalLink,
  Sparkles,
  DollarSign,
  Shield,
  Zap,
} from 'lucide-react'
import { Input } from '../components/ui/Input'
import { Button } from '../components/ui/Button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from '../components/ui/Card'
import { useAppStore } from '../store/useAppStore'
import {
  AI_PROVIDERS,
  AIProviderFactory,
  type AIProviderType,
} from '../services/ai-providers'

export function SettingsPage() {
  const navigate = useNavigate()

  // Store state
  const user = useAppStore((state) => state.user)
  const apiCredentials = useAppStore((state) => state.apiCredentials)
  const selectedAIProvider = useAppStore((state) => state.selectedAIProvider)
  const setApiCredentials = useAppStore((state) => state.setApiCredentials)
  const setAIProvider = useAppStore((state) => state.setAIProvider)
  const updateUser = useAppStore((state) => state.updateUser)

  // Local state
  const [apiKey, setApiKey] = useState('')
  const [isValidating, setIsValidating] = useState(false)
  const [validationStatus, setValidationStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState('')

  // Get current provider config
  const currentProvider = AI_PROVIDERS[selectedAIProvider]

  // Check if current provider is connected
  const isConnected = Boolean(
    (selectedAIProvider === 'gemini' && apiCredentials.geminiApiKey) ||
      (selectedAIProvider === 'openai' && apiCredentials.openaiApiKey) ||
      (selectedAIProvider === 'anthropic' && apiCredentials.anthropicApiKey) ||
      (selectedAIProvider === 'ollama' && apiCredentials.ollamaUrl)
  )

  /**
   * Handle provider selection
   */
  const handleProviderChange = (provider: AIProviderType) => {
    setAIProvider(provider)
    setValidationStatus('idle')
    setErrorMessage('')

    // Load existing API key for this provider
    switch (provider) {
      case 'gemini':
        setApiKey(apiCredentials.geminiApiKey || '')
        break
      case 'openai':
        setApiKey(apiCredentials.openaiApiKey || '')
        break
      case 'anthropic':
        setApiKey(apiCredentials.anthropicApiKey || '')
        break
      case 'ollama':
        setApiKey(apiCredentials.ollamaUrl || 'http://localhost:11434')
        break
    }
  }

  /**
   * Test connection with selected provider
   */
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()

    if (!apiKey.trim()) {
      setErrorMessage('Please enter an API key')
      return
    }

    setIsValidating(true)
    setValidationStatus('idle')
    setErrorMessage('')

    try {
      // Get the provider instance
      const provider = AIProviderFactory.getProvider(selectedAIProvider)

      // Test the connection
      const result = await provider.testConnection(apiKey)

      if (result.success) {
        // Save API key based on provider
        switch (selectedAIProvider) {
          case 'gemini':
            setApiCredentials({ geminiApiKey: apiKey })
            break
          case 'openai':
            setApiCredentials({ openaiApiKey: apiKey })
            break
          case 'anthropic':
            setApiCredentials({ anthropicApiKey: apiKey })
            break
          case 'ollama':
            setApiCredentials({ ollamaUrl: apiKey })
            break
        }

        // Update user connection status
        updateUser({
          aiProvider: selectedAIProvider,
          aiConnected: true,
          chatgptConnected: true, // Legacy field
        })

        setValidationStatus('success')

        // Navigate to home after short delay
        setTimeout(() => {
          navigate('/')
        }, 1500)
      } else {
        throw new Error(result.message)
      }
    } catch (error) {
      setValidationStatus('error')
      setErrorMessage(error instanceof Error ? error.message : 'Failed to validate API key')
    } finally {
      setIsValidating(false)
    }
  }

  /**
   * Disconnect current provider
   */
  const handleDisconnect = () => {
    switch (selectedAIProvider) {
      case 'gemini':
        setApiCredentials({ geminiApiKey: null })
        break
      case 'openai':
        setApiCredentials({ openaiApiKey: null })
        break
      case 'anthropic':
        setApiCredentials({ anthropicApiKey: null })
        break
      case 'ollama':
        setApiCredentials({ ollamaUrl: null })
        break
    }

    updateUser({ aiConnected: false, chatgptConnected: false })
    setApiKey('')
    setValidationStatus('idle')
  }

  /**
   * Get provider-specific icon
   */
  const getProviderIcon = (provider: AIProviderType) => {
    switch (provider) {
      case 'gemini':
        return <Sparkles className="h-5 w-5" />
      case 'openai':
        return <Zap className="h-5 w-5" />
      case 'anthropic':
        return <Shield className="h-5 w-5" />
      case 'ollama':
        return <Shield className="h-5 w-5" />
    }
  }

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <h2 className="text-3xl font-bold tracking-tight">AI Provider Settings</h2>
        <p className="text-muted-foreground">Choose and configure your AI provider for exam generation</p>
      </div>

      {/* Provider Selection */}
      <div>
        <h3 className="text-lg font-semibold mb-4">Choose Your AI Provider</h3>
        <div className="grid gap-4 md:grid-cols-2">
          {(Object.keys(AI_PROVIDERS) as AIProviderType[]).map((providerId) => {
            const provider = AI_PROVIDERS[providerId]
            const isSelected = selectedAIProvider === providerId
            const isThisConnected =
              (providerId === 'gemini' && apiCredentials.geminiApiKey) ||
              (providerId === 'openai' && apiCredentials.openaiApiKey) ||
              (providerId === 'anthropic' && apiCredentials.anthropicApiKey) ||
              (providerId === 'ollama' && apiCredentials.ollamaUrl)

            return (
              <Card
                key={providerId}
                className={`cursor-pointer transition-all ${
                  isSelected
                    ? 'border-blue-500 bg-blue-50 shadow-md'
                    : 'hover:border-gray-400 hover:shadow'
                }`}
                onClick={() => handleProviderChange(providerId)}
              >
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      {/* Icon */}
                      <div
                        className={`p-2 rounded ${isSelected ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-600'}`}
                      >
                        {getProviderIcon(providerId)}
                      </div>

                      {/* Provider Info */}
                      <div className="flex-1">
                        <h4 className="font-semibold">{provider.name}</h4>
                        <p className="text-xs text-muted-foreground mt-1">
                          {provider.description}
                        </p>

                        {/* Features */}
                        <div className="flex flex-wrap gap-2 mt-3">
                          {provider.features.isFree && (
                            <span className="px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700 rounded">
                              FREE
                            </span>
                          )}
                          {provider.features.isRecommended && (
                            <span className="px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-700 rounded">
                              RECOMMENDED
                            </span>
                          )}
                          {!provider.features.isFree && (
                            <span className="px-2 py-0.5 text-xs font-medium bg-orange-100 text-orange-700 rounded">
                              {provider.pricing.label}
                            </span>
                          )}
                          {provider.features.isLocal && (
                            <span className="px-2 py-0.5 text-xs font-medium bg-purple-100 text-purple-700 rounded">
                              LOCAL
                            </span>
                          )}
                        </div>

                        {/* Pricing */}
                        <p className="text-xs text-muted-foreground mt-2">
                          {provider.pricing.details}
                        </p>
                      </div>
                    </div>

                    {/* Radio indicator */}
                    <div
                      className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                        isSelected ? 'border-blue-600' : 'border-gray-300'
                      }`}
                    >
                      {isSelected && <div className="w-3 h-3 rounded-full bg-blue-600" />}
                    </div>
                  </div>

                  {/* Connection status */}
                  {isThisConnected && (
                    <div className="flex items-center gap-2 mt-3 text-green-600 text-sm">
                      <CheckCircle2 className="h-4 w-4" />
                      <span>Connected</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>

      {/* API Key Configuration for Selected Provider */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {getProviderIcon(selectedAIProvider)}
            Configure {currentProvider.name}
          </CardTitle>
          <CardDescription>{currentProvider.setup.instructions}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* API Key Input */}
            <Input
              label={currentProvider.setup.apiKeyLabel}
              type={selectedAIProvider === 'ollama' ? 'text' : 'password'}
              placeholder={currentProvider.setup.apiKeyPlaceholder}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              error={errorMessage}
              disabled={isValidating || isConnected}
              helperText={
                !isConnected
                  ? `Get your ${currentProvider.name} API key from their platform`
                  : 'Your API key is securely stored'
              }
            />

            {/* Validation Status */}
            {validationStatus === 'success' && (
              <div className="flex items-center gap-2 rounded-md bg-green-50 p-3 text-sm text-green-700">
                <CheckCircle2 className="h-4 w-4" />
                <span>Connected successfully! Redirecting...</span>
              </div>
            )}

            {validationStatus === 'error' && (
              <div className="flex items-center gap-2 rounded-md bg-red-50 p-3 text-sm text-red-700">
                <XCircle className="h-4 w-4" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Get API key link */}
            {!isConnected && (
              <a
                href={currentProvider.setup.apiKeyUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-sm text-primary hover:underline"
              >
                Get your {currentProvider.name} API key
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </form>
        </CardContent>
        <CardFooter className="flex gap-2">
          {isConnected ? (
            <>
              <Button variant="outline" onClick={() => navigate('/')}>
                Back to Home
              </Button>
              <Button variant="destructive" onClick={handleDisconnect}>
                Disconnect
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => navigate('/')}>
                Skip for now
              </Button>
              <Button onClick={handleSubmit} disabled={isValidating || !apiKey.trim()}>
                {isValidating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Testing connection...
                  </>
                ) : (
                  'Connect & Test'
                )}
              </Button>
            </>
          )}
        </CardFooter>
      </Card>

      {/* Google Drive Connection (Placeholder) */}
      <Card className="opacity-60">
        <CardHeader>
          <CardTitle>Google Drive Connection</CardTitle>
          <CardDescription>Export your exams directly to Google Drive</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Coming in Phase 4...</p>
        </CardContent>
      </Card>
    </div>
  )
}
