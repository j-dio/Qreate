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
          <label className="text-sm font-semibold leading-none text-foreground peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
            {label}
          </label>
        )}

        {/* Input Field */}
        <input
          type={type}
          className={cn(
            // Base styles
            'flex h-10 w-full rounded-lg border border-input bg-background/90 px-3 py-2 text-sm shadow-sm transition-all',
            // Placeholder styles
            'placeholder:text-muted-foreground',
            // Focus styles
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background',
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
          <p className={cn('text-xs', error ? 'text-destructive' : 'text-muted-foreground')}>
            {error || helperText}
          </p>
        )}
      </div>
    )
  }
)
Input.displayName = 'Input'

export { Input }
