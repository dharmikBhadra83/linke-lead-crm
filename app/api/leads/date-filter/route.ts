import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { DateTime } from 'luxon'

// Force dynamic rendering for this route (uses cookies)
export const dynamic = 'force-dynamic'

// GET /api/leads/date-filter - Get leads filtered by date and statuses
export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const dateParam = searchParams.get('date')
    const statusesParam = searchParams.get('statuses')
    const system = searchParams.get('system')
    const search = searchParams.get('search')
    const page = parseInt(searchParams.get('page') || '1', 10)
    const limit = parseInt(searchParams.get('limit') || '15', 10)
    const skip = (page - 1) * limit

    if (!dateParam) {
      return NextResponse.json({ error: 'Date parameter is required' }, { status: 400 })
    }

    // Parse the date
    const filterDate = DateTime.fromISO(dateParam, { zone: 'utc' }).startOf('day')
    if (!filterDate.isValid) {
      return NextResponse.json({ error: 'Invalid date format' }, { status: 400 })
    }

    const dateStart = filterDate.toJSDate()
    const dateEnd = filterDate.endOf('day').toJSDate()

    // Parse statuses
    const selectedStatuses = statusesParam ? statusesParam.split(',').filter(Boolean) : []

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
      // Outreach sees ONLY unclaimed + assigned to them
      where.OR = [
        { assignedToId: null },
        { assignedToId: session.id },
      ]
    }

    // Build date and status filter conditions
    // If statuses are selected, filter leads that:
    // 1. Were created on that date AND have one of the selected statuses, OR
    // 2. Had their status changed to one of the selected statuses on that date, OR
    // 3. Have the date field matching that date for the selected status (e.g., textedAt for 'texted' status)
    const dateStatusConditions: any[] = []

    if (selectedStatuses.length > 0) {
      // Condition 1: Leads created on that date with selected statuses
      const condition1: any = {
        AND: [
          {
            createdAt: {
              gte: dateStart,
              lte: dateEnd,
            },
          },
          {
            status: {
              in: selectedStatuses,
            },
          },
        ],
      }
      // Add system filter to condition 1 if specified
      if (system && system !== 'all') {
        condition1.AND.push({ system })
      }
      dateStatusConditions.push(condition1)

      // Condition 2: Leads that had status changed to one of selected statuses on that date
      const condition2: any = {
        statusHistory: {
          some: {
            newStatus: {
              in: selectedStatuses,
            },
            createdAt: {
              gte: dateStart,
              lte: dateEnd,
            },
          },
        },
      }
      // Add system filter to condition 2 if specified
      if (system && system !== 'all') {
        condition2.system = system
      }
      dateStatusConditions.push(condition2)

      // Condition 3: Check actual date fields for statuses that have them
      // Map status to date field
      const statusDateFieldMap: Record<string, string> = {
        texted: 'textedAt',
        replied: 'repliedAt',
        meeting_booked: 'meetingBookedAt',
        first_followup: 'firstFollowupAt',
        second_followup: 'secondFollowupAt',
        commented: 'commentedAt',
      }

      // Create conditions for each status that has a date field
      for (const status of selectedStatuses) {
        const dateField = statusDateFieldMap[status]
        if (dateField) {
          const condition3: any = {
            AND: [
              {
                [dateField]: {
                  gte: dateStart,
                  lte: dateEnd,
                },
              },
              {
                status: status,
              },
            ],
          }
          // Add system filter if specified
          if (system && system !== 'all') {
            condition3.AND.push({ system })
          }
          dateStatusConditions.push(condition3)
        }
      }
    } else {
      // No statuses selected - just filter by date
      const dateCondition: any = {
        createdAt: {
          gte: dateStart,
          lte: dateEnd,
        },
      }
      // Add system filter if specified
      if (system && system !== 'all') {
        dateCondition.system = system
      }
      dateStatusConditions.push(dateCondition)
    }

    // Apply search filter
    if (search) {
      const searchCondition = {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
          { company: { contains: search, mode: 'insensitive' } },
        ],
      }

      if (where.OR) {
        // For outreach role, combine with existing OR
        where = {
          AND: [
            { OR: where.OR },
            { OR: dateStatusConditions },
            searchCondition,
          ],
        }
      } else {
        where = {
          AND: [
            where,
            { OR: dateStatusConditions },
            searchCondition,
          ],
        }
      }
    } else {
      if (where.OR) {
        // For outreach role, combine with existing OR
        where = {
          AND: [
            { OR: where.OR },
            { OR: dateStatusConditions },
          ],
        }
      } else {
        where = {
          AND: [
            where,
            { OR: dateStatusConditions },
          ],
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
    console.error('Error fetching leads by date filter:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
