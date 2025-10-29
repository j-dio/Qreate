/**
 * Settings Page Component
 *
 * Allows users to manage their API credentials and app settings.
 *
 * Features:
 * - OpenAI API key binding with validation
 * - Google Drive connection management
 * - App preferences
 */

import { useState, FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Key, CheckCircle2, XCircle, Loader2, ExternalLink } from 'lucide-react'
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

export function SettingsPage() {
  const navigate = useNavigate()
  const user = useAppStore((state) => state.user)
  const apiCredentials = useAppStore((state) => state.apiCredentials)
  const setApiCredentials = useAppStore((state) => state.setApiCredentials)
  const updateUser = useAppStore((state) => state.updateUser)

  const [apiKey, setApiKey] = useState(apiCredentials.openaiApiKey || '')
  const [isValidating, setIsValidating] = useState(false)
  const [validationStatus, setValidationStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState('')

  const validateApiKey = async (key: string): Promise<boolean> => {
    try {
      // TODO: Replace with actual OpenAI API validation
      // For now, we'll simulate validation
      await new Promise((resolve) => setTimeout(resolve, 1500))

      // Mock validation: check if key looks like an OpenAI key
      if (key.startsWith('sk-') && key.length > 20) {
        return true
      }
      throw new Error('Invalid API key format. OpenAI keys start with "sk-"')
    } catch (error) {
      throw error
    }
  }

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
      const isValid = await validateApiKey(apiKey)

      if (isValid) {
        // Save API key to store
        setApiCredentials({ openaiApiKey: apiKey })

        // Update user connection status
        updateUser({ chatgptConnected: true })

        setValidationStatus('success')

        // Navigate to home after short delay
        setTimeout(() => {
          navigate('/')
        }, 1500)
      }
    } catch (error) {
      setValidationStatus('error')
      setErrorMessage(error instanceof Error ? error.message : 'Failed to validate API key')
    } finally {
      setIsValidating(false)
    }
  }

  const handleDisconnect = () => {
    setApiCredentials({ openaiApiKey: null })
    updateUser({ chatgptConnected: false })
    setApiKey('')
    setValidationStatus('idle')
  }

  const isConnected = user?.chatgptConnected && apiCredentials.openaiApiKey

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Settings</h2>
        <p className="text-muted-foreground">Manage your API connections and preferences</p>
      </div>

      {/* OpenAI API Key */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Key className="h-5 w-5" />
                OpenAI API Key
              </CardTitle>
              <CardDescription>
                Connect your OpenAI API key to generate exams with ChatGPT
              </CardDescription>
            </div>
            {isConnected && (
              <div className="flex items-center gap-2 text-green-600">
                <CheckCircle2 className="h-5 w-5" />
                <span className="text-sm font-medium">Connected</span>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* API Key Input */}
            <Input
              label="API Key"
              type="password"
              placeholder="sk-..."
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              error={errorMessage}
              disabled={isValidating || isConnected}
              helperText={
                !isConnected
                  ? "Get your API key from OpenAI's platform"
                  : 'Your API key is securely stored'
              }
            />

            {/* Validation Status */}
            {validationStatus === 'success' && (
              <div className="flex items-center gap-2 rounded-md bg-green-50 p-3 text-sm text-green-700">
                <CheckCircle2 className="h-4 w-4" />
                <span>API key validated successfully! Redirecting...</span>
              </div>
            )}

            {validationStatus === 'error' && (
              <div className="flex items-center gap-2 rounded-md bg-red-50 p-3 text-sm text-red-700">
                <XCircle className="h-4 w-4" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* How to get API key link */}
            {!isConnected && (
              <a
                href="https://platform.openai.com/api-keys"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-sm text-primary hover:underline"
              >
                Don't have an API key? Get one here
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
                    Validating...
                  </>
                ) : (
                  'Connect API Key'
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
          <p className="text-sm text-muted-foreground">Coming soon...</p>
        </CardContent>
      </Card>
    </div>
  )
}
