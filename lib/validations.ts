import { z } from 'zod'

// Auth validations
export const loginSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
})

export const createUserSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  role: z.enum(['admin', 'lead_gen', 'outreach']),
})

// Lead validations
export const createLeadSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email().optional().or(z.literal('')),
  company: z.string().optional(),
  profileUrl: z.string().url().optional().or(z.literal('')),
  postUrl: z.string().url().optional().or(z.literal('')),
  website: z.string().url().optional().or(z.literal('')),
  notes: z.string().optional(),
  assignedToId: z.string().optional().nullable(),
})

export const updateLeadSchema = createLeadSchema.partial().extend({
  status: z.enum(['new', 'requested', 'texted', 'replied', 'meeting_booked', 'first_followup', 'second_followup', 'junk', 'closed', 'commented']).optional(),
  assignedToId: z.string().optional().nullable(),
})

export const claimLeadSchema = z.object({
  leadId: z.string().min(1, 'Lead ID is required'),
})

export const changeStatusSchema = z.object({
  leadId: z.string().min(1, 'Lead ID is required'),
  newStatus: z.enum(['new', 'requested', 'texted', 'replied', 'meeting_booked', 'first_followup', 'second_followup', 'junk', 'closed', 'commented']),
  reason: z.string().optional(),
})

