import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'

export const dynamic = 'force-dynamic'

interface AverageData {
  userId: string
  username: string
  total: number
  meetingBooked: number
  conversionRate: number // (total meeting booked / total assigned) * 100
}

/**
 * GET /api/performance/average
 * Returns average performance metrics for the date range
 * Shows overall conversion rate: (total meetings booked / total assigned) * 100
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

    // Use Luxon for consistent date handling
    const { DateTime } = await import('luxon')
    const start = DateTime.fromISO(startDateParam, { zone: 'utc' }).startOf('day')
    const end = DateTime.fromISO(endDateParam, { zone: 'utc' }).endOf('day')
    
    // Validate dates
    if (!start.isValid || !end.isValid) {
      return NextResponse.json({ error: 'Invalid date format' }, { status: 400 })
    }
    
    if (start > end) {
      return NextResponse.json({ error: 'Start date must be before end date' }, { status: 400 })
    }

    // Get all users (admin and outreach)
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

    // Calculate average metrics for each user
    const averageData: AverageData[] = []

    for (const user of users) {
      // Get leads assigned to this user that exist (were created) on or before end date
      const userLeads = allLeads.filter((lead) => {
        const leadCreatedAt = DateTime.fromJSDate(new Date(lead.createdAt))
        return lead.assignedToId === user.id && leadCreatedAt <= end
      })

      // Count total assigned leads and total meeting_booked (cumulative)
      let total = 0
      let meetingBooked = 0

      for (const lead of userLeads) {
        total++

        // Determine the status of the lead as of the end date
        const statusHistoryOnDate = lead.statusHistory
          .filter((history) => {
            const historyDate = DateTime.fromJSDate(new Date(history.createdAt))
            return historyDate <= end
          })
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0]

        const statusOnDate = statusHistoryOnDate?.newStatus || lead.status

        // Count meeting_booked
        if (statusOnDate === 'meeting_booked') {
          meetingBooked++
        }
      }

      // Average conversion rate: (total meeting booked / total assigned) * 100
      const conversionRate = total > 0 ? (meetingBooked / total) * 100 : 0

      averageData.push({
        userId: user.id,
        username: user.username,
        total,
        meetingBooked,
        conversionRate: Math.round(conversionRate * 1000) / 1000, // 3 decimal places
      })
    }

    return NextResponse.json({
      success: true,
      data: averageData,
      users: users.map((u) => ({ id: u.id, username: u.username, role: u.role })),
    })
  } catch (error: any) {
    console.error('Error fetching average data:', error)
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    )
  }
}

