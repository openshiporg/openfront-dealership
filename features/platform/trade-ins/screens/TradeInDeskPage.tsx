import { getTradeIns } from '../actions'
import { TradeInDeskPageClient } from './TradeInDeskPageClient'
import { getDealershipTimeZone } from '../../lib/dealershipTimeZone'

export async function TradeInDeskPage() {
  const [response, timeZone] = await Promise.all([getTradeIns(), getDealershipTimeZone()])

  return (
    <TradeInDeskPageClient
      initialData={response.success ? response.data : null}
      initialError={response.success ? null : response.error}
      timeZone={timeZone}
    />
  )
}

export default TradeInDeskPage
