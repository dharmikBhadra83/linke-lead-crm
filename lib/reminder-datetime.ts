import { DateTime } from 'luxon'

/** All reminder date/times are entered and shown in IST */
export const REMINDER_TIMEZONE = 'Asia/Kolkata'

/** Build ISO string with +05:30 for API (e.g. 2026-05-21T14:10:00+05:30) */
export function buildRemindAtIso(date: string, time24: string): string {
  const [y, m, d] = date.split('-').map(Number)
  const [hour, minute] = time24.split(':').map(Number)
  const dt = DateTime.fromObject(
    {
      year: y,
      month: m,
      day: d,
      hour: Number.isNaN(hour) ? 9 : hour,
      minute: Number.isNaN(minute) ? 0 : minute,
      second: 0,
    },
    { zone: REMINDER_TIMEZONE }
  )
  if (!dt.isValid) return `${date}T${time24}:00+05:30`
  return dt.toISO({ includeOffset: true }) ?? `${date}T${time24}:00+05:30`
}

/** Parse client/API remindAt string as IST unless offset/Z is present */
export function parseRemindAtFromClient(str: string): Date | null {
  const s = str.trim()
  if (!s) return null

  if (/[zZ]$|[+-]\d{2}:?\d{2}$/.test(s)) {
    const dt = DateTime.fromISO(s, { setZone: true })
    return dt.isValid ? dt.toUTC().toJSDate() : null
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2}))?)?/.exec(s)
  if (!match) return null

  const [, y, mo, d, hh = '09', mm = '00'] = match
  const dt = DateTime.fromObject(
    {
      year: +y!,
      month: +mo!,
      day: +d!,
      hour: +hh,
      minute: +mm,
      second: 0,
    },
    { zone: REMINDER_TIMEZONE }
  )
  return dt.isValid ? dt.toUTC().toJSDate() : null
}

export function formatRemindAtDisplay(date: Date | string): string {
  const dt = DateTime.fromJSDate(new Date(date), { zone: REMINDER_TIMEZONE })
  return dt.toFormat('dd MMM yyyy, h:mm a')
}

export function getRemindAtFormValues(date: Date | string): { date: string; time24: string } {
  const dt = DateTime.fromJSDate(new Date(date), { zone: REMINDER_TIMEZONE })
  return {
    date: dt.toFormat('yyyy-MM-dd'),
    time24: dt.toFormat('HH:mm'),
  }
}

export function endOfTodayInReminderZoneUtc(): Date {
  return DateTime.now().setZone(REMINDER_TIMEZONE).endOf('day').toUTC().toJSDate()
}

export function isRemindAtDueNowOrPast(remindAt: Date | string): boolean {
  const at = DateTime.fromJSDate(new Date(remindAt), { zone: 'utc' })
  return at.toMillis() <= DateTime.utc().toMillis()
}

export function tomorrowDateInReminderZone(): string {
  return DateTime.now().setZone(REMINDER_TIMEZONE).plus({ days: 1 }).toFormat('yyyy-MM-dd')
}
