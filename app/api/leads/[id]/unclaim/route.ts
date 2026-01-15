import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { requireRole } from '@/lib/auth'

// POST /api/leads/[id]/unclaim - Unclaim a lead
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only outreach and admin can unclaim leads
    requireRole(session, ['outreach', 'admin'])

    const leadId = params.id

    // Check if lead exists
    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
    })

    if (!lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
    }

    // Outreach can only unclaim their own leads, admin can unclaim any lead
    if (session.role === 'outreach' && lead.assignedToId !== session.id) {
      return NextResponse.json(
        { error: 'Can only unclaim your own leads' },
        { status: 403 }
      )
    }

    // Don't allow unclaiming if lead is already unclaimed
    if (!lead.assignedToId) {
      return NextResponse.json(
        { error: 'Lead is already unclaimed' },
        { status: 400 }
      )
    }

    // Create status history entry
    await prisma.statusHistory.create({
      data: {
        leadId: leadId,
        userId: session.id,
        oldStatus: lead.status,
        newStatus: lead.status,
        reason: 'Lead unclaimed',
      },
    })

    // Update lead - set assignedToId to null
    const updatedLead = await prisma.lead.update({
      where: { id: leadId },
      data: {
        assignedToId: null,
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

    console.error('Error unclaiming lead:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
