import { cookies } from 'next/headers'
import { SessionUser } from './auth'
import { prisma } from './prisma'

const SESSION_COOKIE_NAME = 'crm_session'
const SESSION_MAX_AGE = 60 * 60 * 24 * 7 // 7 days

export async function createSession(user: SessionUser): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.set(SESSION_COOKIE_NAME, JSON.stringify(user), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: SESSION_MAX_AGE,
    path: '/',
  })
}

export async function getSession(): Promise<SessionUser | null> {
  const cookieStore = await cookies()
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME)

  if (!sessionCookie?.value) {
    return null
  }

  let parsed: SessionUser
  try {
    parsed = JSON.parse(sessionCookie.value) as SessionUser
  } catch {
    return null
  }

  if (!parsed?.id) {
    return null
  }

  const user = await prisma.user.findUnique({
    where: { id: parsed.id },
    select: { id: true, username: true, role: true },
  })

  if (!user) {
    return null
  }

  const session: SessionUser = {
    id: user.id,
    username: user.username,
    role: user.role as SessionUser['role'],
  }

  if (
    session.id !== parsed.id ||
    session.username !== parsed.username ||
    session.role !== parsed.role
  ) {
    await createSession(session)
  }

  return session
}

export async function deleteSession(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete(SESSION_COOKIE_NAME)
}

