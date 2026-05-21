'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Sidebar } from '@/components/Sidebar'
import { ThemeToggle } from '@/components/ThemeToggle'
import { Spinner } from '@/components/ui/spinner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ReminderDateTimeFields } from '@/components/ReminderDateTimeFields'
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
import { LEAD_STATUS_LABELS } from '@/lib/constants'
import { cn } from '@/lib/utils'
import {
  buildRemindAtIso,
  endOfTodayInReminderZoneUtc,
  formatRemindAtDisplay,
  getRemindAtFormValues,
} from '@/lib/reminder-datetime'
import { Bell, Trash2, Pencil, ExternalLink } from 'lucide-react'

interface Reminder {
  id: string
  remindAt: string
  note: string | null
  emailSentAt: string | null
  lead: {
    id: string
    name: string
    company: string | null
    status: string
    assignedTo: { id: string; username: string } | null
  }
  user: { id: string; username: string }
}

function isDueTodayOrOverdue(remindAt: string): boolean {
  return new Date(remindAt).getTime() <= endOfTodayInReminderZoneUtc().getTime()
}

export default function RemindersPage() {
  const router = useRouter()
  const [user, setUser] = useState<{ id: string; username: string; role: string } | null>(null)
  const [reminders, setReminders] = useState<Reminder[]>([])
  const [loading, setLoading] = useState(true)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [editing, setEditing] = useState<Reminder | null>(null)
  const [editDate, setEditDate] = useState('')
  const [editTime, setEditTime] = useState('')
  const [editNote, setEditNote] = useState('')
  const [editSubmitting, setEditSubmitting] = useState(false)
  const [editError, setEditError] = useState('')

  const checkSession = useCallback(async () => {
    const res = await fetch('/api/auth/session')
    const data = await res.json()
    if (!res.ok || !data.user) {
      router.push('/login')
      return
    }
    setUser(data.user)
  }, [router])

  const fetchReminders = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/reminders')
      const data = await res.json()
      if (res.ok) setReminders(data.reminders || [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    checkSession()
  }, [checkSession])

  useEffect(() => {
    if (user) fetchReminders()
  }, [user, fetchReminders])

  const openEdit = (r: Reminder) => {
    setEditing(r)
    const { date, time24 } = getRemindAtFormValues(r.remindAt)
    setEditDate(date)
    setEditTime(time24)
    setEditNote(r.note ?? '')
    setEditError('')
  }

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editing) return
    setEditSubmitting(true)
    setEditError('')
    try {
      const res = await fetch(`/api/reminders/${editing.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          remindAt: buildRemindAtIso(editDate, editTime),
          note: editNote.trim() || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setEditError(data.error || 'Update failed')
        return
      }
      setEditing(null)
      fetchReminders()
    } catch {
      setEditError('Something went wrong')
    } finally {
      setEditSubmitting(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this reminder?')) return
    const res = await fetch(`/api/reminders/${id}`, { method: 'DELETE' })
    if (res.ok) fetchReminders()
  }

  const due = reminders.filter((r) => isDueTodayOrOverdue(r.remindAt))
  const upcoming = reminders.filter((r) => !isDueTodayOrOverdue(r.remindAt))

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner className="h-8 w-8" />
      </div>
    )
  }

  const renderTable = (rows: Reminder[], highlight?: boolean) => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Lead</TableHead>
          <TableHead>When</TableHead>
          <TableHead>Note</TableHead>
          <TableHead>Status</TableHead>
          {user.role === 'admin' && <TableHead>Assignee</TableHead>}
          <TableHead className="w-[120px]">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.length === 0 ? (
          <TableRow>
            <TableCell colSpan={user.role === 'admin' ? 6 : 5} className="text-muted-foreground text-center py-8">
              None
            </TableCell>
          </TableRow>
        ) : (
          rows.map((r) => (
            <TableRow
              key={r.id}
              className={cn(highlight && 'bg-amber-500/10 border-l-4 border-l-amber-500')}
            >
              <TableCell className="font-medium">{r.lead.name}</TableCell>
              <TableCell>{formatRemindAtDisplay(r.remindAt)}</TableCell>
              <TableCell className="max-w-[200px] truncate">{r.note || '—'}</TableCell>
              <TableCell>
                {LEAD_STATUS_LABELS[r.lead.status as keyof typeof LEAD_STATUS_LABELS] ?? r.lead.status}
              </TableCell>
              {user.role === 'admin' && (
                <TableCell>{r.lead.assignedTo?.username ?? '—'}</TableCell>
              )}
              <TableCell>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(r)} title="Edit">
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => router.push('/dashboard')}
                    title="Open leads"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive"
                    onClick={() => handleDelete(r.id)}
                    title="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  )

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Sidebar user={user} onLogout={() => router.push('/login')} isOpen={sidebarOpen} onToggle={setSidebarOpen} />
      <header
        className={cn(
          'flex items-center justify-between border-b border-border bg-card py-3 shrink-0',
          sidebarOpen ? 'px-6' : 'pl-20 pr-6'
        )}
      >
        <h1 className="text-xl font-semibold flex items-center gap-2">
          <Bell className="h-5 w-5" />
          Reminders
        </h1>
        <ThemeToggle />
      </header>

      <main className={cn('flex-1 overflow-auto p-4', sidebarOpen && 'md:pl-[calc(16rem+1rem)]')}>
        <div className="space-y-6 max-w-5xl">
          <p className="text-sm text-muted-foreground">
            Due today and overdue reminders appear first. Set reminders from the Leads page on any
            lead you own. Email is sent when the reminder is due and the lead is still assigned to you
            (add your email on your user record).
          </p>

          {loading ? (
            <div className="flex justify-center py-12">
              <Spinner className="h-8 w-8" />
            </div>
          ) : reminders.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                No reminders yet. Open Leads, claim a lead, and use &quot;Reminder&quot; to schedule a follow-up.
              </CardContent>
            </Card>
          ) : (
            <>
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg text-amber-600 dark:text-amber-400">
                    Due today & overdue ({due.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="overflow-x-auto">{renderTable(due, true)}</CardContent>
              </Card>
              {upcoming.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Upcoming ({upcoming.length})</CardTitle>
                  </CardHeader>
                  <CardContent className="overflow-x-auto">{renderTable(upcoming)}</CardContent>
                </Card>
              )}
            </>
          )}
        </div>
      </main>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit reminder</DialogTitle>
            <DialogDescription>{editing?.lead.name}</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUpdate} className="space-y-4">
            <ReminderDateTimeFields
              date={editDate}
              onDateChange={setEditDate}
              time={editTime}
              onTimeChange={setEditTime}
              note={editNote}
              onNoteChange={setEditNote}
              disabled={editSubmitting}
            />
            {editError && <p className="text-sm text-destructive">{editError}</p>}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditing(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={editSubmitting}>
                {editSubmitting ? 'Saving...' : 'Save'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
