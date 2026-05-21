import { inngest } from './client'
import { sendReminderEmailById } from '../reminder-email-job'

export const sendLeadReminderEmail = inngest.createFunction(
  {
    id: 'send-lead-reminder-email',
    cancelOn: [{ event: 'app/reminder.cancelled', match: 'data.reminderId' }],
    triggers: [{ event: 'app/reminder.scheduled' }],
  },
  async ({ event }) => {
    const reminderId = event.data.reminderId as string
    if (!reminderId) return
    await sendReminderEmailById(reminderId)
  }
)

export const inngestFunctions = [sendLeadReminderEmail]
