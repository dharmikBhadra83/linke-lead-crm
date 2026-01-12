import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { requireRole } from '@/lib/auth'
import { createLeadSchema } from '@/lib/validations'

// GET /api/leads - Get all leads (with role-based filtering)
export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const status = searchParams.get('status')
    const system = searchParams.get('system')
    const search = searchParams.get('search')
    const filter = searchParams.get('filter') // 'unclaimed', 'texted_old', etc.
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
      // This OR condition must be preserved when applying other filters
      where.OR = [
        { assignedToId: null },
        { assignedToId: session.id },
      ]
    }

    // Build additional conditions that need to be ANDed with role filter
    const additionalConditions: any[] = []

    // Apply time-based action filters first (these override status filter)
    if (filter && filter !== 'all') {
      if (filter === 'unclaimed') {
        // For unclaimed filter, override the OR for outreach to show only unclaimed
        if (session.role === 'outreach') {
          where = { assignedToId: null }
        } else {
          additionalConditions.push({ assignedToId: null })
        }
      } else if (filter === 'texted_old') {
        additionalConditions.push({
          status: 'texted',
          textedAt: {
            not: null,
            lte: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000), // 4 days ago
          },
        })
      } else if (filter === 'first_followup_old') {
        additionalConditions.push({
          status: 'first_followup',
          firstFollowupAt: {
            not: null,
            lte: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000), // 4 days ago
          },
        })
      } else if (filter === 'replied_old') {
        additionalConditions.push({
          status: 'replied',
          repliedAt: {
            not: null,
            lte: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000), // 6 days ago
          },
        })
      }
    } else if (status && status !== 'all' && session.role !== 'lead_gen') {
      // Apply status filter only if no action filter is set and status is not 'all'
      additionalConditions.push({ status })
    }

    // Apply system filter
    if (system && system !== 'all') {
      additionalConditions.push({ system })
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
    // This ensures role filter is always preserved
    if (additionalConditions.length > 0) {
      if (session.role === 'outreach' && where.OR) {
        // For outreach, preserve the OR condition and AND it with other filters
        where = {
          AND: [
            { OR: where.OR }, // Preserve the role-based OR
            ...additionalConditions,
          ],
        }
      } else if (Object.keys(where).length > 0) {
        // For other roles, combine conditions
        where = {
          AND: [
            where,
            ...additionalConditions,
          ],
        }
      } else {
        // Admin or no role restrictions - just use additional conditions
        if (additionalConditions.length === 1) {
          where = additionalConditions[0]
        } else {
          where = { AND: additionalConditions }
        }
      }
    }

    // Note: Automation rules are now handled by cron job at /api/cron/automation
    // This runs daily at midnight via Vercel Cron (configured in vercel.json)

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
    // Ensure all date fields are included (even if null)
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
    console.error('Error fetching leads:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST /api/leads - Create a new lead
export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only admin and lead_gen can create leads
    requireRole(session, ['admin', 'lead_gen'])

    const body = await request.json()
    const validatedData = createLeadSchema.parse(body)

    // Only admin can assign leads
    if (validatedData.assignedToId !== undefined && session.role !== 'admin') {
      delete validatedData.assignedToId
    }

    const lead = await prisma.lead.create({
      data: validatedData,
      include: {
        assignedTo: {
          select: {
            id: true,
            username: true,
          },
        },
      },
    })

    return NextResponse.json({ lead }, { status: 201 })
  } catch (error: any) {
    if (error.message === 'Unauthorized' || error.message === 'Forbidden') {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }

    if (error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Error creating lead:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

