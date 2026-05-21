'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { ReminderDateTimeFields } from '@/components/ReminderDateTimeFields'
import { buildRemindAtIso, tomorrowDateInReminderZone } from '@/lib/reminder-datetime'

interface SetReminderDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  leadId: string
  leadName: string
  onSuccess?: () => void
}

export function SetReminderDialog({
  open,
  onOpenChange,
  leadId,
  leadName,
  onSuccess,
}: SetReminderDialogProps) {
  const [date, setDate] = useState('')
  const [time, setTime] = useState('09:00')
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (open) {
      setDate(tomorrowDateInReminderZone())
      setTime('09:00')
      setNote('')
      setError('')
    }
  }, [open])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!date || !time) {
      setError('Date and time are required.')
      return
    }
    setSubmitting(true)
    try {
      const remindAt = buildRemindAtIso(date, time)
      const res = await fetch('/api/reminders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId, remindAt, note: note.trim() || undefined }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Failed to save reminder')
        return
      }
      onOpenChange(false)
      onSuccess?.()
    } catch {
      setError('Something went wrong')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Set conversation reminder</DialogTitle>
          <DialogDescription>
            Remind yourself to follow up with <strong>{leadName}</strong>. It will appear on top in
            Reminders on that day. If your account has an email, you will get a notification when
            the lead is still assigned to you.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <ReminderDateTimeFields
            date={date}
            onDateChange={setDate}
            time={time}
            onTimeChange={setTime}
            note={note}
            onNoteChange={setNote}
            disabled={submitting}
            defaultPeriod="AM"
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Saving...' : 'Save reminder'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
