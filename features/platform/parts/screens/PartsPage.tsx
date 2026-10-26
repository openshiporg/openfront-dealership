import { getPartsCatalog, getPurchaseOrders } from '../actions'
import { PartsPageClient } from './PartsPageClient'

export async function PartsPage() {
  // Purchase orders feed the "POs to receive" queue; a failure there leaves the catalog usable.
  const [response, purchaseOrders] = await Promise.all([getPartsCatalog(), getPurchaseOrders()])

  return (
    <PartsPageClient
      initialParts={response.success ? response.data.partsInventories || [] : []}
      initialRooftops={response.success ? response.data.rooftops || [] : []}
      initialError={response.success ? null : response.error}
      initialPurchaseOrders={purchaseOrders.success ? purchaseOrders.data.partsPurchaseOrders || [] : []}
    />
  )
}

export default PartsPage
