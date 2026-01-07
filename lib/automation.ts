import { prisma } from './prisma'

/**
 * Automatically transitions leads from second_followup to junk after 4 days
 * This should be called periodically (e.g., on lead fetch or status change)
 */
export async function runAutomationRules() {
  try {
    const fourDaysAgo = new Date(Date.now() - 4 * 24 * 60 * 60 * 1000)

    // Find leads in second_followup status where secondFollowupAt is more than 4 days ago
    const leadsToTransition = await prisma.lead.findMany({
      where: {
        status: 'second_followup',
        secondFollowupAt: {
          not: null,
          lte: fourDaysAgo,
        },
      },
    })

    // Transition each lead to junk and log the change
    for (const lead of leadsToTransition) {
      // Create status history entry (system user ID for automation)
      // Note: In a real system, you might want a system user
      // For now, we'll use the first admin user or skip user tracking
      const adminUser = await prisma.user.findFirst({
        where: { role: 'admin' },
      })

      if (adminUser) {
        await prisma.statusHistory.create({
          data: {
            leadId: lead.id,
            userId: adminUser.id,
            oldStatus: 'second_followup',
            newStatus: 'junk',
            reason: 'Automated: Second Follow-up > 4 days',
          },
        })

        await prisma.lead.update({
          where: { id: lead.id },
          data: {
            status: 'junk',
          },
        })
      }
    }

    return { transitioned: leadsToTransition.length }
  } catch (error) {
    console.error('Error running automation rules:', error)
    return { transitioned: 0, error: 'Failed to run automation' }
  }
}

