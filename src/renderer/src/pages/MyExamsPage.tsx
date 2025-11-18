/**
 * My Exams Page
 *
 * Displays user's exam history with search and filtering capabilities.
 *
 * Features:
 * - List of all user's past exams
 * - Search by title or topic
 * - Filter by date, questions count, etc.
 * - View exam details
 * - Download/re-download PDF
 * - Delete exam history entries
 *
 * Layout:
 * - Header with search and filters
 * - Exam cards/list with metadata
 * - Pagination for large histories
 * - Empty state for new users
 */

import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { 
  FileText, 
  Search, 
  Calendar, 
  Download,
  Trash2,
  Clock,
  Hash,
  Plus,
  SortDesc 
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { useAppStore } from '../store/useAppStore'

/**
 * Exam Record Type (matches database structure)
 */
interface ExamRecord {
  id: number
  user_id: number
  title: string
  topic: string
  total_questions: number
  file_path: string
  created_at: string
}

/**
 * Exam History Response Type
 */
interface ExamHistoryResponse {
  success: boolean
  exams?: ExamRecord[]
  error?: string
}

export function MyExamsPage() {
  const sessionToken = useAppStore(state => state.sessionToken)

  // State
  const [exams, setExams] = useState<ExamRecord[]>([])
  const [filteredExams, setFilteredExams] = useState<ExamRecord[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [sortBy, setSortBy] = useState<'date' | 'title' | 'questions'>('date')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')

  /**
   * Load exam history from backend
   */
  const loadExamHistory = useCallback(async () => {
    if (!sessionToken) {
      setError('Not authenticated')
      setIsLoading(false)
      return
    }

    try {
      setIsLoading(true)
      setError(null)

      const response = await window.electron.getExamHistory(sessionToken) as ExamHistoryResponse

      if (response.success && response.exams) {
        setExams(response.exams)
        console.log('Loaded', response.exams.length, 'exam records')
      } else {
        setError(response.error || 'Failed to load exam history')
      }
    } catch (err) {
      setError('Failed to load exam history')
      console.error('Load exam history error:', err)
    } finally {
      setIsLoading(false)
    }
  }, [sessionToken])

  // Load exam history on mount
  useEffect(() => {
    loadExamHistory()
  }, [loadExamHistory])

  // Filter and sort exams when search term or sort options change
  useEffect(() => {
    let filtered = [...exams]

    // Apply search filter
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase()
      filtered = filtered.filter(exam => 
        exam.title.toLowerCase().includes(term) ||
        exam.topic.toLowerCase().includes(term)
      )
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let comparison = 0
      
      switch (sortBy) {
        case 'date':
          comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          break
        case 'title':
          comparison = a.title.localeCompare(b.title)
          break
        case 'questions':
          comparison = a.total_questions - b.total_questions
          break
      }
      
      return sortOrder === 'asc' ? comparison : -comparison
    })

    setFilteredExams(filtered)
  }, [exams, searchTerm, sortBy, sortOrder])

  /**
   * Format date for display
   */
  const formatDate = (dateString: string): string => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  /**
   * Handle exam download (re-download PDF)
   */
  const handleDownload = async (exam: ExamRecord) => {
    // TODO: Implement PDF re-download functionality
    console.log('Download exam:', exam.title)
    // Could regenerate PDF or serve existing file
  }

  /**
   * Handle exam deletion
   */
  const handleDelete = async (examId: number) => {
    if (!confirm('Are you sure you want to delete this exam from your history?')) {
      return
    }
    
    // TODO: Implement exam deletion
    console.log('Delete exam:', examId)
    // Remove from database and update UI
  }

  /**
   * Toggle sort order
   */
  const toggleSort = (newSortBy: typeof sortBy) => {
    if (sortBy === newSortBy) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(newSortBy)
      setSortOrder('desc')
    }
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading your exam history...</p>
        </div>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-destructive">Error</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={loadExamHistory} className="w-full">
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">My Exams</h1>
          <p className="text-muted-foreground">
            {exams.length} exam{exams.length !== 1 ? 's' : ''} generated
          </p>
        </div>
        <Link to="/create-exam">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Create New Exam
          </Button>
        </Link>
      </div>

      {/* Empty state */}
      {exams.length === 0 ? (
        <div className="text-center py-12">
          <FileText className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">No exams yet</h3>
          <p className="text-muted-foreground mb-6">
            Create your first exam to see it appear here
          </p>
          <Link to="/create-exam">
            <Button size="lg">
              <Plus className="h-4 w-4 mr-2" />
              Create Your First Exam
            </Button>
          </Link>
        </div>
      ) : (
        <>
          {/* Search and Filters */}
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-col md:flex-row gap-4">
                {/* Search */}
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                    <Input
                      placeholder="Search exams by title or topic..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>

                {/* Sort Options */}
                <div className="flex gap-2">
                  <Button
                    variant={sortBy === 'date' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => toggleSort('date')}
                  >
                    <Calendar className="h-4 w-4 mr-1" />
                    Date
                    {sortBy === 'date' && (
                      <SortDesc className={`h-4 w-4 ml-1 ${sortOrder === 'asc' ? 'rotate-180' : ''}`} />
                    )}
                  </Button>
                  <Button
                    variant={sortBy === 'title' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => toggleSort('title')}
                  >
                    <FileText className="h-4 w-4 mr-1" />
                    Title
                    {sortBy === 'title' && (
                      <SortDesc className={`h-4 w-4 ml-1 ${sortOrder === 'asc' ? 'rotate-180' : ''}`} />
                    )}
                  </Button>
                  <Button
                    variant={sortBy === 'questions' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => toggleSort('questions')}
                  >
                    <Hash className="h-4 w-4 mr-1" />
                    Questions
                    {sortBy === 'questions' && (
                      <SortDesc className={`h-4 w-4 ml-1 ${sortOrder === 'asc' ? 'rotate-180' : ''}`} />
                    )}
                  </Button>
                </div>
              </div>

              {/* Results count */}
              {searchTerm && (
                <p className="text-sm text-muted-foreground mt-2">
                  {filteredExams.length} result{filteredExams.length !== 1 ? 's' : ''} for "{searchTerm}"
                </p>
              )}
            </CardContent>
          </Card>

          {/* Exam List */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredExams.map((exam) => (
              <Card key={exam.id} className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <CardTitle className="text-lg line-clamp-2">
                        {exam.title}
                      </CardTitle>
                      <CardDescription className="line-clamp-1">
                        {exam.topic}
                      </CardDescription>
                    </div>
                    <FileText className="h-5 w-5 text-muted-foreground flex-shrink-0 ml-2" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {/* Exam Stats */}
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Hash className="h-4 w-4" />
                        {exam.total_questions} questions
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="h-4 w-4" />
                        {formatDate(exam.created_at)}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2">
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="flex-1"
                        onClick={() => handleDownload(exam)}
                      >
                        <Download className="h-4 w-4 mr-1" />
                        Download
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => handleDelete(exam.id)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* No results after filtering */}
          {filteredExams.length === 0 && searchTerm && (
            <div className="text-center py-12">
              <Search className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No exams found</h3>
              <p className="text-muted-foreground mb-4">
                No exams match your search criteria
              </p>
              <Button 
                variant="outline" 
                onClick={() => setSearchTerm('')}
              >
                Clear Search
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  )
}