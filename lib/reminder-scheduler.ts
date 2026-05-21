import { inngest } from './inngest/client'
import { sendReminderEmailById } from './reminder-email-job'

const scheduledEventId = (reminderId: string) => `reminder-${reminderId}`

/**
 * Schedule reminder email at exact remindAt via Inngest (works on Vercel Hobby).
 * Requires INNGEST_EVENT_KEY in env (set automatically with Vercel Inngest integration).
 */
export async function scheduleReminderEmailJob(
  reminderId: string,
  remindAt: Date
): Promise<void> {
  if (remindAt.getTime() <= Date.now()) {
    await sendReminderEmailById(reminderId)
    return
  }

  if (!process.env.INNGEST_EVENT_KEY) {
    console.warn(
      '[Inngest] INNGEST_EVENT_KEY missing — future reminder emails will not send until configured.'
    )
    return
  }

  await inngest.send({
    name: 'app/reminder.scheduled',
    data: { reminderId },
    ts: remindAt.getTime(),
    id: scheduledEventId(reminderId),
  })
}

/** Cancel pending scheduled email (edit time or delete reminder). */
export async function cancelReminderEmailJob(reminderId: string): Promise<void> {
  if (!process.env.INNGEST_EVENT_KEY) return

  await inngest.send({
    name: 'app/reminder.cancelled',
    data: { reminderId },
  })
}
