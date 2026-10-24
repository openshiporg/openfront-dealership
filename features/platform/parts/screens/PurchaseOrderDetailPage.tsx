import { getPurchaseOrder } from '../actions'
import { PurchaseOrderDetailPageClient } from './PurchaseOrderDetailPageClient'
import { getDealershipTimeZone } from '../../lib/dealershipTimeZone'

export async function PurchaseOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [response, timeZone] = await Promise.all([getPurchaseOrder(id), getDealershipTimeZone()])
  const order = response.success ? response.data.partsPurchaseOrder : null

  return (
    <PurchaseOrderDetailPageClient
      id={id}
      initialOrder={order}
      initialParts={response.success ? response.data.partsInventories || [] : []}
      initialError={response.success ? (order ? null : 'Purchase order not found') : response.error}
      timeZone={timeZone}
    />
  )
}

export default PurchaseOrderDetailPage
