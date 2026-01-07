import Papa from 'papaparse'
import { createLeadSchema } from './validations'

export interface CSVLeadRow {
  name: string
  email?: string
  company?: string
  profileUrl?: string
  postUrl?: string
  website?: string
}

export interface CSVParseResult {
  valid: CSVLeadRow[]
  invalid: { row: number; errors: string[] }[]
}

/**
 * Parse CSV from buffer/string (server-side)
 */
export function parseCSVFromBuffer(csvContent: string | Buffer): CSVParseResult {
  const valid: CSVLeadRow[] = []
  const invalid: { row: number; errors: string[] }[] = []

  const csvString = typeof csvContent === 'string' ? csvContent : csvContent.toString('utf-8')
  
  const results = Papa.parse<Record<string, string>>(csvString, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header) => header.trim(),
  })

  results.data.forEach((row, index) => {
    const errors: string[] = []
    
    // Normalize column names (case-insensitive, handle spaces and variations)
    const normalizedRow: Record<string, string> = {}
    Object.keys(row).forEach(key => {
      const normalizedKey = key.toLowerCase().trim().replace(/\s+/g, ' ')
      // Clean the value - remove quotes and extra whitespace
      let value = (row[key]?.trim() || '').replace(/^"|"$/g, '').trim()
      // Remove any duplicate text patterns (handle cases where name might be duplicated)
      if (normalizedKey === 'full name' || normalizedKey === 'name') {
        // If the name appears twice consecutively, remove the duplicate
        const halfLength = Math.floor(value.length / 2)
        if (halfLength > 0 && value.substring(0, halfLength) === value.substring(halfLength)) {
          value = value.substring(0, halfLength)
        }
      }
      normalizedRow[normalizedKey] = value
    })

    // Map CSV columns to our schema
    // CSV columns: Full Name, Post URL, Profile URL, Company Name, Company URL
    let name = normalizedRow['full name'] || normalizedRow['name'] || ''
    
    // Clean name - remove any remaining duplicates and trim
    name = name.trim()
    
    // Handle duplicated names (e.g., "Kazi WaseefKazi Waseef" or "John DoeJohn Doe")
    // Method 1: Check if the entire string is duplicated
    if (name.length > 0) {
      const halfLength = Math.floor(name.length / 2)
      if (halfLength > 0) {
        const firstHalf = name.substring(0, halfLength).trim()
        const secondHalf = name.substring(halfLength).trim()
        // If first half equals second half, it's a duplicate
        if (firstHalf === secondHalf) {
          name = firstHalf
        }
      }
    }
    
    // Method 2: Check if name words are duplicated (e.g., "John Doe John Doe")
    const nameWords = name.split(/\s+/).filter(w => w.length > 0)
    if (nameWords.length >= 2 && nameWords.length % 2 === 0) {
      const midPoint = nameWords.length / 2
      const firstHalf = nameWords.slice(0, midPoint).join(' ')
      const secondHalf = nameWords.slice(midPoint).join(' ')
      if (firstHalf === secondHalf) {
        name = firstHalf
      }
    }
    
    const leadData: CSVLeadRow = {
      name: name,
      email: normalizedRow['email'] || undefined,
      company: normalizedRow['company name'] || normalizedRow['company'] || undefined,
      profileUrl: normalizedRow['profile url'] || normalizedRow['profileurl'] || undefined,
      postUrl: normalizedRow['post url'] || normalizedRow['posturl'] || undefined,
      website: normalizedRow['website'] || undefined,
    }

    // Skip if name is empty (required field)
    if (!leadData.name || leadData.name.trim() === '') {
      invalid.push({ row: index + 2, errors: ['Name is required'] })
      return
    }

    // Validate using zod schema
    const validation = createLeadSchema.safeParse(leadData)
    
    if (!validation.success) {
      validation.error.errors.forEach(err => {
        errors.push(`${err.path.join('.')}: ${err.message}`)
      })
      invalid.push({ row: index + 2, errors }) // +2 because index is 0-based and we skip header
    } else {
      valid.push(validation.data as CSVLeadRow)
    }
  })

  return { valid, invalid }
}

/**
 * Parse CSV from File object (client-side, kept for compatibility)
 */
export function parseCSV(file: File): Promise<CSVParseResult> {
  return new Promise((resolve, reject) => {
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => header.trim(),
      complete: (results) => {
        const valid: CSVLeadRow[] = []
        const invalid: { row: number; errors: string[] }[] = []

        results.data.forEach((row, index) => {
          const errors: string[] = []
          
          // Normalize column names
          const normalizedRow: Record<string, string> = {}
          Object.keys(row).forEach(key => {
            const normalizedKey = key.toLowerCase().trim().replace(/\s+/g, ' ')
            let value = (row[key]?.trim() || '').replace(/^"|"$/g, '').trim()
            // Remove duplicate text patterns for names
            if (normalizedKey === 'full name' || normalizedKey === 'name') {
              const halfLength = Math.floor(value.length / 2)
              if (halfLength > 0 && value.substring(0, halfLength) === value.substring(halfLength)) {
                value = value.substring(0, halfLength)
              }
            }
            normalizedRow[normalizedKey] = value
          })

          let name = normalizedRow['full name'] || normalizedRow['name'] || ''
          name = name.trim()
          
          // Handle duplicated names
          if (name.length > 0) {
            const halfLength = Math.floor(name.length / 2)
            if (halfLength > 0) {
              const firstHalf = name.substring(0, halfLength).trim()
              const secondHalf = name.substring(halfLength).trim()
              if (firstHalf === secondHalf) {
                name = firstHalf
              }
            }
          }
          
          // Check if name words are duplicated
          const nameWords = name.split(/\s+/).filter(w => w.length > 0)
          if (nameWords.length >= 2 && nameWords.length % 2 === 0) {
            const midPoint = nameWords.length / 2
            const firstHalf = nameWords.slice(0, midPoint).join(' ')
            const secondHalf = nameWords.slice(midPoint).join(' ')
            if (firstHalf === secondHalf) {
              name = firstHalf
            }
          }

          const leadData: CSVLeadRow = {
            name: name,
            email: normalizedRow['email'] || undefined,
            company: normalizedRow['company name'] || normalizedRow['company'] || undefined,
            profileUrl: normalizedRow['profile url'] || normalizedRow['profileurl'] || undefined,
            postUrl: normalizedRow['post url'] || normalizedRow['posturl'] || undefined,
            website: normalizedRow['website'] || undefined,
          }

          if (!leadData.name || leadData.name.trim() === '') {
            invalid.push({ row: index + 2, errors: ['Name is required'] })
            return
          }

          const validation = createLeadSchema.safeParse(leadData)
          
          if (!validation.success) {
            validation.error.errors.forEach(err => {
              errors.push(`${err.path.join('.')}: ${err.message}`)
            })
            invalid.push({ row: index + 2, errors })
          } else {
            valid.push(validation.data as CSVLeadRow)
          }
        })

        resolve({ valid, invalid })
      },
      error: (error) => {
        reject(new Error(`CSV parsing error: ${error.message}`))
      },
    })
  })
}

