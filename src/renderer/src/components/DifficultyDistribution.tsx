/**
 * Difficulty Distribution Component
 *
 * Allows users to configure how questions are distributed across difficulty levels.
 *
 * Features:
 * - 5 difficulty levels (Very Easy → Very Hard)
 * - Must sum to total questions exactly
 * - Visual progress bar with color coding
 * - Auto-distribute button (uses default percentages)
 * - Real-time validation
 * - Clear visual feedback
 *
 * UX Principles:
 * - Show remaining/over count prominently
 * - Disable "Next" until distribution is valid
 * - Auto-distribute provides good defaults
 * - Color-code by difficulty level
 */

import { useCallback } from 'react'
import { DifficultySlider } from './DifficultySlider'
import { useExamConfigStore } from '../store/useExamConfigStore'
import type { DifficultyLevel } from '../store/useExamConfigStore'

export function DifficultyDistribution() {
  const totalQuestions = useExamConfigStore(state => state.getTotalQuestions())
  const difficultyDistribution = useExamConfigStore(state => state.difficultyDistribution)
  const setDifficultyQuantity = useExamConfigStore(state => state.setDifficultyQuantity)
  const autoDistributeDifficulty = useExamConfigStore(state => state.autoDistributeDifficulty)

  // Calculate totals
  const totalDistributed = Object.values(difficultyDistribution).reduce((sum, val) => sum + val, 0)
  const remaining = totalQuestions - totalDistributed
  const isValid = remaining === 0
  const isOver = remaining < 0

  // Difficulty levels configuration
  const difficultyLevels: Array<{
    key: DifficultyLevel
    label: string
    color: string
  }> = [
    { key: 'veryEasy', label: 'Very Easy', color: 'bg-green-500' },
    { key: 'easy', label: 'Easy', color: 'bg-blue-500' },
    { key: 'moderate', label: 'Moderate', color: 'bg-yellow-500' },
    { key: 'hard', label: 'Hard', color: 'bg-orange-500' },
    { key: 'veryHard', label: 'Very Hard', color: 'bg-red-500' },
  ]

  const handleAutoDistribute = useCallback(() => {
    autoDistributeDifficulty(totalQuestions)
  }, [autoDistributeDifficulty, totalQuestions])

  return (
    <div className="space-y-6">
      {/* Header with Auto-Distribute */}
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Difficulty Distribution</h3>
          <p className="text-sm text-gray-600 mt-1">
            Distribute {totalQuestions} questions across difficulty levels
          </p>
        </div>
        <button
          type="button"
          onClick={handleAutoDistribute}
          className="px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
        >
          Auto-Distribute
        </button>
      </div>

      {/* Progress Bar */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium text-gray-700">Total Distributed</span>
          <span
            className={`font-semibold ${
              isOver ? 'text-red-600' : isValid ? 'text-green-600' : 'text-gray-600'
            }`}
          >
            {totalDistributed} / {totalQuestions}
          </span>
        </div>

        {/* Visual Progress Bar */}
        <div className="h-3 w-full bg-gray-200 rounded-full overflow-hidden flex">
          {difficultyLevels.map(({ key, color }) => {
            const percentage =
              totalQuestions > 0 ? (difficultyDistribution[key] / totalQuestions) * 100 : 0
            if (difficultyDistribution[key] === 0) return null

            return (
              <div
                key={key}
                className={`${color} transition-all duration-300`}
                style={{ width: `${percentage}%` }}
                title={`${key}: ${difficultyDistribution[key]} (${percentage.toFixed(1)}%)`}
              />
            )
          })}
        </div>

        {/* Status Message */}
        {!isValid && (
          <div className={`text-sm font-medium ${isOver ? 'text-red-600' : 'text-orange-600'}`}>
            {isOver
              ? `Over by ${Math.abs(remaining)} question${Math.abs(remaining) !== 1 ? 's' : ''}. Reduce some values.`
              : `${remaining} question${remaining !== 1 ? 's' : ''} remaining to distribute.`}
          </div>
        )}

        {isValid && (
          <div className="flex items-center gap-2 text-sm font-medium text-green-600">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
            Perfect! All questions distributed.
          </div>
        )}
      </div>

      {/* Difficulty Sliders */}
      <div className="space-y-4">
        {difficultyLevels.map(({ key, label, color }) => {
          const percentage =
            totalQuestions > 0 ? (difficultyDistribution[key] / totalQuestions) * 100 : 0

          return (
            <DifficultySlider
              key={key}
              label={label}
              value={difficultyDistribution[key]}
              max={totalQuestions}
              onChange={value => setDifficultyQuantity(key, value)}
              color={color}
              percentage={percentage}
            />
          )
        })}
      </div>

      {/* Info Box */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex gap-3">
          <div className="flex-shrink-0">
            <svg
              className="w-5 h-5 text-blue-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <div className="text-sm text-blue-900">
            <p className="font-medium mb-1">Tip: Use Auto-Distribute</p>
            <p className="text-blue-700">
              Click "Auto-Distribute" to use a balanced distribution (20% Very Easy, 20% Easy, 30%
              Moderate, 20% Hard, 10% Very Hard).
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
