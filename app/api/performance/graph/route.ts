import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { DateTime } from 'luxon'

export const dynamic = 'force-dynamic'

interface GraphData {
  date: string
  userId: string
  username: string
  total: number
  meetingBooked: number
  conversionRate: number // (meeting_booked / total) * 100 for this specific date
}

/**
 * GET /api/performance/graph
 * Returns daily performance metrics for the graph
 * Shows conversion rate per day: (meetings booked on that day / total assigned on that day) * 100
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

    // Get all leads assigned to users with status history
    const allLeads = await prisma.lead.findMany({
      where: {
        assignedToId: {
          in: users.map(u => u.id),
        },
      },
      select: {
        id: true,
        assignedToId: true,
        status: true,
        createdAt: true,
        statusHistory: {
          select: {
            newStatus: true,
            createdAt: true,
          },
          orderBy: {
            createdAt: 'asc',
          },
        },
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

        // Get leads assigned to this user that exist (were created) on or before this date
        const userLeads = allLeads.filter((lead) => {
          const leadCreatedAt = DateTime.fromJSDate(new Date(lead.createdAt))
          return lead.assignedToId === user.id && leadCreatedAt <= dateEnd
        })

        // Count total assigned leads as of this date (cumulative)
        let total = userLeads.length
        
        // Count meetings booked ON THIS SPECIFIC DATE ONLY (not cumulative)
        let meetingBookedToday = 0

        for (const lead of userLeads) {
          // Check if meeting was booked ON THIS SPECIFIC DATE
          const meetingBookedOnThisDate = lead.statusHistory.some((history) => {
            const historyDate = DateTime.fromJSDate(new Date(history.createdAt))
            return (
              historyDate >= dateStart &&
              historyDate <= dateEnd &&
              history.newStatus === 'meeting_booked'
            )
          })

          if (meetingBookedOnThisDate) {
            meetingBookedToday++
          }
        }

        // Daily conversion rate: (meetings booked today / total assigned on this date) * 100
        // If no meetings booked today, show 0% (straight line)
        const conversionRate = total > 0 ? (meetingBookedToday / total) * 100 : 0

        graphData.push({
          date: dateStr,
          userId: user.id,
          username: user.username,
          total,
          meetingBooked: meetingBookedToday,
          conversionRate: Math.round(conversionRate * 1000) / 1000, 
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

