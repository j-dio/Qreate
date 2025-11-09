/**
 * Exam Type Selection Component
 *
 * Main component for configuring question types and quantities.
 *
 * Features:
 * - All question type inputs
 * - Real-time total counter
 * - Validation feedback
 * - Quick preset options
 * - Clear/reset functionality
 *
 * User Experience:
 * - See all available question types at once
 * - Adjust quantities easily with +/- buttons or direct input
 * - Get immediate feedback on total count
 * - Use presets for common exam configurations
 * - Clear validation on min/max constraints
 */

import { AlertCircle, CheckCircle2, RotateCcw, Sparkles } from 'lucide-react'
import {
  useExamConfigStore,
  QUESTION_TYPES,
  EXAM_CONFIG_RULES,
  type QuestionType,
} from '../store/useExamConfigStore'
import { QuestionTypeInput } from './QuestionTypeInput'
import { Button } from './ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card'

/**
 * Preset Configurations
 *
 * Quick setup options for common exam types
 */
const PRESETS = {
  quickQuiz: {
    name: 'Quick Quiz',
    description: '20 questions, mostly multiple choice',
    config: {
      multipleChoice: 15,
      trueFalse: 5,
      fillInTheBlanks: 0,
      shortAnswer: 0,
      essay: 0,
      matching: 0,
      identification: 0,
    },
  },
  standardExam: {
    name: 'Standard Exam',
    description: '50 questions, mixed types',
    config: {
      multipleChoice: 25,
      trueFalse: 10,
      fillInTheBlanks: 5,
      shortAnswer: 5,
      essay: 2,
      matching: 3,
      identification: 0,
    },
  },
  comprehensive: {
    name: 'Comprehensive',
    description: '100 questions, all types',
    config: {
      multipleChoice: 40,
      trueFalse: 20,
      fillInTheBlanks: 15,
      shortAnswer: 10,
      essay: 5,
      matching: 5,
      identification: 5,
    },
  },
}

export function ExamTypeSelection() {
  const {
    questionTypes,
    setQuestionTypeQuantity,
    resetQuestionTypes,
    getTotalQuestions,
    isQuestionTypesValid,
  } = useExamConfigStore()

  const totalQuestions = getTotalQuestions()
  const isValid = isQuestionTypesValid()

  /**
   * Apply a preset configuration
   */
  const applyPreset = (presetKey: keyof typeof PRESETS) => {
    const preset = PRESETS[presetKey]
    Object.entries(preset.config).forEach(([type, quantity]) => {
      setQuestionTypeQuantity(type as QuestionType, quantity)
    })
  }

  /**
   * Get validation status message
   */
  const getStatusMessage = () => {
    if (totalQuestions === 0) {
      return `Add at least ${EXAM_CONFIG_RULES.MIN_TOTAL_ITEMS} questions to continue`
    }

    if (totalQuestions < EXAM_CONFIG_RULES.MIN_TOTAL_ITEMS) {
      return `Add ${EXAM_CONFIG_RULES.MIN_TOTAL_ITEMS - totalQuestions} more question(s) (minimum ${EXAM_CONFIG_RULES.MIN_TOTAL_ITEMS})`
    }

    if (totalQuestions > EXAM_CONFIG_RULES.MAX_TOTAL_ITEMS) {
      return `Remove ${totalQuestions - EXAM_CONFIG_RULES.MAX_TOTAL_ITEMS} question(s) (maximum ${EXAM_CONFIG_RULES.MAX_TOTAL_ITEMS})`
    }

    return 'Configuration valid!'
  }

  /**
   * Get progress percentage for visual feedback
   */
  const getProgressPercentage = () => {
    return Math.min((totalQuestions / EXAM_CONFIG_RULES.MAX_TOTAL_ITEMS) * 100, 100)
  }

  return (
    <div className="space-y-6">
      {/* Presets Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-blue-600" />
            Quick Presets
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          {Object.entries(PRESETS).map(([key, preset]) => (
            <Button
              key={key}
              variant="outline"
              onClick={() => applyPreset(key as keyof typeof PRESETS)}
              className="h-auto flex-col items-start p-4 text-left"
            >
              <span className="font-semibold">{preset.name}</span>
              <span className="text-xs text-muted-foreground mt-1">{preset.description}</span>
            </Button>
          ))}
        </CardContent>
      </Card>

      {/* Question Types Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Question Types</h3>
          <Button variant="ghost" size="sm" onClick={resetQuestionTypes} className="gap-2">
            <RotateCcw className="h-4 w-4" />
            Reset
          </Button>
        </div>

        {/* Question Type Inputs */}
        <div className="space-y-3">
          {(Object.keys(QUESTION_TYPES) as QuestionType[]).map(type => {
            const config = QUESTION_TYPES[type]
            return (
              <QuestionTypeInput
                key={type}
                label={config.label}
                description={config.description}
                icon={config.icon}
                value={questionTypes[type]}
                onChange={value => setQuestionTypeQuantity(type, value)}
                min={EXAM_CONFIG_RULES.MIN_ITEMS_PER_TYPE}
                max={EXAM_CONFIG_RULES.MAX_ITEMS_PER_TYPE}
              />
            )
          })}
        </div>
      </div>

      {/* Total Counter & Validation */}
      <Card
        className={`border-2 ${
          isValid
            ? 'border-green-500 bg-green-50'
            : totalQuestions > 0
              ? 'border-orange-500 bg-orange-50'
              : 'border-gray-300'
        }`}
      >
        <CardContent className="p-6">
          {/* Total Count */}
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-2xl font-bold">Total Questions</h3>
              <p className="text-sm text-muted-foreground">
                {EXAM_CONFIG_RULES.MIN_TOTAL_ITEMS} - {EXAM_CONFIG_RULES.MAX_TOTAL_ITEMS} questions
                required
              </p>
            </div>
            <div
              className={`text-5xl font-bold ${
                isValid
                  ? 'text-green-600'
                  : totalQuestions > 0
                    ? 'text-orange-600'
                    : 'text-gray-400'
              }`}
            >
              {totalQuestions}
            </div>
          </div>

          {/* Progress Bar */}
          <div className="mb-4">
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-300 ${
                  isValid
                    ? 'bg-green-500'
                    : totalQuestions > EXAM_CONFIG_RULES.MAX_TOTAL_ITEMS
                      ? 'bg-red-500'
                      : 'bg-orange-500'
                }`}
                style={{ width: `${getProgressPercentage()}%` }}
              />
            </div>
          </div>

          {/* Status Message */}
          <div className="flex items-start gap-2">
            {isValid ? (
              <>
                <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm font-medium text-green-900">{getStatusMessage()}</p>
              </>
            ) : (
              <>
                <AlertCircle className="h-5 w-5 text-orange-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm font-medium text-orange-900">{getStatusMessage()}</p>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
