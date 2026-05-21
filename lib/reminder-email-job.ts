import { prisma } from './prisma'
import { sendReminderEmail } from './reminder-email'

/** Send reminder email for one lead_reminders row (used by Agenda + manual catch-up). */
export async function sendReminderEmailById(reminderId: string): Promise<boolean> {
  const r = await prisma.leadReminder.findUnique({
    where: { id: reminderId },
    include: {
      lead: { select: { id: true, name: true, company: true, assignedToId: true } },
      user: { select: { id: true, email: true, username: true } },
    },
  })

  if (!r || r.emailSentAt) return false
  if (!r.user.email) return false

  const now = new Date()

  // Lead unclaimed or reassigned — mark handled, no email
  if (r.lead.assignedToId !== r.userId) {
    await prisma.leadReminder.update({
      where: { id: r.id },
      data: { emailSentAt: now },
    })
    return false
  }

  const ok = await sendReminderEmail({
    to: r.user.email,
    leadName: r.lead.name,
    company: r.lead.company,
    remindAt: r.remindAt,
    note: r.note,
  })

  if (ok) {
    await prisma.leadReminder.update({
      where: { id: r.id },
      data: { emailSentAt: now },
    })
    console.log(`[Reminder email] Sent for reminder ${reminderId}`)
  }

  return ok
}
