import { redirect } from 'next/navigation'
import { getCardioLogs } from '@/lib/actions'
import { CardioLog } from '@/types/database'
import CardioClient from './CardioClient'

export const dynamic = 'force-dynamic'

export default async function CardioPage() {
  let initialLogs: CardioLog[] = []
  try {
    initialLogs = await getCardioLogs()
  } catch (e) {
    if (e instanceof Error && e.message === 'Unauthorized') redirect('/')
  }
  return <CardioClient initialLogs={initialLogs} />
}
