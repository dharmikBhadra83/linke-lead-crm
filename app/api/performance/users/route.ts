import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'

export const dynamic = 'force-dynamic'

interface UserPerformanceData {
  name: string
  totalLeads: number
  requested: number
  texted: number
  firstFollowup: number
  secondFollowup: number
  replied: number
  meetingBooked: number
  closed: number
  junk: number
  requestedToTexted: number // percentage
  textedToFirstFollowup: number // percentage
  firstFollowupToSecondFollowup: number // percentage
  secondFollowupToReplied: number // percentage
  repliedToMeeting: number // percentage
  meetingToClosed: number // percentage
}

/**
 * GET /api/performance/users
 * Returns detailed performance metrics for each user (admin/outreach)
 * Includes status counts and conversion percentages between status transitions
 * Sorted by highest performance first
 * Includes aggregate row at the end
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get all admin and outreach users
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
        aggregate: null,
      })
    }

    // Get all leads assigned to these users with their status history
    const allLeads = await prisma.lead.findMany({
      where: {
        assignedToId: {
          in: users.map((u) => u.id),
        },
      },
      select: {
        id: true,
        assignedToId: true,
        status: true,
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

    // Calculate metrics for each user
    const userMetrics: UserPerformanceData[] = []

    for (const user of users) {
      // Get all leads assigned to this user
      const userLeads = allLeads.filter((lead) => lead.assignedToId === user.id)

      // Track unique leads that reached each status (for conversion calculations)
      const leadsReachedRequested = new Set<string>()
      const leadsReachedTexted = new Set<string>()
      const leadsReachedFirstFollowup = new Set<string>()
      const leadsReachedSecondFollowup = new Set<string>()
      const leadsReachedReplied = new Set<string>()
      const leadsReachedMeeting = new Set<string>()
      const leadsReachedClosed = new Set<string>()

      for (const lead of userLeads) {
        // Check all status history entries to see which statuses this lead reached
        const statusesReached = new Set<string>()

        // current lead status history
        for (const history of lead.statusHistory) {
          // we are storing 
          statusesReached.add(history.newStatus)
        }

        // current status : requested , texted

        // Also include current status
        statusesReached.add(lead.status)

        // Track which statuses this lead reached (in order)
        // Flow: new → requested → texted → first_followup → second_followup → replied → meeting_booked → closed/junk
        if (statusesReached.has('requested')) {
          leadsReachedRequested.add(lead.id)
        }
        if (statusesReached.has('texted')) {
          leadsReachedTexted.add(lead.id)
          // If texted, must have been requested
          leadsReachedRequested.add(lead.id)
        }
        if (statusesReached.has('first_followup')) {
          leadsReachedFirstFollowup.add(lead.id)
          // If first followup, must have been texted and requested
          leadsReachedTexted.add(lead.id)
          leadsReachedRequested.add(lead.id)
        }
        if (statusesReached.has('second_followup')) {
          leadsReachedSecondFollowup.add(lead.id)
          // If second followup, must have been first followup, texted, and requested
          leadsReachedFirstFollowup.add(lead.id)
          leadsReachedTexted.add(lead.id)
          leadsReachedRequested.add(lead.id)
        }
        if (statusesReached.has('replied')) {
          leadsReachedReplied.add(lead.id)
          // If replied, must have been second followup, first followup, texted, and requested
          leadsReachedSecondFollowup.add(lead.id)
          leadsReachedFirstFollowup.add(lead.id)
          leadsReachedTexted.add(lead.id)
          leadsReachedRequested.add(lead.id)
        }
        if (statusesReached.has('meeting_booked')) {
          leadsReachedMeeting.add(lead.id)
          // If meeting booked, must have been replied, second followup, first followup, texted, and requested
          leadsReachedReplied.add(lead.id)
          leadsReachedSecondFollowup.add(lead.id)
          leadsReachedFirstFollowup.add(lead.id)
          leadsReachedTexted.add(lead.id)
          leadsReachedRequested.add(lead.id)
        }
        if (statusesReached.has('closed')) {
          leadsReachedClosed.add(lead.id)
        }
      }


      // Count unique leads that reached each status
      const requested = leadsReachedRequested.size
      const texted = leadsReachedTexted.size
      const firstFollowup = leadsReachedFirstFollowup.size
      const secondFollowup = leadsReachedSecondFollowup.size
      const replied = leadsReachedReplied.size
      const meetingBooked = leadsReachedMeeting.size
      const closed = leadsReachedClosed.size

      // Count junk leads (leads that are currently junk or have been junk)
      const junk = userLeads.filter(
        (lead) =>
          lead.status === 'junk' ||
          lead.statusHistory.some((h) => h.newStatus === 'junk')
      ).length

      // Calculate conversion percentages
      // Requested → Texted: (leads that reached texted / leads that reached requested) * 100
      const requestedToTexted =
        requested > 0 ? (texted / requested) * 100 : 0

      // Texted → First Follow-up: (leads that reached first_followup / leads that reached texted) * 100
      const textedToFirstFollowup =
        texted > 0 ? (firstFollowup / texted) * 100 : 0

      // First Follow-up → Second Follow-up: (leads that reached second_followup / leads that reached first_followup) * 100
      const firstFollowupToSecondFollowup =
        firstFollowup > 0 ? (secondFollowup / firstFollowup) * 100 : 0

      // Second Follow-up → Replied: (leads that reached replied / leads that reached second_followup) * 100
      const secondFollowupToReplied =
        secondFollowup > 0 ? (replied / secondFollowup) * 100 : 0

      // Replied → Meeting: (leads that reached meeting / leads that reached replied) * 100
      const repliedToMeeting = replied > 0 ? (meetingBooked / replied) * 100 : 0

      // Meeting → Closed: (leads that reached closed / leads that reached meeting) * 100
      const meetingToClosed = meetingBooked > 0 ? (closed / meetingBooked) * 100 : 0

      userMetrics.push({
        name: user.username,
        totalLeads: userLeads.length,
        requested,
        texted,
        firstFollowup,
        secondFollowup,
        replied,
        meetingBooked,
        closed,
        junk,
        requestedToTexted: Math.round(requestedToTexted * 1000) / 1000, // 3 decimal places
        textedToFirstFollowup: Math.round(textedToFirstFollowup * 1000) / 1000,
        firstFollowupToSecondFollowup: Math.round(firstFollowupToSecondFollowup * 1000) / 1000,
        secondFollowupToReplied: Math.round(secondFollowupToReplied * 1000) / 1000,
        repliedToMeeting: Math.round(repliedToMeeting * 1000) / 1000,
        meetingToClosed: Math.round(meetingToClosed * 1000) / 1000,
      })
    }

    // Sort by highest performance (using meetingBooked as primary, then totalLeads)
    userMetrics.sort((a, b) => {
      if (b.meetingBooked !== a.meetingBooked) {
        return b.meetingBooked - a.meetingBooked
      }
      return b.totalLeads - a.totalLeads
    })

    // Calculate aggregate (combined totals for all users)
    const aggregate: UserPerformanceData = {
      name: 'Total (All Users)',
      totalLeads: userMetrics.reduce((sum, u) => sum + u.totalLeads, 0),
      requested: userMetrics.reduce((sum, u) => sum + u.requested, 0),
      texted: userMetrics.reduce((sum, u) => sum + u.texted, 0),
      firstFollowup: userMetrics.reduce((sum, u) => sum + u.firstFollowup, 0),
      secondFollowup: userMetrics.reduce((sum, u) => sum + u.secondFollowup, 0),
      replied: userMetrics.reduce((sum, u) => sum + u.replied, 0),
      meetingBooked: userMetrics.reduce((sum, u) => sum + u.meetingBooked, 0),
      closed: userMetrics.reduce((sum, u) => sum + u.closed, 0),
      junk: userMetrics.reduce((sum, u) => sum + u.junk, 0),
      requestedToTexted: 0,
      textedToFirstFollowup: 0,
      firstFollowupToSecondFollowup: 0,
      secondFollowupToReplied: 0,
      repliedToMeeting: 0,
      meetingToClosed: 0,
    }

    // Calculate aggregate conversion percentages
    if (aggregate.requested > 0) {
      aggregate.requestedToTexted = Math.round(
        (aggregate.texted / aggregate.requested) * 100 * 1000
      ) / 1000
    }
    if (aggregate.texted > 0) {
      aggregate.textedToFirstFollowup = Math.round(
        (aggregate.firstFollowup / aggregate.texted) * 100 * 1000
      ) / 1000
    }
    if (aggregate.firstFollowup > 0) {
      aggregate.firstFollowupToSecondFollowup = Math.round(
        (aggregate.secondFollowup / aggregate.firstFollowup) * 100 * 1000
      ) / 1000
    }
    if (aggregate.secondFollowup > 0) {
      aggregate.secondFollowupToReplied = Math.round(
        (aggregate.replied / aggregate.secondFollowup) * 100 * 1000
      ) / 1000
    }
    if (aggregate.replied > 0) {
      aggregate.repliedToMeeting = Math.round(
        (aggregate.meetingBooked / aggregate.replied) * 100 * 1000
      ) / 1000
    }
    if (aggregate.meetingBooked > 0) {
      aggregate.meetingToClosed = Math.round(
        (aggregate.closed / aggregate.meetingBooked) * 100 * 1000
      ) / 1000
    }

    return NextResponse.json({
      success: true,
      data: userMetrics,
      aggregate,
    })
  } catch (error: any) {
    console.error('Error fetching user performance data:', error)
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    )
  }
}

