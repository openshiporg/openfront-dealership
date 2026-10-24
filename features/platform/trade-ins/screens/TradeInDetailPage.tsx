import { getTradeIn } from '../actions'
import { TradeInDetailPageClient } from './TradeInDetailPageClient'
import { getDealershipTimeZone } from '../../lib/dealershipTimeZone'

export async function TradeInDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [response, timeZone] = await Promise.all([getTradeIn(id), getDealershipTimeZone()])

  return (
    <TradeInDetailPageClient
      id={id}
      initialData={response.success ? response.data : null}
      initialError={response.success ? null : response.error}
      timeZone={timeZone}
    />
  )
}

export default TradeInDetailPage
