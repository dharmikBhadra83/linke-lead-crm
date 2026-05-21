import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { createLeadReminderSchema } from '@/lib/validations'
import {
  endOfTodayInReminderZoneUtc,
  parseRemindAtFromClient,
} from '@/lib/reminder-datetime'
import { scheduleReminderEmailJob } from '@/lib/reminder-scheduler'

export const dynamic = 'force-dynamic'

// GET /api/reminders — list reminders (due today / overdue first)
export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const leadId = searchParams.get('leadId')

    const where: { userId?: string; leadId?: string } = {}
    if (session.role === 'admin') {
      if (searchParams.get('userId')) where.userId = searchParams.get('userId')!
    } else {
      where.userId = session.id
    }
    if (leadId) where.leadId = leadId

    const reminders = await prisma.leadReminder.findMany({
      where,
      include: {
        lead: {
          select: {
            id: true,
            name: true,
            email: true,
            company: true,
            status: true,
            assignedToId: true,
            assignedTo: { select: { id: true, username: true } },
          },
        },
        user: { select: { id: true, username: true, email: true } },
      },
      orderBy: { remindAt: 'asc' },
    })

    const endOfToday = endOfTodayInReminderZoneUtc()

    const sorted = [...reminders].sort((a, b) => {
      const aDue = new Date(a.remindAt).getTime() <= endOfToday.getTime()
      const bDue = new Date(b.remindAt).getTime() <= endOfToday.getTime()
      if (aDue && !bDue) return -1
      if (!aDue && bDue) return 1
      return new Date(a.remindAt).getTime() - new Date(b.remindAt).getTime()
    })

    return NextResponse.json({ reminders: sorted })
  } catch (error) {
    console.error('Error fetching reminders:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/reminders
export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const parsed = createLeadReminderSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
    }

    const lead = await prisma.lead.findUnique({
      where: { id: parsed.data.leadId },
      select: { id: true, assignedToId: true },
    })
    if (!lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
    }

    if (session.role === 'outreach' && lead.assignedToId !== session.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const remindAt = parseRemindAtFromClient(parsed.data.remindAt)
    if (!remindAt) {
      return NextResponse.json({ error: 'Invalid reminder date/time' }, { status: 400 })
    }

    const userId =
      session.role === 'admin' && lead.assignedToId ? lead.assignedToId : session.id

    const reminder = await prisma.leadReminder.create({
      data: {
        leadId: parsed.data.leadId,
        userId,
        remindAt,
        note: parsed.data.note || null,
      },
      include: {
        lead: {
          select: {
            id: true,
            name: true,
            company: true,
            status: true,
            assignedTo: { select: { id: true, username: true } },
          },
        },
        user: { select: { id: true, username: true } },
      },
    })

    try {
      await scheduleReminderEmailJob(reminder.id, remindAt)
    } catch (e) {
      console.error('[Reminders] Inngest schedule failed:', e)
    }

    return NextResponse.json({ reminder })
  } catch (error) {
    console.error('Error creating reminder:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
