import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { requireRole } from '@/lib/auth'
import { createTaskSchema } from '@/lib/validations'
import { DateTime } from 'luxon'

export const dynamic = 'force-dynamic'

// GET /api/tasks - List tasks (role-based: admin sees all + filters, users see their own)
export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const statusFilter = searchParams.get('status') || 'all' // all | undone | done | backlog
    const userId = searchParams.get('userId') || ''
    const date = searchParams.get('date') || ''
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '10', 10)))
    const dueDateTo = searchParams.get('dueDateTo') || ''   // task.dueAt on this exact date
    const createdAtTo = searchParams.get('createdAtTo') || '' // task.createdAt on this exact date

    const now = new Date()
    const skip = (page - 1) * limit

    // Sync: overdue undone tasks become backlog
    await prisma.task.updateMany({
      where: { status: 'undone', dueAt: { lt: now } },
      data: { status: 'backlog' },
    })

    function parseSingleDate(dateStr: string): { gte: Date; lte: Date } | undefined {
      const parsed = dateStr ? DateTime.fromISO(dateStr, { zone: 'utc' }) : null
      if (!parsed?.isValid) return undefined
      return {
        gte: parsed.startOf('day').toJSDate(),
        lte: parsed.endOf('day').toJSDate(),
      }
    }

    if (session.role === 'admin') {
      const where: Record<string, unknown> = {}

      if (statusFilter === 'undone' || statusFilter === 'done' || statusFilter === 'backlog') {
        where.status = statusFilter
      }

      if (userId) {
        where.assignedToId = userId
      }

      if (date) {
        const parsed = DateTime.fromISO(date, { zone: 'utc' })
        if (parsed.isValid) {
          const start = parsed.startOf('day').toJSDate()
          const end = parsed.endOf('day').toJSDate()
          where.dueAt = { gte: start, lte: end }
        }
      }

      // dueDateTo = task.dueAt on this exact date; createdAtTo = task.createdAt on this exact date
      const dueOnDate = parseSingleDate(dueDateTo)
      if (dueOnDate) {
        where.dueAt = { ...(where.dueAt as object || {}), ...dueOnDate }
      }
      const createdOnDate = parseSingleDate(createdAtTo)
      if (createdOnDate) {
        where.createdAt = createdOnDate
      }

      const [tasks, total] = await Promise.all([
        prisma.task.findMany({
          where,
          include: {
            assignedTo: { select: { id: true, username: true, role: true } },
            createdBy: { select: { id: true, username: true } },
          },
          orderBy: [{ dueAt: 'asc' }, { createdAt: 'desc' }],
          skip,
          take: limit,
        }),
        prisma.task.count({ where }),
      ])

      return NextResponse.json({
        tasks,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      })
    }

    const where: Record<string, unknown> = { assignedToId: session.id }
    if (statusFilter === 'undone' || statusFilter === 'done' || statusFilter === 'backlog') {
      where.status = statusFilter
    }

    // dueDateTo = dueAt on this date; createdAtTo = createdAt on this date
    const dueOnDate = parseSingleDate(dueDateTo)
    if (dueOnDate) where.dueAt = { ...(where.dueAt as object || {}), ...dueOnDate }
    const createdOnDate = parseSingleDate(createdAtTo)
    if (createdOnDate) where.createdAt = createdOnDate

    const [tasks, total] = await Promise.all([
      prisma.task.findMany({
        where,
        include: {
          assignedTo: { select: { id: true, username: true, role: true } },
          createdBy: { select: { id: true, username: true } },
        },
        orderBy: [{ dueAt: 'asc' }, { createdAt: 'desc' }],
        skip,
        take: limit,
      }),
      prisma.task.count({ where }),
    ])

    return NextResponse.json({
      tasks,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    })
  } catch (error: unknown) {
    if (error instanceof Error && (error.message === 'Unauthorized' || error.message === 'Forbidden')) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    console.error('Error fetching tasks:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/tasks - Create task (admin only), due in 24 hours
export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    requireRole(session, ['admin'])

    const body = await request.json()
    const parsed = createTaskSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten().fieldErrors?.title?.[0] || parsed.error.flatten().fieldErrors?.assignedToId?.[0] || 'Invalid input' },
        { status: 400 }
      )
    }

    const { title, description, assignedToId, createdAt: createdAtStr, dueAt: dueAtStr } = parsed.data
    const now = DateTime.utc()
    let createdAt = now.toJSDate()
    let dueAt = now.plus({ hours: 24 }).toJSDate()

    function parseTaskTimestamp(str: string): Date | null {
      if (!str?.trim()) return null
      const s = str.trim()
      if (s.includes('T')) {
        const dt = s.endsWith('Z') ? DateTime.fromISO(s, { zone: 'utc' }) : DateTime.fromISO(s, { setZone: true })
        if (dt.isValid) return dt.toUTC().toJSDate()
        return null
      }
      const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s)
      if (match) {
        const [, y, m, d] = match
        const now = DateTime.utc()
        const dt = DateTime.utc(parseInt(y!, 10), parseInt(m!, 10), parseInt(d!, 10), now.hour, now.minute, now.second)
        if (dt.isValid) return dt.toJSDate()
      }
      return null
    }

    if (createdAtStr || dueAtStr) {
      if (createdAtStr) {
        const parsedCreated = parseTaskTimestamp(createdAtStr)
        if (parsedCreated) createdAt = parsedCreated
      }
      if (dueAtStr) {
        const parsedDue = parseTaskTimestamp(dueAtStr)
        if (parsedDue) dueAt = parsedDue
      }
      if (new Date(dueAt).getTime() < new Date(createdAt).getTime()) {
        return NextResponse.json(
          { error: 'Due date must be on or after created date' },
          { status: 400 }
        )
      }
    }

    const task = await prisma.task.create({
      data: {
        title,
        description: description || null,
        assignedToId,
        createdById: session.id,
        createdAt,
        dueAt,
        status: 'undone',
      },
      include: {
        assignedTo: { select: { id: true, username: true, role: true } },
        createdBy: { select: { id: true, username: true } },
      },
    })

    return NextResponse.json({ task })
  } catch (error: unknown) {
    if (error instanceof Error && (error.message === 'Unauthorized' || error.message === 'Forbidden')) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    console.error('Error creating task:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
