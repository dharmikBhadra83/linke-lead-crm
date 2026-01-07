import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { requireRole } from '@/lib/auth'
import { parseCSVFromBuffer } from '@/lib/csv-parser'

// POST /api/leads/import - Import leads from CSV
export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only admin and lead_gen can import CSV
    requireRole(session, ['admin', 'lead_gen'])

    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // Read file as buffer (server-side)
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    
    // Parse CSV from buffer
    const parseResult = parseCSVFromBuffer(buffer)

    if (parseResult.valid.length === 0) {
      return NextResponse.json(
        { error: 'No valid leads found in CSV', invalid: parseResult.invalid },
        { status: 400 }
      )
    }

    // Create leads (skip duplicates by email or profileUrl)
    const createdLeads = []
    const skippedLeads = []

    for (const leadData of parseResult.valid) {
      try {
        // Check for duplicate by email (if email provided)
        if (leadData.email) {
          const existingByEmail = await prisma.lead.findFirst({
            where: { email: leadData.email },
          })

          if (existingByEmail) {
            skippedLeads.push({ ...leadData, reason: 'Duplicate email' })
            continue
          }
        }

        // Check for duplicate by profileUrl (if profileUrl provided)
        if (leadData.profileUrl) {
          const existingByProfile = await prisma.lead.findFirst({
            where: { profileUrl: leadData.profileUrl },
          })

          if (existingByProfile) {
            skippedLeads.push({ ...leadData, reason: 'Duplicate profile URL' })
            continue
          }
        }

        // Check for duplicate by name + company (if both provided)
        if (leadData.name && leadData.company) {
          const existingByNameCompany = await prisma.lead.findFirst({
            where: {
              name: leadData.name,
              company: leadData.company,
            },
          })

          if (existingByNameCompany) {
            skippedLeads.push({ ...leadData, reason: 'Duplicate name and company' })
            continue
          }
        }

        const lead = await prisma.lead.create({
          data: leadData,
        })
        createdLeads.push(lead)
      } catch (error: any) {
        skippedLeads.push({ ...leadData, reason: error.message })
      }
    }

    return NextResponse.json({
      success: true,
      created: createdLeads.length,
      skipped: skippedLeads.length,
      invalid: parseResult.invalid.length,
      details: {
        created: createdLeads,
        skipped: skippedLeads,
        invalid: parseResult.invalid,
      },
    })
  } catch (error: any) {
    if (error.message === 'Unauthorized' || error.message === 'Forbidden') {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }

    console.error('Error importing CSV:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

