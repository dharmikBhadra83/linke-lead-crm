'use client'

import { useEffect, useMemo, useState } from 'react'
import { Calendar as CalendarIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'

export interface ReminderDateTimeFieldsProps {
  /** YYYY-MM-DD */
  date: string
  onDateChange: (date: string) => void
  /** HH:mm (24h) */
  time: string
  onTimeChange: (time: string) => void
  note: string
  onNoteChange: (note: string) => void
  disabled?: boolean
  /** Earliest selectable day (default: start of today) */
  minDate?: Date
  /** Default AM/PM when time is empty or 24h is 09:00-style morning default */
  defaultPeriod?: Period
}

type Period = 'AM' | 'PM'

function parseDateString(dateStr: string): Date | undefined {
  if (!dateStr) return undefined
  const [y, m, d] = dateStr.split('-').map(Number)
  if (!y || !m || !d) return undefined
  return new Date(y, m - 1, d)
}

function toDateString(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function formatDisplayDate(dateStr: string): string {
  const d = parseDateString(dateStr)
  if (!d) return 'Pick a date'
  return d.toLocaleDateString(undefined, {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function time24To12(time24: string): { hour12: string; minute: string; period: Period } {
  const [hStr = '9', mStr = '00'] = time24 ? time24.split(':') : []
  let h = parseInt(hStr, 10)
  if (Number.isNaN(h)) h = 9
  const period: Period = h >= 12 ? 'PM' : 'AM'
  if (h === 0) h = 12
  else if (h > 12) h -= 12
  const minute = (mStr || '00').padStart(2, '0').slice(0, 2)
  return { hour12: String(h), minute, period }
}

function time12To24(hour12: string, minute: string, period: Period): string | null {
  const hRaw = parseInt(hour12, 10)
  const mRaw = parseInt(minute, 10)
  if (Number.isNaN(hRaw) || hRaw < 1 || hRaw > 12) return null
  if (Number.isNaN(mRaw) || mRaw < 0 || mRaw > 59) return null

  let h = hRaw
  if (period === 'AM') {
    if (h === 12) h = 0
  } else if (h !== 12) {
    h += 12
  }

  return `${String(h).padStart(2, '0')}:${String(mRaw).padStart(2, '0')}`
}

export function ReminderDateTimeFields({
  date,
  onDateChange,
  time,
  onTimeChange,
  note,
  onNoteChange,
  disabled = false,
  minDate,
  defaultPeriod = 'AM',
}: ReminderDateTimeFieldsProps) {
  const [dateOpen, setDateOpen] = useState(false)
  const initial = time24To12(time || (defaultPeriod === 'PM' ? '14:00' : '09:00'))
  const [hour12, setHour12] = useState(initial.hour12)
  const [minute, setMinute] = useState(initial.minute)
  const [period, setPeriod] = useState<Period>(time ? initial.period : defaultPeriod)

  const min = useMemo(() => {
    if (minDate) return minDate
    const t = new Date()
    t.setHours(0, 0, 0, 0)
    return t
  }, [minDate])

  const selectedDate = parseDateString(date)

  useEffect(() => {
    if (!time) {
      setHour12(defaultPeriod === 'PM' ? '2' : '9')
      setMinute('00')
      setPeriod(defaultPeriod)
      return
    }
    const { hour12: h, minute: m, period: p } = time24To12(time)
    setHour12(h)
    setMinute(m)
    setPeriod(p)
  }, [time, defaultPeriod])

  const commitTime = (h: string, m: string, p: Period) => {
    const next = time12To24(h, m, p)
    if (next) onTimeChange(next)
  }

  const handleHourBlur = () => {
    const digits = hour12.replace(/\D/g, '')
    const normalized = digits ? String(Math.min(12, Math.max(1, parseInt(digits, 10) || 1))) : '9'
    setHour12(normalized)
    commitTime(normalized, minute, period)
  }

  const handleMinuteBlur = () => {
    const digits = minute.replace(/\D/g, '')
    const n = digits ? Math.min(59, Math.max(0, parseInt(digits, 10) || 0)) : 0
    const normalized = String(n).padStart(2, '0')
    setMinute(normalized)
    commitTime(hour12, normalized, period)
  }

  const handlePeriodChange = (p: Period) => {
    setPeriod(p)
    commitTime(hour12, minute, p)
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Reminder date</Label>
          <Popover open={dateOpen} onOpenChange={setDateOpen}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                disabled={disabled}
                className={cn(
                  'w-full justify-start text-left font-normal',
                  !date && 'text-muted-foreground'
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
                {formatDisplayDate(date)}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                date={selectedDate}
                minDate={min}
                onDateChange={(d) => {
                  if (d) {
                    onDateChange(toDateString(d))
                    setDateOpen(false)
                  }
                }}
              />
            </PopoverContent>
          </Popover>
        </div>

        <div className="space-y-2">
          <Label>Reminder time</Label>
          <div className="flex items-center gap-2">
            <Input
              type="text"
              inputMode="numeric"
              placeholder="9"
              maxLength={2}
              value={hour12}
              onChange={(e) => setHour12(e.target.value.replace(/\D/g, '').slice(0, 2))}
              onBlur={handleHourBlur}
              disabled={disabled}
              className="w-14 text-center"
              aria-label="Hour"
            />
            <span className="text-muted-foreground">:</span>
            <Input
              type="text"
              inputMode="numeric"
              placeholder="00"
              maxLength={2}
              value={minute}
              onChange={(e) => setMinute(e.target.value.replace(/\D/g, '').slice(0, 2))}
              onBlur={handleMinuteBlur}
              disabled={disabled}
              className="w-14 text-center"
              aria-label="Minute"
            />
            <Select
              value={period}
              onValueChange={(v) => handlePeriodChange(v as Period)}
              disabled={disabled}
            >
              <SelectTrigger className="w-[88px]">
                <SelectValue placeholder={defaultPeriod} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="AM">AM</SelectItem>
                <SelectItem value="PM">PM</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="reminder-note">Reminder note (optional)</Label>
        <textarea
          id="reminder-note"
          className={cn(
            'flex min-h-[72px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm',
            'ring-offset-background placeholder:text-muted-foreground',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
            'disabled:cursor-not-allowed disabled:opacity-50'
          )}
          value={note}
          onChange={(e) => onNoteChange(e.target.value)}
          placeholder="e.g. Discuss pricing, send proposal"
          disabled={disabled}
        />
      </div>
    </div>
  )
}
