import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'

// Force dynamic rendering for this route (uses cookies)
export const dynamic = 'force-dynamic'

// GET /api/leads/action - Get leads filtered by action only
export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const filter = searchParams.get('filter') 
    const system = searchParams.get('system')
    const search = searchParams.get('search')
    const page = parseInt(searchParams.get('page') || '1', 10)
    const limit = parseInt(searchParams.get('limit') || '15', 10)
    const skip = (page - 1) * limit

    if (!filter || filter === 'all') {
      return NextResponse.json({ error: 'Filter is required' }, { status: 400 })
    }

    // Build where clause based on action filter
    let where: any = {}

    if (filter === 'unclaimed') {
      where = {
        status: 'new',
        assignedToId: null,
      }
    } else if (filter === 'texted_old') {
      where = {
        status: 'texted',
        textedAt: {
          not: null,
          lte: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000), 
        },
      }
    } else if (filter === 'first_followup_old') {
      // First Followup 4+ days ago: status='first_followup' AND firstFollowupAt <= 4 days ago
      where = {
        status: 'first_followup',
        firstFollowupAt: {
          not: null,
          lte: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000), // 4 days ago
        },
      }
    } else if (filter === 'replied_old') {
      // Replied 6+ days ago: status='replied' AND repliedAt <= 6 days ago
      where = {
        status: 'replied',
        repliedAt: {
          not: null,
          lte: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000), // 6 days ago
        },
      }
    } else {
      return NextResponse.json({ error: 'Invalid filter' }, { status: 400 })
    }

    // Apply role-based restrictions
    if (session.role === 'lead_gen') {
      // Lead gen only sees unclaimed leads
      if (filter !== 'unclaimed') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
      // Already filtered by unclaimed above
    } else if (session.role === 'outreach') {
      // Outreach sees ONLY unclaimed + assigned to them
      // For unclaimed filter, already correct
      // For other filters, add OR condition
      if (filter !== 'unclaimed') {
        where = {
          AND: [
            where,
            {
              OR: [
                { assignedToId: null },
                { assignedToId: session.id },
              ],
            },
          ],
        }
      }
    }
    // Admin sees all leads - no additional restrictions

    // Apply system filter
    if (system && system !== 'all') {
      if (where.AND) {
        where.AND.push({ system })
      } else {
        where = {
          AND: [where, { system }],
        }
      }
    }

    // Apply search filter (PostgreSQL supports case-insensitive search)
    if (search) {
      const searchCondition = {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
          { company: { contains: search, mode: 'insensitive' } },
        ],
      }

      if (where.AND) {
        where.AND.push(searchCondition)
      } else {
        where = {
          AND: [where, searchCondition],
        }
      }
    }

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
    const leadsWithLastUpdater = leads.map((lead: any) => ({
      ...lead,
      textedAt: lead.textedAt || null,
      firstFollowupAt: lead.firstFollowupAt || null,
      secondFollowupAt: lead.secondFollowupAt || null,
      repliedAt: lead.repliedAt || null,
      meetingBookedAt: (lead as any).meetingBookedAt || null,
      commentedAt: (lead as any).commentedAt || null,
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
    console.error('Error fetching leads by action:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

