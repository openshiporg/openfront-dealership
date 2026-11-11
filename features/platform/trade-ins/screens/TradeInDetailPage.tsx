import { notFound } from 'next/navigation'
import { getTradeIn } from '../actions'
import { TradeInDetailPageClient } from './TradeInDetailPageClient'
import { getDealershipTimeZone } from '../../lib/dealershipTimeZone'

export async function TradeInDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [response, timeZone] = await Promise.all([getTradeIn(id), getDealershipTimeZone()])
  // An unreadable or missing record is a 404, never a 200 or a 500.
  if (!response.success || !response.data.tradeIn) notFound()

  return (
    <TradeInDetailPageClient
      id={id}
      initialData={response.success ? response.data : null}
      initialError={null}
      timeZone={timeZone}
    />
  )
}

export default TradeInDetailPage
