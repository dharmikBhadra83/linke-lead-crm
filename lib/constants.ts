export type LeadStatus = 'new' | 'requested' | 'texted' | 'replied' | 'meeting_booked' | 'first_followup' | 'second_followup' | 'junk' | 'closed' | 'commented'
export type UserRole = 'admin' | 'lead_gen' | 'outreach'
export type System = 'linkedin_one' | 'linkedin_two' | 'upwork'

export const LEAD_STATUSES: LeadStatus[] = [
  'new',
  'requested',
  'texted',
  'replied',
  'meeting_booked',
  'first_followup',
  'second_followup',
  'junk',
  'closed',
  'commented',
]

export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  new: 'New',
  requested: 'Requested',
  texted: 'Texted',
  replied: 'Replied',
  meeting_booked: 'Meeting Booked',
  first_followup: 'First Follow-up',
  second_followup: 'Second Follow-up',
  junk: 'Junk',
  closed: 'Closed',
  commented: 'Commented',
}

export const USER_ROLES: UserRole[] = ['admin', 'lead_gen', 'outreach']

export const USER_ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Admin',
  lead_gen: 'Lead Gen',
  outreach: 'Outreach',
}

export const SYSTEMS: System[] = [
  'linkedin_one',
  'linkedin_two',
  'upwork',
]

export const SYSTEM_LABELS: Record<System, string> = {
  linkedin_one: 'LinkedIn One',
  linkedin_two: 'LinkedIn Two',
  upwork: 'Upwork',
}

// Automation rules
export const AUTOMATION_RULES = {
  FOLLOWUP_2_TO_JUNK_DAYS: 4,
  TEXTED_FILTER_DAYS: 4,
  FOLLOWUP_1_FILTER_DAYS: 4,
  REPLIED_FILTER_DAYS: 6,
} as const

