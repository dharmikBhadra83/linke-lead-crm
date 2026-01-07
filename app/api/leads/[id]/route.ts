import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { requireRole } from '@/lib/auth'
import { updateLeadSchema, changeStatusSchema } from '@/lib/validations'

// GET /api/leads/[id] - Get a single lead with history
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const lead = await prisma.lead.findUnique({
      where: { id: params.id },
      include: {
        assignedTo: {
          select: {
            id: true,
            username: true,
          },
        },
        statusHistory: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
              },
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
        },
      },
    })

    if (!lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
    }

    // Role-based access check
    if (session.role === 'lead_gen' && lead.assignedToId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    if (session.role === 'outreach' && lead.assignedToId && lead.assignedToId !== session.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    return NextResponse.json({ lead })
  } catch (error) {
    console.error('Error fetching lead:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PUT /api/leads/[id] - Update a lead
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const validatedData = updateLeadSchema.parse(body)

    // Check if lead exists
    const existingLead = await prisma.lead.findUnique({
      where: { id: params.id },
    })

    if (!existingLead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
    }

    // Role-based permissions
    if (session.role === 'lead_gen' && existingLead.assignedToId) {
      return NextResponse.json(
        { error: 'Cannot edit assigned leads' },
        { status: 403 }
      )
    }

    if (session.role === 'outreach' && existingLead.assignedToId !== session.id) {
      return NextResponse.json(
        { error: 'Can only edit your own leads' },
        { status: 403 }
      )
    }

    // Only admin can change assignment
    if (validatedData.assignedToId !== undefined && session.role !== 'admin') {
      delete validatedData.assignedToId
    }

    // Track status change if status is being updated
    let statusHistoryEntry = null
    const updateData: any = { ...validatedData }
    
    if (validatedData.status && validatedData.status !== existingLead.status) {
      statusHistoryEntry = await prisma.statusHistory.create({
        data: {
          leadId: params.id,
          userId: session.id,
          oldStatus: existingLead.status,
          newStatus: validatedData.status,
          reason: body.reason || null,
        },
      })

      // Set date fields based on status change
      const now = new Date()
      if (validatedData.status === 'texted' && !existingLead.textedAt) {
        updateData.textedAt = now
      } else if (validatedData.status === 'first_followup' && !existingLead.firstFollowupAt) {
        updateData.firstFollowupAt = now
      } else if (validatedData.status === 'second_followup' && !existingLead.secondFollowupAt) {
        updateData.secondFollowupAt = now
      } else if (validatedData.status === 'replied' && !existingLead.repliedAt) {
        updateData.repliedAt = now
      }
    }

    const updatedLead = await prisma.lead.update({
      where: { id: params.id },
      data: updateData,
      include: {
        assignedTo: {
          select: {
            id: true,
            username: true,
          },
        },
        statusHistory: {
          take: 1,
          orderBy: {
            createdAt: 'desc',
          },
          include: {
            user: {
              select: {
                id: true,
                username: true,
              },
            },
          },
        },
      },
    })

    // Transform to include lastStatusUpdater
    const leadWithLastUpdater = {
      ...updatedLead,
      lastStatusUpdater: updatedLead.statusHistory[0]?.user || null,
      lastStatusUpdatedAt: updatedLead.statusHistory[0]?.createdAt || null,
    }

    return NextResponse.json({ lead: leadWithLastUpdater })
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Error updating lead:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE /api/leads/[id] - Delete a lead
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only admin can delete leads
    requireRole(session, ['admin'])

    const lead = await prisma.lead.findUnique({
      where: { id: params.id },
    })

    if (!lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
    }

    await prisma.lead.delete({
      where: { id: params.id },
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    if (error.message === 'Unauthorized' || error.message === 'Forbidden') {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }

    console.error('Error deleting lead:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

