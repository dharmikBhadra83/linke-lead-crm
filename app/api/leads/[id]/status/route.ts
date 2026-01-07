import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { changeStatusSchema } from '@/lib/validations'

// POST /api/leads/[id]/status - Change lead status
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const validatedData = changeStatusSchema.parse({
      ...body,
      leadId: params.id,
    })

    // Check if lead exists
    const lead = await prisma.lead.findUnique({
      where: { id: params.id },
    })

    if (!lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
    }

    // Role-based permissions
    if (session.role === 'lead_gen' && lead.assignedToId) {
      return NextResponse.json(
        { error: 'Cannot change status of assigned leads' },
        { status: 403 }
      )
    }

    if (session.role === 'outreach' && lead.assignedToId !== session.id) {
      return NextResponse.json(
        { error: 'Can only change status of your own leads' },
        { status: 403 }
      )
    }

    // Verify user exists in database (fixes foreign key constraint)
    const user = await prisma.user.findUnique({
      where: { id: session.id },
    })

    if (!user) {
      return NextResponse.json(
        { error: 'User not found in database' },
        { status: 404 }
      )
    }

    // Create status history entry
    await prisma.statusHistory.create({
      data: {
        leadId: params.id,
        userId: session.id,
        oldStatus: lead.status,
        newStatus: validatedData.newStatus,
        reason: validatedData.reason || null,
      },
    })

    // Prepare update data with date tracking
    const updateData: any = {
      status: validatedData.newStatus,
    }

    // Set date fields based on status change
    const now = new Date()
    if (validatedData.newStatus === 'texted' && !lead.textedAt) {
      updateData.textedAt = now
    } else if (validatedData.newStatus === 'first_followup' && !lead.firstFollowupAt) {
      updateData.firstFollowupAt = now
    } else if (validatedData.newStatus === 'second_followup' && !lead.secondFollowupAt) {
      updateData.secondFollowupAt = now
    } else if (validatedData.newStatus === 'replied' && !lead.repliedAt) {
      updateData.repliedAt = now
    }

    // Update lead status
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

    console.error('Error changing status:', error)
    return NextResponse.json(
      { error: 'Internal server error', message: error.message || 'Unknown error' },
      { status: 500 }
    )
  }
}

