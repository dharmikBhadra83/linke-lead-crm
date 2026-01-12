import { NextRequest, NextResponse } from 'next/server'
import { runAutomationRules } from '@/lib/automation'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Cron endpoint for running automation rules
 * This endpoint should be called periodically (e.g., daily at midnight)
 * 
 * For Vercel Cron, configure in vercel.json
 * For other platforms, use a cron service to hit this endpoint
 * 
 * Security: In production, this should be protected with:
 * 1. Vercel Cron secret (automatically handled by Vercel)
 * 2. Or a custom auth token via Authorization header
 */
export async function GET(request: NextRequest) {
  try {
   
    const cronHeader = request.headers.get('x-vercel-cron')
    const isProduction = process.env.VERCEL === '1'
    
    if (isProduction && !cronHeader) {
      console.warn('[Cron] Unauthorized access attempt (missing x-vercel-cron header)')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!isProduction && !cronHeader) {
      console.log('[Cron] Local test mode - allowing execution without Vercel header')
    }

    console.log('[Cron] Running automation rules...')
    const result = await runAutomationRules()
    
    console.log(`[Cron] Automation completed: ${result.transitioned} leads transitioned`)
    
    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      ...result,
    })
  } catch (error: any) {
    console.error('[Cron] Error running automation:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Internal server error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    )
  }
}

// Also support POST for flexibility
export async function POST(request: NextRequest) {
  return GET(request)
}

