/**
 * Exam Type Selection Component
 *
 * Users select which question types to include (checkboxes) and set a
 * total question cap. Pass 1 of the AI pipeline will autonomously assign
 * the best-fit type from the allowed set for each extracted concept.
 */

import { useState, useEffect } from 'react'
import {
  AlertCircle,
  CheckCircle2,
  RotateCcw,
  Sparkles,
  Minus,
  Plus,
  Scale,
  Type,
  PencilLine,
} from 'lucide-react'
import {
  useExamConfigStore,
  QUESTION_TYPES,
  EXAM_CONFIG_RULES,
  type QuestionType,
} from '../store/useExamConfigStore'
import { Button } from './ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card'
import { Input } from './ui/Input'

/**
 * Preset Configurations
 */
const PRESETS: Record<
  string,
  {
    name: string
    description: string
    types: Record<QuestionType, boolean>
    totalQuestions: number
  }
> = {
  quickQuiz: {
    name: 'Quick Quiz',
    description: '20 questions—multiple choice & true/false',
    types: { multipleChoice: true, trueFalse: true, fillInTheBlanks: false, shortAnswer: false },
    totalQuestions: 20,
  },
  standardExam: {
    name: 'Standard Exam',
    description: '35 questions—all types',
    types: { multipleChoice: true, trueFalse: true, fillInTheBlanks: true, shortAnswer: true },
    totalQuestions: 35,
  },
  comprehensive: {
    name: 'Comprehensive',
    description: '50 questions—all types',
    types: { multipleChoice: true, trueFalse: true, fillInTheBlanks: true, shortAnswer: true },
    totalQuestions: 50,
  },
}

const ICON_COLORS: Record<string, string> = {
  'check-circle': 'bg-emerald-100 text-emerald-700',
  scale: 'bg-cyan-100 text-cyan-700',
  'text-cursor': 'bg-amber-100 text-amber-700',
  pencil: 'bg-rose-100 text-rose-700',
}

function renderQuestionTypeIcon(icon: string) {
  switch (icon) {
    case 'check-circle':
      return <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
    case 'scale':
      return <Scale className="h-5 w-5" aria-hidden="true" />
    case 'text-cursor':
      return <Type className="h-5 w-5" aria-hidden="true" />
    case 'pencil':
      return <PencilLine className="h-5 w-5" aria-hidden="true" />
    default:
      return <Type className="h-5 w-5" aria-hidden="true" />
  }
}

export function ExamTypeSelection() {
  const {
    questionTypes,
    totalQuestions,
    setQuestionTypeEnabled,
    setTotalQuestions,
    resetQuestionTypes,
    isQuestionTypesValid,
  } = useExamConfigStore()

  const [inputValue, setInputValue] = useState<string>(totalQuestions.toString())
  const [isFocused, setIsFocused] = useState(false)

  // Sync input display when store value changes externally (e.g. preset applied)
  useEffect(() => {
    if (!isFocused) {
      setInputValue(totalQuestions.toString())
    }
  }, [totalQuestions, isFocused])

  const isValid = isQuestionTypesValid()
  const anyEnabled = Object.values(questionTypes).some(v => v)

  const applyPreset = (key: string) => {
    const preset = PRESETS[key]
    ;(Object.keys(preset.types) as QuestionType[]).forEach(type => {
      setQuestionTypeEnabled(type, preset.types[type])
    })
    setTotalQuestions(preset.totalQuestions)
  }

  const handleCountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value
    setInputValue(raw)
    const n = parseInt(raw, 10)
    if (!isNaN(n)) {
      setTotalQuestions(n)
    }
  }

  const handleCountBlur = () => {
    setIsFocused(false)
    const n = parseInt(inputValue, 10)
    if (isNaN(n)) {
      setTotalQuestions(EXAM_CONFIG_RULES.MIN_TOTAL_ITEMS)
    } else {
      setTotalQuestions(n) // store clamps to [10, 50]
    }
  }

  const handleDecrement = () => setTotalQuestions(totalQuestions - 1)
  const handleIncrement = () => setTotalQuestions(totalQuestions + 1)

  const getStatusMessage = () => {
    if (!anyEnabled) return 'Select at least one question type to continue'
    if (totalQuestions < EXAM_CONFIG_RULES.MIN_TOTAL_ITEMS)
      return `Minimum ${EXAM_CONFIG_RULES.MIN_TOTAL_ITEMS} questions required`
    if (totalQuestions > EXAM_CONFIG_RULES.MAX_TOTAL_ITEMS)
      return `Maximum ${EXAM_CONFIG_RULES.MAX_TOTAL_ITEMS} questions allowed`
    return 'Configuration valid!'
  }

  return (
    <div className="space-y-6">
      {/* Presets */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Quick Presets
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          {Object.entries(PRESETS).map(([key, preset]) => (
            <Button
              key={key}
              variant="outline"
              onClick={() => applyPreset(key)}
              className="h-auto flex-col items-start rounded-xl border-border/80 bg-background/80 p-4 text-left hover:bg-accent/70"
            >
              <span className="font-semibold">{preset.name}</span>
              <span className="mt-1 text-xs text-muted-foreground">{preset.description}</span>
            </Button>
          ))}
        </CardContent>
      </Card>

      {/* Question Types */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Allowed Question Types</h3>
          <Button variant="ghost" size="sm" onClick={resetQuestionTypes} className="gap-2">
            <RotateCcw className="h-4 w-4" />
            Reset
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          Select which types to include. The AI will pick the best fit for each concept.
        </p>

        <div className="space-y-3">
          {(Object.keys(QUESTION_TYPES) as QuestionType[]).map(type => {
            const cfg = QUESTION_TYPES[type]
            const enabled = questionTypes[type]
            const iconColor = ICON_COLORS[cfg.icon] ?? 'bg-primary/15 text-primary'

            return (
              <label
                key={type}
                className={`flex cursor-pointer items-start gap-4 rounded-xl border p-4 transition-all ${
                  enabled
                    ? 'border-primary/40 bg-primary/5 shadow-sm'
                    : 'border-border/70 bg-background hover:border-border'
                }`}
              >
                <input
                  type="checkbox"
                  checked={enabled}
                  onChange={e => setQuestionTypeEnabled(type, e.target.checked)}
                  className="mt-0.5 h-4 w-4 accent-primary"
                />
                <div
                  className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded ${iconColor}`}
                >
                  {renderQuestionTypeIcon(cfg.icon)}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-foreground">{cfg.label}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{cfg.description}</p>
                </div>
              </label>
            )
          })}
        </div>
      </div>

      {/* Total Question Count */}
      <Card>
        <CardContent className="p-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-semibold text-foreground">Total Questions</h3>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Cap: {EXAM_CONFIG_RULES.MIN_TOTAL_ITEMS}–{EXAM_CONFIG_RULES.MAX_TOTAL_ITEMS}{' '}
                questions
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleDecrement}
                disabled={totalQuestions <= EXAM_CONFIG_RULES.MIN_TOTAL_ITEMS}
                className="h-8 w-8 p-0"
                type="button"
              >
                <Minus className="h-4 w-4" />
              </Button>
              <Input
                type="number"
                value={inputValue}
                onChange={handleCountChange}
                onFocus={e => {
                  setIsFocused(true)
                  e.target.select()
                }}
                onBlur={handleCountBlur}
                min={EXAM_CONFIG_RULES.MIN_TOTAL_ITEMS}
                max={EXAM_CONFIG_RULES.MAX_TOTAL_ITEMS}
                className="w-20 h-8 text-center text-sm"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={handleIncrement}
                disabled={totalQuestions >= EXAM_CONFIG_RULES.MAX_TOTAL_ITEMS}
                className="h-8 w-8 p-0"
                type="button"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Validation Banner */}
      <Card
        className={`border-2 ${
          isValid
            ? 'border-emerald-300 bg-emerald-50/80'
            : anyEnabled
              ? 'border-amber-300 bg-amber-50/80'
              : 'border-border/80'
        }`}
      >
        <CardContent className="flex items-start gap-2 p-4">
          {isValid ? (
            <>
              <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-emerald-700" />
              <p className="text-sm font-medium text-emerald-900">{getStatusMessage()}</p>
            </>
          ) : (
            <>
              <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-700" />
              <p className="text-sm font-medium text-amber-900">{getStatusMessage()}</p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
