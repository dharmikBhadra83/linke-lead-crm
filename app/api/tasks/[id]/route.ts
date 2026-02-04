import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { requireRole } from '@/lib/auth'
import { completeTaskSchema } from '@/lib/validations'

export const dynamic = 'force-dynamic'

// PATCH /api/tasks/[id] - Mark task complete (assigned user or admin)
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
    const parsed = completeTaskSchema.safeParse(body)
    if (!parsed.success || !parsed.data.completed) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
    }

    const task = await prisma.task.findUnique({
      where: { id },
      select: { id: true, assignedToId: true, completedAt: true },
    })

    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    }

    const canComplete =
      session.role === 'admin' || task.assignedToId === session.id
    if (!canComplete) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

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
  } catch (error: unknown) {
    if (error instanceof Error && (error.message === 'Unauthorized' || error.message === 'Forbidden')) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    console.error('Error updating task:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
