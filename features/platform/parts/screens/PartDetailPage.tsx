import { notFound } from 'next/navigation'
import { getPartDetail } from '../actions'
import { PartDetailPageClient } from './PartDetailPageClient'
import { getDealershipTimeZone } from '../../lib/dealershipTimeZone'

export async function PartDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [response, timeZone] = await Promise.all([getPartDetail(id), getDealershipTimeZone()])
  const part = response.success ? response.data.partsInventory : null
  // An unreadable or missing record is a 404, never a 200 or a 500.
  if (!part) notFound()

  return (
    <PartDetailPageClient
      id={id}
      initialPart={part}
      initialMovements={response.success ? response.data.partsMovements || [] : []}
      initialRepairOrders={response.success ? response.data.serviceOrders || [] : []}
      initialPurchaseOrders={response.success ? response.data.purchaseOrders || [] : []}
      initialError={response.success ? (part ? null : 'Part not found') : response.error}
      timeZone={timeZone}
    />
  )
}

export default PartDetailPage
