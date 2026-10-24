import { getDeliveryWorkspace } from '../actions'
import { DeliveryDeskPageClient } from './DeliveryDeskPageClient'
import { getDealershipTimeZone } from '../../lib/dealershipTimeZone'

export async function DeliveryDeskPage() {
  const [response, timeZone] = await Promise.all([getDeliveryWorkspace(), getDealershipTimeZone()])

  return (
    <DeliveryDeskPageClient
      initialWorkspace={response.success ? response.data.deliveryWorkspace : null}
      initialError={response.success ? null : response.error}
      timeZone={timeZone}
    />
  )
}

export default DeliveryDeskPage
