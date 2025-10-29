/**
 * Question Type Input Component
 *
 * Reusable input component for configuring a single question type.
 *
 * Features:
 * - Label with description
 * - Number input with validation
 * - Increment/decrement buttons for easy adjustment
 * - Disabled state support
 * - Visual feedback (highlight when quantity > 0)
 *
 * Design Philosophy:
 * - Make it easy to adjust quantities (buttons + keyboard input)
 * - Clear visual feedback on selected types
 * - Prevent invalid inputs
 */

import { useState, useEffect } from 'react'
import { Minus, Plus } from 'lucide-react'
import { Button } from './ui/Button'
import { Input } from './ui/Input'
import { Card, CardContent } from './ui/Card'

interface QuestionTypeInputProps {
  label: string
  description: string
  icon: string
  value: number
  onChange: (value: number) => void
  disabled?: boolean
  min?: number
  max?: number
}

export function QuestionTypeInput({
  label,
  description,
  icon,
  value,
  onChange,
  disabled = false,
  min = 0,
  max = 200,
}: QuestionTypeInputProps) {
  /**
   * Local state for input display value
   *
   * Why local state?
   * - Allows input to be empty while user is typing
   * - Parent (store) always has a valid number
   * - We sync local → parent only on blur or valid input
   *
   * This enables the workflow:
   * 1. Click input → text selected
   * 2. Type 25 → shows 25
   * 3. Backspace to clear → shows empty (not 0!)
   * 4. Type 30 → shows 30
   * 5. Blur → enforces minimum if empty
   */
  const [displayValue, setDisplayValue] = useState<string>(value.toString())
  const [isFocused, setIsFocused] = useState(false)

  /**
   * Sync display value when parent value changes (e.g., from +/- buttons or external updates)
   * But only if we're not currently focused/editing
   */
  useEffect(() => {
    if (!isFocused) {
      setDisplayValue(value.toString())
    }
  }, [value, isFocused])
  /**
   * Handle increment
   */
  const handleIncrement = () => {
    if (value < max) {
      onChange(value + 1)
    }
  }

  /**
   * Handle decrement
   */
  const handleDecrement = () => {
    if (value > min) {
      onChange(value - 1)
    }
  }

  /**
   * Handle direct input change
   *
   * Updates local display value immediately.
   * Only syncs to parent if valid number entered.
   * Empty string is allowed while typing.
   */
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value

    // Update local display immediately (allows empty, partial numbers, etc.)
    setDisplayValue(inputValue)

    // If empty, update parent to 0 but keep display empty
    if (inputValue === '') {
      onChange(0)
      return
    }

    // Parse as integer
    const numValue = parseInt(inputValue, 10)

    // If valid number, constrain and update parent
    if (!isNaN(numValue)) {
      const constrainedValue = Math.max(min, Math.min(max, numValue))
      onChange(constrainedValue)
      // Update display to show constrained value
      if (constrainedValue !== numValue) {
        setDisplayValue(constrainedValue.toString())
      }
    }
  }

  /**
   * Handle blur event
   *
   * When user leaves the input:
   * 1. Mark as not focused
   * 2. If display is empty, enforce minimum value
   * 3. Sync display to actual value
   */
  const handleBlur = () => {
    setIsFocused(false)

    // If empty or invalid, enforce minimum
    if (displayValue === '' || value < min) {
      onChange(min)
      setDisplayValue(min.toString())
    } else {
      // Sync display to actual value (in case there were parsing issues)
      setDisplayValue(value.toString())
    }
  }

  /**
   * Handle focus event
   *
   * Mark as focused and select all text for easy editing
   */
  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    setIsFocused(true)
    e.target.select()
  }

  /**
   * Handle click event
   *
   * Select all text even if already focused
   */
  const handleClick = (e: React.MouseEvent<HTMLInputElement>) => {
    e.currentTarget.select()
  }

  // Determine if this type is "active" (has questions)
  const isActive = value > 0

  return (
    <Card
      className={`transition-all ${
        isActive
          ? 'border-blue-500 bg-blue-50 shadow-sm'
          : 'border-gray-200 hover:border-gray-300'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-4">
          {/* Left: Icon, Label, Description */}
          <div className="flex items-start gap-3 flex-1 min-w-0">
            {/* Icon */}
            <div
              className={`text-2xl flex-shrink-0 w-10 h-10 flex items-center justify-center rounded ${
                isActive ? 'bg-blue-100' : 'bg-gray-100'
              }`}
            >
              {icon}
            </div>

            {/* Label & Description */}
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-semibold text-gray-900">{label}</h4>
              <p className="text-xs text-gray-600 mt-0.5">{description}</p>
            </div>
          </div>

          {/* Right: Quantity Controls */}
          <div className="flex items-center gap-2">
            {/* Decrement Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleDecrement}
              disabled={disabled || value <= min}
              className="h-8 w-8 p-0"
              type="button"
            >
              <Minus className="h-4 w-4" />
            </Button>

            {/* Number Input */}
            <Input
              type="number"
              value={displayValue}
              onChange={handleInputChange}
              onFocus={handleFocus}
              onClick={handleClick}
              onBlur={handleBlur}
              disabled={disabled}
              min={min}
              max={max}
              className="w-16 h-8 text-center text-sm"
            />

            {/* Increment Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleIncrement}
              disabled={disabled || value >= max}
              className="h-8 w-8 p-0"
              type="button"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
