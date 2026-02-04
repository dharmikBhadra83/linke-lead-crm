import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { requireRole } from '@/lib/auth'
import { completeTaskSchema, updateTaskSchema } from '@/lib/validations'
import { DateTime } from 'luxon'

export const dynamic = 'force-dynamic'

// DELETE /api/tasks/[id] - Delete task (admin only)
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    requireRole(session, ['admin'])

    const { id } = await params
    await prisma.task.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    if (error instanceof Error && (error.message === 'Unauthorized' || error.message === 'Forbidden')) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2025') {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    }
    console.error('Error deleting task:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH /api/tasks/[id] - Mark task complete (assigned user or admin) OR update task (admin only)
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
    const body = await request.json()

    // Complete task flow
    const completeParsed = completeTaskSchema.safeParse(body)
    if (completeParsed.success && completeParsed.data.completed) {
      const task = await prisma.task.findUnique({
        where: { id },
        select: { id: true, assignedToId: true, completedAt: true },
      })
      if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 })
      const canComplete = session.role === 'admin' || task.assignedToId === session.id
      if (!canComplete) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      if (task.completedAt) {
        return NextResponse.json({ task: { ...task, completedAt: task.completedAt } })
      }
      const updated = await prisma.task.update({
        where: { id },
        data: { completedAt: new Date(), status: 'done' },
        include: {
          assignedTo: { select: { id: true, username: true, role: true } },
          createdBy: { select: { id: true, username: true } },
        },
      })
      return NextResponse.json({ task: updated })
    }

    // Edit task flow (admin only)
    const updateParsed = updateTaskSchema.safeParse(body)
    if (!updateParsed.success) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
    }
    requireRole(session, ['admin'])

    const existing = await prisma.task.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'Task not found' }, { status: 404 })

    const data: {
      title?: string
      description?: string | null
      assignedToId?: string
      createdAt?: Date
      dueAt?: Date
    } = {}
    if (updateParsed.data.title !== undefined) data.title = updateParsed.data.title
    if (updateParsed.data.description !== undefined) data.description = updateParsed.data.description
    if (updateParsed.data.assignedToId !== undefined) data.assignedToId = updateParsed.data.assignedToId

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

    if (updateParsed.data.createdAt) {
      const parsed = parseTaskTimestamp(updateParsed.data.createdAt)
      if (parsed) data.createdAt = parsed
    }
    if (updateParsed.data.dueAt) {
      const parsed = parseTaskTimestamp(updateParsed.data.dueAt)
      if (parsed) data.dueAt = parsed
    }

    const effectiveCreated = data.createdAt ?? existing.createdAt
    const effectiveDue = data.dueAt ?? existing.dueAt
    if (new Date(effectiveDue).getTime() < new Date(effectiveCreated).getTime()) {
      return NextResponse.json(
        { error: 'Due date must be on or after created date' },
        { status: 400 }
      )
    }

    if (Object.keys(data).length === 0) {
      const current = await prisma.task.findUnique({
        where: { id },
        include: {
          assignedTo: { select: { id: true, username: true, role: true } },
          createdBy: { select: { id: true, username: true } },
        },
      })
      return NextResponse.json({ task: current })
    }

    const updated = await prisma.task.update({
      where: { id },
      data,
      include: {
        assignedTo: { select: { id: true, username: true, role: true } },
        createdBy: { select: { id: true, username: true } },
      },
    })
    return NextResponse.json({ task: updated })
  } catch (error: unknown) {
    if (error instanceof Error && (error.message === 'Unauthorized' || error.message === 'Forbidden')) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    console.error('Error updating task:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
