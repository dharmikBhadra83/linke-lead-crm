import bcrypt from 'bcryptjs'
import { prisma } from './prisma'

export type UserRole = 'admin' | 'lead_gen' | 'outreach'

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10)
}

export async function verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
  return bcrypt.compare(password, hashedPassword)
}

export interface SessionUser {
  id: string
  username: string
  role: UserRole
}

export function requireRole(user: SessionUser | null, allowedRoles: UserRole[]): void {
  if (!user) {
    throw new Error('Unauthorized')
  }
  if (!allowedRoles.includes(user.role)) {
    throw new Error('Forbidden')
  }
}

