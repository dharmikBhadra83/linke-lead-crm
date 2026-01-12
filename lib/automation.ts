import { prisma } from './prisma'

/**
 * Automatically transitions leads from second_followup to junk after 4 days
 * This is called by a cron job at /api/cron/automation (configured in vercel.json)
 * The cron runs daily at midnight (0 0 * * *)
 */
export async function runAutomationRules() {
  try {
    const fourDaysAgo = new Date(Date.now() - 4 * 24 * 60 * 60 * 1000)

    // Get admin user once (for status history tracking)
    const adminUser = await prisma.user.findFirst({
      where: { role: 'admin' },
      select: { id: true },
    })

    if (!adminUser) {
      console.warn('[Automation] No admin user found, skipping automation')
      return { transitioned: 0, error: 'No admin user found' }
    }

    // Find leads in second_followup status where secondFollowupAt is more than 4 days ago
    const leadsToTransition = await prisma.lead.findMany({
      where: {
        status: 'second_followup',
        secondFollowupAt: {
          not: null,
          lte: fourDaysAgo,
        },
      },
      select: {
        id: true,
      },
    })

    if (leadsToTransition.length === 0) {
      return { transitioned: 0 }
    }

    // Transition each lead to junk and log the change
    for (const lead of leadsToTransition) {
      await prisma.statusHistory.create({
        data: {
          leadId: lead.id,
          userId: adminUser.id,
          oldStatus: 'second_followup',
          newStatus: 'junk',
          reason: 'Automated: Second Follow-up > 4 days',
        },
      })

      // Update lead status
      await prisma.lead.update({
        where: { id: lead.id },
        data: {
          status: 'junk',
        },
      })
    }

    console.log(`[Automation] Successfully transitioned ${leadsToTransition.length} leads from second_followup to junk`)
    return { transitioned: leadsToTransition.length }
  } catch (error) {
    console.error('[Automation] Error running automation rules:', error)
    return { transitioned: 0, error: 'Failed to run automation' }
  }
}

