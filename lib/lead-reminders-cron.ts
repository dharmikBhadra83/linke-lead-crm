import { prisma } from './prisma'
import { sendReminderEmailById } from './reminder-email-job'

/** Manual catch-up for missed emails (Agenda is primary). */
export async function processDueReminderEmails(): Promise<number> {
  const now = new Date()

  const due = await prisma.leadReminder.findMany({
    where: {
      remindAt: { lte: now },
      emailSentAt: null,
    },
    select: { id: true },
    take: 50,
  })

  let sent = 0
  for (const r of due) {
    if (await sendReminderEmailById(r.id)) sent++
  }
  if (sent > 0) {
    console.log(`[Reminders catch-up] Sent ${sent} email(s)`)
  }
  return sent
}
