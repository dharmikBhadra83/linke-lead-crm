import { NextRequest, NextResponse } from 'next/server'
import { syncTaskBacklog } from '@/lib/tasks-backlog'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  try {
    const cronHeader = request.headers.get('x-vercel-cron')
    const isProduction = process.env.VERCEL === '1'

    if (isProduction && !cronHeader) {
      console.warn('[Cron tasks-backlog] Unauthorized (missing x-vercel-cron header)')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!isProduction && !cronHeader) {
      console.log('[Cron tasks-backlog] Local test - allowing without Vercel header')
    }

    console.log('[Cron tasks-backlog] Running task backlog sync...')
    const count = await syncTaskBacklog()
    console.log(`[Cron tasks-backlog] Done: ${count} task(s) moved to backlog`)

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      tasksMovedToBacklog: count,
    })
  } catch (error: unknown) {
    console.error('[Cron tasks-backlog] Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  return GET(request)
}
