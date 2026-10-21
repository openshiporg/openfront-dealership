import { DealDetailPageClient } from './DealDetailPageClient'

export async function DealDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  return <DealDetailPageClient id={id} />
}

export default DealDetailPage
