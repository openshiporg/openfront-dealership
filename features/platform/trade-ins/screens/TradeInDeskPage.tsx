import { getTradeIns } from '../actions'
import { TradeInDeskPageClient } from './TradeInDeskPageClient'

export async function TradeInDeskPage() {
  const response = await getTradeIns()

  return (
    <TradeInDeskPageClient
      initialTradeIns={response.success ? response.data.tradeIns || [] : []}
      initialError={response.success ? null : response.error}
    />
  )
}

export default TradeInDeskPage
