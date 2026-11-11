import { notFound } from 'next/navigation'
import { getDealWorkspace } from '../actions'
import { DealDetailPageClient } from './DealDetailPageClient'

export async function DealDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  // An unreadable or missing record is a 404, never a 200 or a 500.
  const response = await getDealWorkspace(id)
  if (!response.success || !response.data.dealWorkspace?.deal) notFound()

  return <DealDetailPageClient id={id} />
}

export default DealDetailPage
