/**
 * Home Page Component
 *
 * Main dashboard showing user's exam projects and quick actions.
 *
 * Features:
 * - List of recent projects
 * - Create new exam button
 * - Project statistics
 */

import { Plus, FileText, Clock, CheckCircle2 } from 'lucide-react'
import { useAppStore } from '../store/useAppStore'
import { Button } from '../components/ui/Button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/Card'

export function HomePage() {
  const projects = useAppStore((state) => state.projects)
  const user = useAppStore((state) => state.user)

  // Calculate statistics
  const stats = {
    total: projects.length,
    completed: projects.filter((p) => p.status === 'completed').length,
    inProgress: projects.filter((p) => p.status === 'processing').length,
  }

  return (
    <div className="space-y-8">
      {/* Welcome Section */}
      <div>
        <h2 className="text-3xl font-bold tracking-tight">
          Welcome{user ? `, ${user.name}` : ' to Qreate'}!
        </h2>
        <p className="text-muted-foreground">
          Create AI-powered exams from your study materials
        </p>
      </div>

      {/* Quick Action */}
      <Card className="border-dashed">
        <CardContent className="flex items-center justify-between p-6">
          <div>
            <h3 className="text-lg font-semibold">Create New Exam</h3>
            <p className="text-sm text-muted-foreground">
              Upload your study materials and generate custom exams
            </p>
          </div>
          <Button size="lg" className="gap-2">
            <Plus className="h-4 w-4" />
            New Exam
          </Button>
        </CardContent>
      </Card>

      {/* Statistics */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Projects</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">All time</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">In Progress</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.inProgress}</div>
            <p className="text-xs text-muted-foreground">Currently processing</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.completed}</div>
            <p className="text-xs text-muted-foreground">Ready to use</p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Projects */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-2xl font-semibold tracking-tight">Recent Projects</h3>
        </div>

        {projects.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <FileText className="mb-4 h-12 w-12 text-muted-foreground" />
              <p className="text-center text-sm text-muted-foreground">
                No projects yet. Create your first exam to get started!
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {projects.map((project) => (
              <Card key={project.id} className="hover:shadow-md transition-shadow cursor-pointer">
                <CardHeader>
                  <CardTitle className="line-clamp-1">{project.name}</CardTitle>
                  <CardDescription>
                    {new Date(project.createdAt).toLocaleDateString()}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      {project.filesCount} {project.filesCount === 1 ? 'file' : 'files'}
                    </span>
                    <span
                      className={`rounded-full px-2 py-1 text-xs font-medium ${
                        project.status === 'completed'
                          ? 'bg-green-100 text-green-700'
                          : project.status === 'processing'
                            ? 'bg-blue-100 text-blue-700'
                            : project.status === 'failed'
                              ? 'bg-red-100 text-red-700'
                              : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {project.status}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
