/**
 * Difficulty Slider Component
 *
 * Individual slider for each difficulty level with visual feedback.
 *
 * Features:
 * - Range slider (0 to max)
 * - Direct number input for precision
 * - Visual color coding by difficulty
 * - Increment/decrement buttons
 * - Percentage display
 *
 * UX Pattern:
 * - Uses local state to allow smooth typing without immediate validation
 * - On blur, enforces minimum value (0)
 * - On focus/click, selects all text for easy replacement
 */

import { useCallback, useState, useEffect } from 'react'

interface DifficultySliderProps {
  label: string
  value: number
  max: number
  onChange: (value: number) => void
  color: string // Tailwind color classes
  percentage: number
}

export function DifficultySlider({
  label,
  value,
  max,
  onChange,
  color,
  percentage,
}: DifficultySliderProps) {
  // Local state for input display
  const [displayValue, setDisplayValue] = useState<string>(value.toString())
  const [isFocused, setIsFocused] = useState(false)

  // Sync display to parent value when not focused
  useEffect(() => {
    if (!isFocused) {
      setDisplayValue(value.toString())
    }
  }, [value, isFocused])

  const handleSliderChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = parseInt(e.target.value, 10)
      if (!isNaN(newValue)) {
        onChange(Math.min(max, Math.max(0, newValue)))
      }
    },
    [onChange, max]
  )

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      // Update display immediately
      setDisplayValue(e.target.value)

      // Update parent value
      if (e.target.value === '') {
        onChange(0)
      } else {
        const newValue = parseInt(e.target.value, 10)
        if (!isNaN(newValue)) {
          onChange(Math.min(max, Math.max(0, newValue)))
        }
      }
    },
    [onChange, max]
  )

  const handleFocus = useCallback((e: React.FocusEvent<HTMLInputElement>) => {
    setIsFocused(true)
    e.target.select() // Select all text on focus
  }, [])

  const handleClick = useCallback((e: React.MouseEvent<HTMLInputElement>) => {
    e.currentTarget.select() // Also select on click (handles already-focused case)
  }, [])

  const handleBlur = useCallback(() => {
    setIsFocused(false)
    // Enforce minimum on blur
    if (displayValue === '' || value < 0) {
      onChange(0)
      setDisplayValue('0')
    }
  }, [displayValue, value, onChange])

  const increment = useCallback(() => {
    if (value < max) {
      onChange(value + 1)
    }
  }, [value, max, onChange])

  const decrement = useCallback(() => {
    if (value > 0) {
      onChange(value - 1)
    }
  }, [value, onChange])

  return (
    <div className="space-y-2">
      {/* Label and Value */}
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-gray-700">{label}</label>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">{percentage.toFixed(0)}%</span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={decrement}
              disabled={value === 0}
              className="h-6 w-6 rounded border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              −
            </button>
            <input
              type="number"
              value={displayValue}
              onChange={handleInputChange}
              onFocus={handleFocus}
              onClick={handleClick}
              onBlur={handleBlur}
              min={0}
              max={max}
              className="w-16 rounded border border-gray-300 px-2 py-1 text-center text-sm"
            />
            <button
              type="button"
              onClick={increment}
              disabled={value === max}
              className="h-6 w-6 rounded border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              +
            </button>
          </div>
        </div>
      </div>

      {/* Slider */}
      <div className="relative">
        <input
          type="range"
          min={0}
          max={max}
          value={value}
          onChange={handleSliderChange}
          className={`w-full h-2 rounded-lg appearance-none cursor-pointer ${color}`}
          style={{
            background: `linear-gradient(to right, ${getColorValue(color)} 0%, ${getColorValue(color)} ${(value / max) * 100}%, #e5e7eb ${(value / max) * 100}%, #e5e7eb 100%)`,
          }}
        />
      </div>
    </div>
  )
}

/**
 * Map Tailwind color classes to actual color values for gradient
 */
function getColorValue(colorClass: string): string {
  const colorMap: Record<string, string> = {
    'bg-green-500': '#22c55e',
    'bg-blue-500': '#3b82f6',
    'bg-yellow-500': '#eab308',
    'bg-orange-500': '#f97316',
    'bg-red-500': '#ef4444',
  }

  return colorMap[colorClass] || '#3b82f6'
}
