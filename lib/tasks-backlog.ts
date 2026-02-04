import { prisma } from './prisma'


export async function syncTaskBacklog() {
  const now = new Date()
  const result = await prisma.task.updateMany({
    where: { status: 'undone', dueAt: { lt: now } },
    data: { status: 'backlog' },
  })
  if (result.count > 0) {
    console.log(`[Tasks Backlog Cron] Moved ${result.count} task(s) to backlog (24h passed, no action)`)
  }
  return result.count
}
