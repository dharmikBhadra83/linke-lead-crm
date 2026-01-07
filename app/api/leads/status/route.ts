import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { runAutomationRules } from '@/lib/automation'

// Force dynamic rendering for this route (uses cookies)
export const dynamic = 'force-dynamic'

// GET /api/leads/status - Get leads filtered by status only
export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const status = searchParams.get('status')
    const search = searchParams.get('search')
    const page = parseInt(searchParams.get('page') || '1', 10)
    const limit = parseInt(searchParams.get('limit') || '15', 10)
    const skip = (page - 1) * limit

    // Build where clause based on role
    let where: any = {}

    if (session.role === 'admin') {
      // Admin sees all leads - no role restrictions
      where = {}
    } else if (session.role === 'lead_gen') {
      // Lead gen only sees unclaimed leads with status 'new'
      where.assignedToId = null
      where.status = 'new'
    } else if (session.role === 'outreach') {
      // Outreach sees ONLY unclaimed + assigned to them (NOT admin-claimed leads)
      where.OR = [
        { assignedToId: null },
        { assignedToId: session.id },
      ]
    }

    // Build additional conditions
    const additionalConditions: any[] = []

    // Apply status filter
    if (status && status !== 'all') {
      additionalConditions.push({ status })
    }

    // Apply search filter (PostgreSQL supports case-insensitive search)
    if (search) {
      additionalConditions.push({
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
          { company: { contains: search, mode: 'insensitive' } },
        ],
      })
    }

    // Combine role filter with additional conditions using AND
    if (additionalConditions.length > 0) {
      if (session.role === 'outreach' && where.OR) {
        where = {
          AND: [
            { OR: where.OR },
            ...additionalConditions,
          ],
        }
      } else if (Object.keys(where).length > 0) {
        where = {
          AND: [
            where,
            ...additionalConditions,
          ],
        }
      } else {
        if (additionalConditions.length === 1) {
          where = additionalConditions[0]
        } else {
          where = { AND: additionalConditions }
        }
      }
    }

    // Run automation rules before fetching leads
    await runAutomationRules()

    // Get total count for pagination
    const total = await prisma.lead.count({ where })

    const leads = await prisma.lead.findMany({
      where,
      skip,
      take: limit,
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
      orderBy: {
        createdAt: 'desc',
      },
    })

    // Transform leads to include lastStatusUpdater
    const leadsWithLastUpdater = leads.map((lead: typeof leads[0]) => ({
      ...lead,
      textedAt: lead.textedAt || null,
      firstFollowupAt: lead.firstFollowupAt || null,
      secondFollowupAt: lead.secondFollowupAt || null,
      repliedAt: lead.repliedAt || null,
      lastStatusUpdater: lead.statusHistory[0]?.user || null,
      lastStatusUpdatedAt: lead.statusHistory[0]?.createdAt || null,
    }))

    return NextResponse.json({ 
      leads: leadsWithLastUpdater,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error('Error fetching leads by status:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

