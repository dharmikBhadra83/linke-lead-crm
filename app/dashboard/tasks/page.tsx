'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Sidebar } from '@/components/Sidebar'
import { ThemeToggle } from '@/components/ThemeToggle'
import { Spinner } from '@/components/ui/spinner'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { USER_ROLE_LABELS } from '@/lib/constants'
import { cn } from '@/lib/utils'
import { ClipboardList, CheckCircle2, ListTodo, CircleCheck, Plus } from 'lucide-react'
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination'

interface User {
  id: string
  username: string
  role: string
}

interface Task {
  id: string
  title: string
  description: string | null
  dueAt: string
  completedAt: string | null
  status: 'undone' | 'done' | 'backlog'
  createdAt: string
  assignedTo: { id: string; username: string; role: string }
  createdBy: { id: string; username: string }
}

interface PaginationState {
  page: number
  limit: number
  total: number
  totalPages: number
}

const DEFAULT_LIMIT = 10

export default function TasksPage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [tasks, setTasks] = useState<Task[]>([])
  const [pagination, setPagination] = useState<PaginationState | null>(null)
  const [users, setUsers] = useState<User[]>([])
  const [sidebarOpen, setSidebarOpen] = useState(true)

  // Create task modal (admin)
  const [addTaskOpen, setAddTaskOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [assignedToId, setAssignedToId] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  // Filters (used for both admin and non-admin)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [userIdFilter, setUserIdFilter] = useState('all')
  const [dueDateTo, setDueDateTo] = useState('')
  const [createdAtTo, setCreatedAtTo] = useState('')
  const [page, setPage] = useState(1)
  const [completingId, setCompletingId] = useState<string | null>(null)

  const checkSession = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/session')
      const data = await res.json()
      if (!res.ok || !data.user) {
        router.push('/login')
        return
      }
      setUser(data.user)
    } catch {
      router.push('/login')
    }
  }, [router])

  const buildTasksParams = useCallback(
    (pageNum: number) => {
      const params = new URLSearchParams()
      params.set('status', statusFilter)
      params.set('page', String(pageNum))
      params.set('limit', String(DEFAULT_LIMIT))
      if (userIdFilter && userIdFilter !== 'all') params.set('userId', userIdFilter)
      if (dueDateTo) params.set('dueDateTo', dueDateTo)
      if (createdAtTo) params.set('createdAtTo', createdAtTo)
      return params
    },
    [statusFilter, userIdFilter, dueDateTo, createdAtTo]
  )

  const fetchTasks = useCallback(
    async (pageNum: number = 1) => {
      if (!user) return
      try {
        setLoading(true)
        const params = buildTasksParams(pageNum)
        const res = await fetch(`/api/tasks?${params.toString()}`)
        const data = await res.json()
        if (res.ok) {
          setTasks(data.tasks || [])
          setPagination(data.pagination || null)
          setPage(pageNum)
        }
      } catch (e) {
        console.error(e)
      } finally {
        setLoading(false)
      }
    },
    [user, buildTasksParams]
  )

  const fetchUsers = useCallback(async () => {
    if (!user || user.role !== 'admin') return
    try {
      const res = await fetch('/api/users')
      const data = await res.json()
      if (res.ok) {
        const list = (data.users || []).filter(
          (u: User) => u.role === 'outreach' || u.role === 'lead_gen'
        )
        setUsers(list)
      }
    } catch (e) {
      console.error(e)
    }
  }, [user])

  useEffect(() => {
    checkSession()
  }, [checkSession])

  useEffect(() => {
    if (user) {
      fetchUsers()
    }
  }, [user, fetchUsers])

  useEffect(() => {
    if (user) {
      fetchTasks(1)
    }
  }, [user, statusFilter, userIdFilter, dueDateTo, createdAtTo, fetchTasks])

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!assignedToId || !title.trim()) {
      setError('Title and assignee are required.')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || undefined,
          assignedToId,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Failed to create task')
        setSubmitting(false)
        return
      }
      setTitle('')
      setDescription('')
      setAssignedToId('')
      setAddTaskOpen(false)
      fetchTasks(page)
    } catch {
      setError('Something went wrong')
    } finally {
      setSubmitting(false)
    }
  }

  const handleToggleComplete = async (task: Task) => {
    if (task.status === 'done' || task.completedAt) return
    setCompletingId(task.id)
    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completed: true }),
      })
      if (res.ok) fetchTasks(page)
    } catch {
      // ignore
    } finally {
      setCompletingId(null)
    }
  }

  const formatDue = (dueAt: string) => {
    const d = new Date(dueAt)
    return d.toLocaleString(undefined, {
      dateStyle: 'short',
      timeStyle: 'short',
    })
  }

  const formatDateOnly = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  const clearFilters = () => {
    setDueDateTo('')
    setCreatedAtTo('')
    setUserIdFilter('all')
    setPage(1)
  }

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner className="h-8 w-8" />
      </div>
    )
  }

  const isAdmin = user.role === 'admin'
  const assignableUsers = users

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Sidebar user={user} onLogout={() => router.push('/login')} isOpen={sidebarOpen} onToggle={setSidebarOpen} />
      <header
        className={cn(
          'flex items-center justify-between border-b border-border bg-card py-3 shrink-0 transition-all duration-300',
          sidebarOpen ? 'px-6' : 'pl-20 pr-6'
        )}
      >
        <h1 className="text-xl font-semibold text-foreground">
          {isAdmin ? 'Add Task' : 'MY TASK'}
        </h1>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <Button onClick={() => setAddTaskOpen(true)} size="sm" className="gap-1">
              <Plus className="h-4 w-4" />
              Create task
            </Button>
          )}
          <ThemeToggle />
        </div>
      </header>

      {/* Create task modal (admin) */}
      <Dialog open={addTaskOpen} onOpenChange={setAddTaskOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create new task</DialogTitle>
            <DialogDescription>
              Assign a task to an outreach or lead gen user. Task lasts 24 hours; incomplete tasks go to backlog.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddTask} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="task-title">Title</Label>
              <Input
                id="task-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Task title"
                required
                disabled={submitting}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="task-desc">Description (optional)</Label>
              <Input
                id="task-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Description"
                disabled={submitting}
              />
            </div>
            <div className="space-y-2">
              <Label>Assign to</Label>
              <Select value={assignedToId} onValueChange={setAssignedToId} disabled={submitting}>
                <SelectTrigger>
                  <SelectValue placeholder="Select user" />
                </SelectTrigger>
                <SelectContent>
                  {assignableUsers.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.username} ({USER_ROLE_LABELS[u.role as keyof typeof USER_ROLE_LABELS] ?? u.role})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAddTaskOpen(false)} disabled={submitting}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? 'Adding...' : 'Add task'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <main className={cn('flex-1 overflow-auto p-4', sidebarOpen && 'md:pl-[calc(16rem+1rem)]')}>
        <div className="space-y-6">
          <Card>
            <CardHeader className="space-y-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    {isAdmin ? (
                      <ListTodo className="h-5 w-5" />
                    ) : (
                      <CheckCircle2 className="h-5 w-5" />
                    )}
                    {isAdmin ? 'All tasks' : 'My tasks'}
                  </CardTitle>
                </div>
              </div>
              <div className="flex flex-wrap items-end gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Status</Label>
                  <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1) }}>
                    <SelectTrigger className="w-[130px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="undone">Undone</SelectItem>
                      <SelectItem value="done">Done</SelectItem>
                      <SelectItem value="backlog">Backlog</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {isAdmin && (
                  <div className="space-y-1">
                    <Label className="text-xs">User</Label>
                    <Select value={userIdFilter} onValueChange={(v) => { setUserIdFilter(v); setPage(1) }}>
                      <SelectTrigger className="w-[140px]">
                        <SelectValue placeholder="All users" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All users</SelectItem>
                        {users.map((u) => (
                          <SelectItem key={u.id} value={u.id}>
                            {u.username}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              <div className="space-y-1">
                <Label className="text-xs">Due date</Label>
                <Input
                  type="date"
                  value={dueDateTo}
                  onChange={(e) => { setDueDateTo(e.target.value); setPage(1) }}
                  className="w-[140px]"
                  title="Tasks whose due date is on this day"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Created date</Label>
                <Input
                  type="date"
                  value={createdAtTo}
                  onChange={(e) => { setCreatedAtTo(e.target.value); setPage(1) }}
                  className="w-[140px]"
                  title="Tasks created on this day"
                />
              </div>
                <Button variant="outline" size="sm" onClick={clearFilters}>
                  Clear filters
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {loading && tasks.length === 0 ? (
                <div className="flex justify-center py-8">
                  <Spinner className="h-8 w-8" />
                </div>
              ) : tasks.length === 0 ? (
                <p className="text-muted-foreground text-sm py-6">No tasks found.</p>
              ) : (
                <>
                  <div className="rounded-md border border-border overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          {!isAdmin && (
                            <TableHead className="w-10">Done</TableHead>
                          )}
                          <TableHead>Title</TableHead>
                          {isAdmin && <TableHead>Assignee</TableHead>}
                          <TableHead>Due</TableHead>
                          <TableHead>Created</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {tasks.map((t) => (
                          <TableRow key={t.id}>
                            {!isAdmin && (
                              <TableCell>
                                <Checkbox
                                  checked={!!t.completedAt}
                                  disabled={!!t.completedAt || completingId === t.id}
                                  onCheckedChange={() => handleToggleComplete(t)}
                                />
                              </TableCell>
                            )}
                            <TableCell>
                              <div>
                                <p className="font-medium">{t.title}</p>
                                {t.description && (
                                  <p className="text-xs text-muted-foreground">{t.description}</p>
                                )}
                              </div>
                            </TableCell>
                            {isAdmin && (
                              <TableCell>
                                {t.assignedTo.username}
                                <span className="ml-1 text-xs text-muted-foreground">
                                  ({USER_ROLE_LABELS[t.assignedTo.role as keyof typeof USER_ROLE_LABELS] ?? t.assignedTo.role})
                                </span>
                              </TableCell>
                            )}
                            <TableCell>{formatDue(t.dueAt)}</TableCell>
                            <TableCell>{formatDateOnly(t.createdAt)}</TableCell>
                            <TableCell>
                              {(() => {
                                const s = t.status ?? (t.completedAt ? 'done' : 'undone')
                                if (s === 'done') return <span className="text-green-600 dark:text-green-400">Done</span>
                                if (s === 'backlog') return <span className="text-amber-600 dark:text-amber-400">Backlog</span>
                                return <span className="text-muted-foreground">Undone</span>
                              })()}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  {pagination && pagination.totalPages > 1 && (
                    <div className="flex items-center justify-between mt-4">
                      <p className="text-sm text-muted-foreground">
                        Showing {(pagination.page - 1) * pagination.limit + 1}–{Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}
                      </p>
                      <Pagination>
                        <PaginationContent>
                          <PaginationItem>
                            <PaginationPrevious
                              href="#"
                              onClick={(e) => {
                                e.preventDefault()
                                if (pagination.page > 1) fetchTasks(pagination.page - 1)
                              }}
                              className={pagination.page <= 1 ? 'pointer-events-none opacity-50' : ''}
                            />
                          </PaginationItem>
                          {Array.from({ length: pagination.totalPages }, (_, i) => i + 1)
                            .filter((p) => p === 1 || p === pagination.totalPages || Math.abs(p - pagination.page) <= 1)
                            .map((p, idx, arr) => (
                              <PaginationItem key={p}>
                                {idx > 0 && arr[idx - 1] !== p - 1 && (
                                  <span className="px-2 text-muted-foreground">…</span>
                                )}
                                <PaginationLink
                                  href="#"
                                  onClick={(e) => {
                                    e.preventDefault()
                                    fetchTasks(p)
                                  }}
                                  isActive={pagination.page === p}
                                >
                                  {p}
                                </PaginationLink>
                              </PaginationItem>
                            ))}
                          <PaginationItem>
                            <PaginationNext
                              href="#"
                              onClick={(e) => {
                                e.preventDefault()
                                if (pagination.page < pagination.totalPages) fetchTasks(pagination.page + 1)
                              }}
                              className={pagination.page >= pagination.totalPages ? 'pointer-events-none opacity-50' : ''}
                            />
                          </PaginationItem>
                        </PaginationContent>
                      </Pagination>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
