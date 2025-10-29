/**
 * Input Component
 *
 * Reusable text input with error state and labels.
 * Used in forms throughout the application.
 *
 * Usage:
 *   <Input
 *     label="Email"
 *     type="email"
 *     placeholder="you@example.com"
 *     error="Invalid email"
 *   />
 */

import * as React from 'react'
import { cn } from '@shared/utils/cn'

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  helperText?: string
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, label, error, helperText, ...props }, ref) => {
    return (
      <div className="space-y-2">
        {/* Label */}
        {label && (
          <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
            {label}
          </label>
        )}

        {/* Input Field */}
        <input
          type={type}
          className={cn(
            // Base styles
            'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors',
            // Placeholder styles
            'placeholder:text-muted-foreground',
            // Focus styles
            'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
            // Disabled styles
            'disabled:cursor-not-allowed disabled:opacity-50',
            // Error styles
            error && 'border-destructive focus-visible:ring-destructive',
            className
          )}
          ref={ref}
          {...props}
        />

        {/* Helper Text or Error Message */}
        {(helperText || error) && (
          <p
            className={cn(
              'text-xs',
              error ? 'text-destructive' : 'text-muted-foreground'
            )}
          >
            {error || helperText}
          </p>
        )}
      </div>
    )
  }
)
Input.displayName = 'Input'

export { Input }
