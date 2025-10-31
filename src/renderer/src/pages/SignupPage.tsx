/**
 * Signup Page Component
 *
 * User registration page for new users.
 *
 * Features:
 * - Email, name, and password inputs
 * - Password requirements validation (min 8 chars, 1 uppercase, 1 number, 1 special char)
 * - Confirm password matching
 * - Form validation with helpful error messages
 * - Link to login page
 *
 * Password Requirements:
 * - Minimum 8 characters
 * - At least 1 uppercase letter
 * - At least 1 number
 * - At least 1 special character
 */

import { useState, FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { FileText, Check, X } from 'lucide-react'
import { Input } from '../components/ui/Input'
import { Button } from '../components/ui/Button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/Card'
import { useAppStore } from '../store/useAppStore'

interface PasswordRequirement {
  label: string
  test: (password: string) => boolean
}

const passwordRequirements: PasswordRequirement[] = [
  { label: 'At least 8 characters', test: (pw) => pw.length >= 8 },
  { label: 'One uppercase letter', test: (pw) => /[A-Z]/.test(pw) },
  { label: 'One number', test: (pw) => /[0-9]/.test(pw) },
  { label: 'One special character', test: (pw) => /[!@#$%^&*(),.?":{}|<>]/.test(pw) },
]

export function SignupPage() {
  const navigate = useNavigate()
  const setUser = useAppStore((state) => state.setUser)

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
  })

  const [errors, setErrors] = useState<{
    name?: string
    email?: string
    password?: string
    confirmPassword?: string
    general?: string
  }>({})

  const [isLoading, setIsLoading] = useState(false)
  const [showPasswordRequirements, setShowPasswordRequirements] = useState(false)

  const validateForm = (): boolean => {
    const newErrors: typeof errors = {}

    // Name validation
    if (!formData.name.trim()) {
      newErrors.name = 'Name is required'
    }

    // Email validation
    if (!formData.email) {
      newErrors.email = 'Email is required'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address'
    }

    // Password validation
    if (!formData.password) {
      newErrors.password = 'Password is required'
    } else {
      const failedRequirements = passwordRequirements.filter(
        (req) => !req.test(formData.password)
      )
      if (failedRequirements.length > 0) {
        newErrors.password = 'Password does not meet requirements'
      }
    }

    // Confirm password validation
    if (!formData.confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your password'
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()

    if (!validateForm()) return

    setIsLoading(true)
    setErrors({})

    try {
      // TODO: Replace with actual registration API call
      // For now, we'll simulate a registration
      await new Promise((resolve) => setTimeout(resolve, 1000))

      // Mock successful registration
      setUser({
        id: Date.now().toString(),
        email: formData.email,
        name: formData.name,
        createdAt: new Date().toISOString(),
        chatgptConnected: false,
        googleDriveConnected: false,
        aiConnected: false,
      })

      // Navigate to home page
      navigate('/')
    } catch (error) {
      setErrors({ general: 'Registration failed. Please try again.' })
    } finally {
      setIsLoading(false)
    }
  }

  const updateField = (field: keyof typeof formData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-8">
        {/* Logo and Title */}
        <div className="flex flex-col items-center space-y-2">
          <div className="flex items-center gap-2">
            <FileText className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold">Qreate</h1>
          </div>
          <p className="text-sm text-muted-foreground">AI-powered exam generation</p>
        </div>

        {/* Signup Card */}
        <Card>
          <CardHeader>
            <CardTitle>Create an account</CardTitle>
            <CardDescription>Get started with Qreate for free</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* General Error */}
              {errors.general && (
                <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                  {errors.general}
                </div>
              )}

              {/* Name Input */}
              <Input
                label="Full Name"
                type="text"
                placeholder="John Doe"
                value={formData.name}
                onChange={(e) => updateField('name', e.target.value)}
                error={errors.name}
                disabled={isLoading}
              />

              {/* Email Input */}
              <Input
                label="Email"
                type="email"
                placeholder="you@example.com"
                value={formData.email}
                onChange={(e) => updateField('email', e.target.value)}
                error={errors.email}
                disabled={isLoading}
              />

              {/* Password Input */}
              <div>
                <Input
                  label="Password"
                  type="password"
                  placeholder="Create a strong password"
                  value={formData.password}
                  onChange={(e) => updateField('password', e.target.value)}
                  onFocus={() => setShowPasswordRequirements(true)}
                  error={errors.password}
                  disabled={isLoading}
                />

                {/* Password Requirements Checklist */}
                {showPasswordRequirements && formData.password && (
                  <div className="mt-2 space-y-1 rounded-md border border-border bg-muted/50 p-3">
                    <p className="text-xs font-medium text-muted-foreground">
                      Password requirements:
                    </p>
                    {passwordRequirements.map((req, index) => {
                      const isMet = req.test(formData.password)
                      return (
                        <div
                          key={index}
                          className={`flex items-center gap-2 text-xs ${
                            isMet ? 'text-green-600' : 'text-muted-foreground'
                          }`}
                        >
                          {isMet ? (
                            <Check className="h-3 w-3" />
                          ) : (
                            <X className="h-3 w-3" />
                          )}
                          <span>{req.label}</span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Confirm Password Input */}
              <Input
                label="Confirm Password"
                type="password"
                placeholder="Re-enter your password"
                value={formData.confirmPassword}
                onChange={(e) => updateField('confirmPassword', e.target.value)}
                error={errors.confirmPassword}
                disabled={isLoading}
              />

              {/* Submit Button */}
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? 'Creating account...' : 'Create account'}
              </Button>

              {/* Login Link */}
              <p className="text-center text-sm text-muted-foreground">
                Already have an account?{' '}
                <Link to="/login" className="text-primary hover:underline">
                  Sign in
                </Link>
              </p>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
