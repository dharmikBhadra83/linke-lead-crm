import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { DateTime } from 'luxon'

export const dynamic = 'force-dynamic'

interface GraphData {
  date: string
  userId: string
  username: string
  leadsCreated: number // Number of leads created on this specific date
}

/**
 * GET /api/performance/graph
 * Returns daily performance metrics for the graph
 * Shows number of leads created per day for each user
 * Metric: Who brings more leads into the system
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const startDateParam = searchParams.get('startDate')
    const endDateParam = searchParams.get('endDate')

    if (!startDateParam || !endDateParam) {
      return NextResponse.json({ error: 'startDate and endDate are required' }, { status: 400 })
    }

    // Use Luxon for date handling - ensure we parse dates correctly
    const start = DateTime.fromISO(startDateParam, { zone: 'utc' }).startOf('day')
    const end = DateTime.fromISO(endDateParam, { zone: 'utc' }).endOf('day')
    
    // Validate dates
    if (!start.isValid || !end.isValid) {
      return NextResponse.json({ error: 'Invalid date format' }, { status: 400 })
    }
    
    if (start > end) {
      return NextResponse.json({ error: 'Start date must be before end date' }, { status: 400 })
    }

    // here we got two userss admin and outreach
    const users = await prisma.user.findMany({
      where: {
        role: {
          in: ['admin', 'outreach'],
        },
      },
      select: {
        id: true,
        username: true,
        role: true,
      },
    })

    if (users.length === 0) {
      return NextResponse.json({
        success: true,
        data: [],
        users: [],
      })
    }

    // Generate all dates in the range (inclusive of both start and end) using Luxon
    const dates: string[] = []
    
    // Parse dates as simple date strings (YYYY-MM-DD) to avoid timezone issues
    const startDateOnly = DateTime.fromISO(startDateParam, { zone: 'utc' }).startOf('day')
    const endDateOnly = DateTime.fromISO(endDateParam, { zone: 'utc' }).startOf('day')
    
    // Calculate number of days
    const daysDiff = endDateOnly.diff(startDateOnly, 'days').days
    
    // Generate all dates in the range
    for (let i = 0; i <= daysDiff; i++) {
      const currentDate = startDateOnly.plus({ days: i })
      const dateStr = currentDate.toISODate()
      if (dateStr) {
        dates.push(dateStr) // Format: YYYY-MM-DD
      }
    }

    // Get all leads assigned to users - only need createdAt for counting
    const allLeads = await prisma.lead.findMany({
      where: {
        assignedToId: {
          in: users.map(u => u.id),
        },
      },
      select: {
        id: true,
        assignedToId: true,
        createdAt: true,
      },
    })


    // Calculate graph data for each user for each date
    const graphData: GraphData[] = []

    // admin and outreach
    for (const user of users) {
      // each date
      for (const dateStr of dates) {
        // Use Luxon for date handling
        const date = DateTime.fromISO(dateStr).startOf('day')
        const dateStart = date
        const dateEnd = date.endOf('day')

        // Count leads created ON THIS SPECIFIC DATE for this user
        const leadsCreatedToday = allLeads.filter((lead) => {
          if (lead.assignedToId !== user.id) return false
          
          const leadCreatedAt = DateTime.fromJSDate(new Date(lead.createdAt))
          return (
            leadCreatedAt >= dateStart &&
            leadCreatedAt <= dateEnd
          )
        }).length

        graphData.push({
          date: dateStr,
          userId: user.id,
          username: user.username,
          leadsCreated: leadsCreatedToday,
        })
      }
    }

    return NextResponse.json({
      success: true,
      data: graphData,
      users: users.map((u) => ({ id: u.id, username: u.username, role: u.role })),
    })
  } catch (error: any) {
    console.error('Error fetching graph data:', error)
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    )
  }
}

