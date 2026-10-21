import { getDeliveryWorkspace } from '../actions'
import { DeliveryDeskPageClient } from './DeliveryDeskPageClient'

export async function DeliveryDeskPage() {
  const response = await getDeliveryWorkspace()

  return (
    <DeliveryDeskPageClient
      initialWorkspace={response.success ? response.data.deliveryWorkspace : null}
      initialError={response.success ? null : response.error}
    />
  )
}

export default DeliveryDeskPage
