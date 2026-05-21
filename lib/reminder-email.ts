import nodemailer from 'nodemailer'
import { formatRemindAtDisplay } from './reminder-datetime'

/**
 * Send reminder emails via SMTP (Gmail or any SMTP server).
 * Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, MAIL_FROM in .env
 * and user.email on the user record in the database.
 */

function getSmtpTransporter() {
  const host = process.env.SMTP_HOST
  const port = process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : 587
  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASS?.replace(/^"|"$/g, '')
  if (!host || !user || !pass) return null

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  })
}

export async function sendReminderEmail(params: {
  to: string
  leadName: string
  company?: string | null
  remindAt: Date
  note?: string | null
  appUrl?: string
}): Promise<boolean> {
  const from = process.env.MAIL_FROM || process.env.SMTP_USER
  const transporter = getSmtpTransporter()
  if (!transporter || !from) {
    console.warn('[Reminder email] Skipped: set SMTP_HOST, SMTP_USER, SMTP_PASS, and MAIL_FROM')
    return false
  }

  const when = formatRemindAtDisplay(params.remindAt)
  const appUrl = params.appUrl || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const subject = `Reminder: follow up with ${params.leadName}`
  const html = `
    <p>You have a conversation reminder for <strong>${escapeHtml(params.leadName)}</strong>${params.company ? ` (${escapeHtml(params.company)})` : ''}.</p>
    <p><strong>When:</strong> ${escapeHtml(when)}</p>
    ${params.note ? `<p><strong>Note:</strong> ${escapeHtml(params.note)}</p>` : ''}
    <p><a href="${escapeHtml(appUrl)}/dashboard/reminders">View reminders</a> · <a href="${escapeHtml(appUrl)}/dashboard">Open leads</a></p>
  `.trim()

  try {
    await transporter.sendMail({
      from,
      to: params.to,
      subject,
      html,
    })
    return true
  } catch (e) {
    console.error('[Reminder email] SMTP failed:', e)
    return false
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
