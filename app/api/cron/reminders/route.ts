import { NextRequest, NextResponse } from 'next/server'
import { processDueReminderEmails } from '@/lib/lead-reminders-cron'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

/** Runs every minute via Vercel cron — sends emails for due reminders. */
export async function GET(request: NextRequest) {
  try {
    const cronHeader = request.headers.get('x-vercel-cron')
    const isProduction = process.env.VERCEL === '1'

    if (isProduction && !cronHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const sent = await processDueReminderEmails()
    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      emailsSent: sent,
    })
  } catch (error: unknown) {
    console.error('[Cron reminders] Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  return GET(request)
}
