import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { requireRole } from '@/lib/auth'

// POST /api/leads/[id]/claim - Claim a lead
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only outreach can claim leads
    requireRole(session, ['outreach', 'admin'])

    const leadId = params.id

    // Check if lead exists and is unclaimed
    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
    })

    if (!lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
    }

    if (lead.assignedToId && lead.assignedToId !== session.id) {
      return NextResponse.json(
        { error: 'Lead is already assigned to another user' },
        { status: 400 }
      )
    }

    // Create status history entry first (status remains unchanged)
    await prisma.statusHistory.create({
      data: {
        leadId: leadId,
        userId: session.id,
        oldStatus: lead.status,
        newStatus: lead.status,
        reason: 'Lead claimed',
      },
    })

    // Update lead (only assign, don't change status)
    const updatedLead = await prisma.lead.update({
      where: { id: leadId },
      data: {
        assignedToId: session.id,
      },
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
    if (error.message === 'Unauthorized' || error.message === 'Forbidden') {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }

    console.error('Error claiming lead:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

