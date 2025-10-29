/**
 * Configuration Summary Component
 *
 * Shows a comprehensive summary of all exam configuration settings.
 *
 * Features:
 * - Uploaded files with details
 * - Question types breakdown
 * - Difficulty distribution
 * - Edit buttons to go back to each step
 * - Visual cards for organization
 */

import { useNavigate } from 'react-router-dom'
import { FileText, Edit, CheckCircle } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/Card'
import { Button } from './ui/Button'
import { useFileUploadStore } from '../store/useFileUploadStore'
import { useExamConfigStore } from '../store/useExamConfigStore'
import type { QuestionType, DifficultyLevel } from '../store/useExamConfigStore'

export function ConfigurationSummary() {
  const navigate = useNavigate()

  // Get state from stores
  const uploadedFiles = useFileUploadStore((state) => state.uploadedFiles)
  const questionTypes = useExamConfigStore((state) => state.questionTypes)
  const difficultyDistribution = useExamConfigStore((state) => state.difficultyDistribution)
  const totalQuestions = useExamConfigStore((state) => state.getTotalQuestions())

  // Format file size
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  // Get readable labels
  const getQuestionTypeLabel = (type: QuestionType): string => {
    const labels: Record<QuestionType, string> = {
      multipleChoice: 'Multiple Choice',
      trueFalse: 'True/False',
      fillInTheBlanks: 'Fill in the Blanks',
      shortAnswer: 'Short Answer',
      essay: 'Essay',
      matching: 'Matching',
      identification: 'Identification',
    }
    return labels[type]
  }

  const getDifficultyLabel = (level: DifficultyLevel): string => {
    const labels: Record<DifficultyLevel, string> = {
      veryEasy: 'Very Easy',
      easy: 'Easy',
      moderate: 'Moderate',
      hard: 'Hard',
      veryHard: 'Very Hard',
    }
    return labels[level]
  }

  // Get difficulty color
  const getDifficultyColor = (level: DifficultyLevel): string => {
    const colors: Record<DifficultyLevel, string> = {
      veryEasy: 'bg-green-100 text-green-700',
      easy: 'bg-blue-100 text-blue-700',
      moderate: 'bg-yellow-100 text-yellow-700',
      hard: 'bg-orange-100 text-orange-700',
      veryHard: 'bg-red-100 text-red-700',
    }
    return colors[level]
  }

  return (
    <div className="space-y-6">
      {/* Files Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-blue-600" />
                Uploaded Files
              </CardTitle>
              <CardDescription>{uploadedFiles.length} file(s) ready for processing</CardDescription>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/create-exam')}
              className="flex items-center gap-2"
            >
              <Edit className="h-4 w-4" />
              Edit
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {uploadedFiles.map((file) => (
              <div
                key={file.id}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 rounded">
                    <FileText className="h-4 w-4 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{file.name}</p>
                    <p className="text-xs text-gray-500">{formatFileSize(file.size)}</p>
                  </div>
                </div>
                {file.status === 'valid' && (
                  <CheckCircle className="h-4 w-4 text-green-600" />
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Question Types Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Question Types</CardTitle>
              <CardDescription>{totalQuestions} total questions</CardDescription>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/create-exam/types')}
              className="flex items-center gap-2"
            >
              <Edit className="h-4 w-4" />
              Edit
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3">
            {(Object.entries(questionTypes) as [QuestionType, number][])
              .filter(([_, count]) => count > 0)
              .map(([type, count]) => (
                <div key={type} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <span className="text-sm font-medium text-gray-700">
                    {getQuestionTypeLabel(type)}
                  </span>
                  <span className="text-sm font-semibold text-blue-600">{count}</span>
                </div>
              ))}
          </div>
        </CardContent>
      </Card>

      {/* Difficulty Distribution Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Difficulty Distribution</CardTitle>
              <CardDescription>Distribution across difficulty levels</CardDescription>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/create-exam/difficulty')}
              className="flex items-center gap-2"
            >
              <Edit className="h-4 w-4" />
              Edit
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {(Object.entries(difficultyDistribution) as [DifficultyLevel, number][])
              .filter(([_, count]) => count > 0)
              .map(([level, count]) => {
                const percentage = totalQuestions > 0 ? (count / totalQuestions) * 100 : 0
                return (
                  <div key={level} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium text-gray-700">{getDifficultyLabel(level)}</span>
                      <span className="text-gray-600">
                        {count} ({percentage.toFixed(0)}%)
                      </span>
                    </div>
                    <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${getDifficultyColor(level).split(' ')[0]} transition-all duration-300`}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                )
              })}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
