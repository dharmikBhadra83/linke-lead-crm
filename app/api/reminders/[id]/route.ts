import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { updateLeadReminderSchema } from '@/lib/validations'
import { parseRemindAtFromClient } from '@/lib/reminder-datetime'
export const dynamic = 'force-dynamic'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const existing = await prisma.leadReminder.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    if (session.role !== 'admin' && existing.userId !== session.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const parsed = updateLeadReminderSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
    }

    const data: { remindAt?: Date; note?: string | null; emailSentAt?: null } = {}
    if (parsed.data.remindAt) {
      const dt = parseRemindAtFromClient(parsed.data.remindAt)
      if (!dt) return NextResponse.json({ error: 'Invalid date/time' }, { status: 400 })
      data.remindAt = dt
      data.emailSentAt = null
    }
    if (parsed.data.note !== undefined) data.note = parsed.data.note

    const reminder = await prisma.leadReminder.update({
      where: { id },
      data,
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

    return NextResponse.json({ reminder })
  } catch (error) {
    console.error('Error updating reminder:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const existing = await prisma.leadReminder.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    if (session.role !== 'admin' && existing.userId !== session.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    await prisma.leadReminder.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting reminder:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
