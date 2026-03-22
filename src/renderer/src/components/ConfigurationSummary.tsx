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
import { Files, PencilLine, CheckCircle } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/Card'
import { Button } from './ui/Button'
import { useFileUploadStore } from '../store/useFileUploadStore'
import { useExamConfigStore } from '../store/useExamConfigStore'
import type { QuestionType } from '../store/useExamConfigStore'

export function ConfigurationSummary() {
  const navigate = useNavigate()

  // Get state from stores
  const uploadedFiles = useFileUploadStore(state => state.uploadedFiles)
  const questionTypes = useExamConfigStore(state => state.questionTypes)
  const totalQuestions = useExamConfigStore(state => state.totalQuestions)

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
    }
    return labels[type]
  }

  return (
    <div className="space-y-6">
      {/* Files Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Files className="h-5 w-5 text-primary" />
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
              <PencilLine className="h-4 w-4" />
              Edit
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {uploadedFiles.map(file => (
              <div
                key={file.id}
                className="flex items-center justify-between rounded-lg border border-border/70 bg-muted/40 p-3"
              >
                <div className="flex items-center gap-3">
                  <div className="rounded p-2 bg-primary/15">
                    <Files className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{file.name}</p>
                    <p className="text-xs text-muted-foreground">{formatFileSize(file.size)}</p>
                  </div>
                </div>
                {file.status === 'valid' && <CheckCircle className="h-4 w-4 text-emerald-700" />}
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
              <CardDescription>Up to {totalQuestions} questions — AI assigns best type per concept</CardDescription>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/create-exam/types')}
              className="flex items-center gap-2"
            >
              <PencilLine className="h-4 w-4" />
              Edit
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3">
            {(Object.entries(questionTypes) as [QuestionType, boolean][])
              .filter(([_, enabled]) => enabled)
              .map(([type]) => (
                <div
                  key={type}
                  className="flex items-center gap-2 rounded-lg border border-border/70 bg-muted/40 p-3"
                >
                  <CheckCircle className="h-4 w-4 text-emerald-700 flex-shrink-0" />
                  <span className="text-sm font-medium text-foreground">
                    {getQuestionTypeLabel(type)}
                  </span>
                </div>
              ))}
          </div>
        </CardContent>
      </Card>

    </div>
  )
}
