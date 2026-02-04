'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

// Backlog tab removed: use Tasks page with Status filter (Undone / Done / Backlog)
export default function BacklogRedirectPage() {
  const router = useRouter()
  useEffect(() => {
    router.replace('/dashboard/tasks')
  }, [router])
  return null
}
