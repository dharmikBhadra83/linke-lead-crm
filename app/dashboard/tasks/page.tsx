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
import { ClipboardList, CheckCircle2, ListTodo, CircleCheck, Plus, Trash2, Pencil, AlertTriangle } from 'lucide-react'
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
  const [createdDate, setCreatedDate] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const getDefaultCreateDueDates = useCallback(() => {
    const now = new Date()
    const in24 = new Date(now.getTime() + 24 * 60 * 60 * 1000)
    const toLocalDateStr = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    return { created: toLocalDateStr(now), due: toLocalDateStr(in24) }
  }, [])

  // Filters (used for both admin and non-admin)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [userIdFilter, setUserIdFilter] = useState('all')
  const [dueDateTo, setDueDateTo] = useState('')
  const [createdAtTo, setCreatedAtTo] = useState('')
  const [page, setPage] = useState(1)
  const [completingId, setCompletingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [taskToDelete, setTaskToDelete] = useState<Task | null>(null)
  const [deleteError, setDeleteError] = useState('')
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editAssignedToId, setEditAssignedToId] = useState('')
  const [editCreatedDate, setEditCreatedDate] = useState('')
  const [editDueDate, setEditDueDate] = useState('')
  const [editSubmitting, setEditSubmitting] = useState(false)
  const [editError, setEditError] = useState('')

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
    if (dueDate && createdDate && dueDate < createdDate) {
      setError('Due date must be on or after created date.')
      return
    }
    const defaults = getDefaultCreateDueDates()
    const usingDefaultDates = createdDate === defaults.created && dueDate === defaults.due
    // Send current date + live current time (browser UTC) – never 05:30
    const now = new Date()
    const pad = (n: number) => String(n).padStart(2, '0')
    const utcTime = `${pad(now.getUTCHours())}:${pad(now.getUTCMinutes())}:${pad(now.getUTCSeconds())}`
    const dateWithCurrentTime = (dateStr: string) => `${dateStr}T${utcTime}.000Z`
    setSubmitting(true)
    try {
      const payload: Record<string, unknown> = {
        title: title.trim(),
        description: description.trim() || undefined,
        assignedToId,
        createdAt: usingDefaultDates ? now.toISOString() : dateWithCurrentTime(createdDate),
        dueAt: usingDefaultDates ? new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString() : dateWithCurrentTime(dueDate),
      }
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
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
      const { created, due } = getDefaultCreateDueDates()
      setCreatedDate(created)
      setDueDate(due)
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

  const openDeleteModal = (task: Task) => {
    setTaskToDelete(task)
    setDeleteError('')
  }

  const confirmDeleteTask = async () => {
    if (!taskToDelete) return
    setDeletingId(taskToDelete.id)
    setDeleteError('')
    try {
      const res = await fetch(`/api/tasks/${taskToDelete.id}`, { method: 'DELETE' })
      if (res.ok) {
        setTaskToDelete(null)
        fetchTasks(page)
      } else {
        const data = await res.json()
        setDeleteError(data.error || 'Failed to delete task')
      }
    } catch {
      setDeleteError('Failed to delete task')
    } finally {
      setDeletingId(null)
    }
  }

  const openEditModal = (task: Task) => {
    setEditingTask(task)
    setEditTitle(task.title)
    setEditDescription(task.description ?? '')
    setEditAssignedToId(task.assignedTo?.id ?? '')
    setEditCreatedDate(new Date(task.createdAt).toISOString().slice(0, 10))
    setEditDueDate(new Date(task.dueAt).toISOString().slice(0, 10))
    setEditError('')
  }

  const handleUpdateTask = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingTask) return
    setEditError('')
    if (!editTitle.trim()) {
      setEditError('Title is required.')
      return
    }
    if (editDueDate && editCreatedDate && editDueDate < editCreatedDate) {
      setEditError('Due date must be on or after created date.')
      return
    }
    const now = new Date()
    const pad = (n: number) => String(n).padStart(2, '0')
    const utcTime = `${pad(now.getUTCHours())}:${pad(now.getUTCMinutes())}:${pad(now.getUTCSeconds())}`
    const dateWithCurrentTime = (dateStr: string) =>
      dateStr ? `${dateStr}T${utcTime}.000Z` : undefined
    setEditSubmitting(true)
    try {
      const res = await fetch(`/api/tasks/${editingTask.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: editTitle.trim(),
          description: editDescription.trim() || null,
          assignedToId: editAssignedToId || undefined,
          createdAt: dateWithCurrentTime(editCreatedDate),
          dueAt: dateWithCurrentTime(editDueDate),
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setEditError(data.error || 'Failed to update task')
        setEditSubmitting(false)
        return
      }
      setEditingTask(null)
      fetchTasks(page)
    } catch {
      setEditError('Something went wrong')
    } finally {
      setEditSubmitting(false)
    }
  }

  const DISPLAY_TIMEZONE = 'Asia/Kolkata'
  const formatDateTime = (dateStr: string) => {
    const d = new Date(dateStr)
    if (Number.isNaN(d.getTime())) return dateStr
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: DISPLAY_TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
    const parts = formatter.formatToParts(d)
    const get = (type: string) => parts.find((p) => p.type === type)?.value ?? ''
    const y = get('year')
    const m = get('month')
    const day = get('day')
    const h = get('hour')
    const min = get('minute')
    return `${y}-${m}-${day} ${h}:${min}`
  }

  const formatDue = (dueAt: string) => formatDateTime(dueAt)
  const formatDateOnly = (dateStr: string) => formatDateTime(dateStr)

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
      <Dialog
        open={addTaskOpen}
        onOpenChange={(open) => {
          setAddTaskOpen(open)
          if (open) {
            const { created, due } = getDefaultCreateDueDates()
            setCreatedDate(created)
            setDueDate(due)
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create new task</DialogTitle>
            <DialogDescription>
              Assign a task. Created and due dates are required; due date must be on or after created date. Default is today and 24 hours from now. Incomplete tasks go to backlog.
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
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="task-created">Created date</Label>
                <Input
                  id="task-created"
                  type="date"
                  value={createdDate}
                  onChange={(e) => {
                    const v = e.target.value
                    setCreatedDate(v)
                    if (dueDate && v && dueDate < v) setDueDate(v)
                  }}
                  disabled={submitting}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="task-due">Due date</Label>
                <Input
                  id="task-due"
                  type="date"
                  value={dueDate}
                  min={createdDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  disabled={submitting}
                  required
                />
              </div>
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

      {/* Edit task modal (admin) */}
      <Dialog open={!!editingTask} onOpenChange={(open) => !open && setEditingTask(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit task</DialogTitle>
            <DialogDescription>
              Update title, description, assignee, or dates. Due date must be on or after created date.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUpdateTask} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-task-title">Title</Label>
              <Input
                id="edit-task-title"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                placeholder="Task title"
                required
                disabled={editSubmitting}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-task-desc">Description (optional)</Label>
              <Input
                id="edit-task-desc"
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                placeholder="Description"
                disabled={editSubmitting}
              />
            </div>
            <div className="space-y-2">
              <Label>Assign to</Label>
              <Select value={editAssignedToId} onValueChange={setEditAssignedToId} disabled={editSubmitting}>
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
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-task-created">Created date</Label>
                <Input
                  id="edit-task-created"
                  type="date"
                  value={editCreatedDate}
                  onChange={(e) => {
                    const v = e.target.value
                    setEditCreatedDate(v)
                    if (editDueDate && v && editDueDate < v) setEditDueDate(v)
                  }}
                  disabled={editSubmitting}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-task-due">Due date</Label>
                <Input
                  id="edit-task-due"
                  type="date"
                  value={editDueDate}
                  min={editCreatedDate}
                  onChange={(e) => setEditDueDate(e.target.value)}
                  disabled={editSubmitting}
                />
              </div>
            </div>
            {editError && <p className="text-sm text-destructive">{editError}</p>}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditingTask(null)} disabled={editSubmitting}>
                Cancel
              </Button>
              <Button type="submit" disabled={editSubmitting}>
                {editSubmitting ? 'Saving...' : 'Save changes'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete task confirmation modal (admin) */}
      <Dialog open={!!taskToDelete} onOpenChange={(open) => !open && setTaskToDelete(null)}>
        <DialogContent className="sm:max-w-md">
          <div className="flex flex-col items-center gap-4 py-2">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10">
              <AlertTriangle className="h-7 w-7 text-destructive" />
            </div>
            <div className="space-y-2 text-center">
              <DialogTitle className="text-lg">Delete task?</DialogTitle>
              <DialogDescription asChild>
                <p className="text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">&quot;{taskToDelete?.title}&quot;</span>
                  {' '}will be permanently removed. This action cannot be undone.
                </p>
              </DialogDescription>
            </div>
            {deleteError && (
              <p className="text-sm text-destructive">{deleteError}</p>
            )}
            <div className="flex w-full gap-5 pt-2 justify-center">
              <Button
                type="button"
                variant="outline"
                className="flex-1 sm:flex-none"
                onClick={() => setTaskToDelete(null)}
                disabled={!!deletingId}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="destructive"
                className="flex-1 sm:flex-none"
                onClick={confirmDeleteTask}
                disabled={!!deletingId}
              >
                {deletingId ? 'Deleting...' : 'Delete task'}
              </Button>
            </div>
          </div>
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
                          {isAdmin && <TableHead className="w-[100px]">Actions</TableHead>}
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
                            {isAdmin && (
                              <TableCell>
                                <div className="flex items-center gap-1">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={() => openEditModal(t)}
                                    title="Edit task"
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                                    onClick={() => openDeleteModal(t)}
                                    disabled={deletingId === t.id}
                                    title="Delete task"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </TableCell>
                            )}
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
