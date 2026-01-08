import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'

export const dynamic = 'force-dynamic'

interface PerformanceData {
  date: string
  userId: string
  username: string
  total: number
  requested: number
  texted: number
  replied: number
  meetingBooked: number
  closed: number
  junk: number
  conversionRate: number // (meeting_booked / total) * 100
}

/**
 * GET /api/performance
 * Returns performance metrics for all users (admin and outreach) grouped by date
 * Query params: startDate, endDate
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

    // Default to current month if no dates provided
    const start = startDateParam ? new Date(startDateParam) : new Date(new Date().getFullYear(), new Date().getMonth(), 1)
    const end = endDateParam ? new Date(endDateParam) : new Date()

    // Set time to start/end of day for proper date comparison
    start.setHours(0, 0, 0, 0)
    end.setHours(23, 59, 59, 999)

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

    // Get all leads assigned to users (admin and outreach) with their status history
    // Only fetch what we need: assigned leads and status history for meeting_booked
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

    // Generate all dates in the range (inclusive of both start and end)
    const dates: string[] = []
    const startDateStr = start.toISOString().split('T')[0]
    const endDateStr = end.toISOString().split('T')[0]
    
    let currentDateStr = startDateStr
    let iterations = 0
    while (currentDateStr <= endDateStr) {
      dates.push(currentDateStr)
      const nextDate = new Date(currentDateStr + 'T00:00:00')
      nextDate.setDate(nextDate.getDate() + 1)
      currentDateStr = nextDate.toISOString().split('T')[0]
      
      iterations++
      if (iterations > 1000) {
        console.error('Date range too large or infinite loop detected')
        break
      }
    }

    // Calculate performance metrics for each user for each date
    const performanceData: PerformanceData[] = []

    for (const user of users) {
      for (const date of dates) {
        const dateEnd = new Date(date)
        dateEnd.setHours(23, 59, 59, 999)

        // Get leads assigned to this user that exist (were created) on or before this date
        const userLeads = allLeads.filter((lead) => {
          return lead.assignedToId === user.id && new Date(lead.createdAt) <= dateEnd
        })

        // Count total assigned leads and meeting_booked
        let total = 0
        let meetingBooked = 0

        for (const lead of userLeads) {
          total++

          // Determine the status of the lead as of this date
          const statusHistoryOnDate = lead.statusHistory
            .filter((history) => new Date(history.createdAt) <= dateEnd)
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0]

          const statusOnDate = statusHistoryOnDate?.newStatus || lead.status

          // Only count meeting_booked
          if (statusOnDate === 'meeting_booked') {
            meetingBooked++
          }
        }

        // Simple formula: (total meeting booked / total assigned/claimed) * 100
        const conversionRate = total > 0 ? (meetingBooked / total) * 100 : 0

        performanceData.push({
          date,
          userId: user.id,
          username: user.username,
          total,
          requested: 0,
          texted: 0,
          replied: 0,
          meetingBooked,
          closed: 0,
          junk: 0,
          conversionRate: Math.round(conversionRate * 1000) / 1000, // Round to 3 decimal places
        })
      }
    }

    return NextResponse.json({
      success: true,
      data: performanceData,
      users: users.map((u) => ({ id: u.id, username: u.username, role: u.role })),
    })
  } catch (error: any) {
    console.error('Error fetching performance data:', error)
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    )
  }
}

