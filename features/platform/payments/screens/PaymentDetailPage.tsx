import { notFound } from 'next/navigation'
import { getPayment } from '../actions'
import { getDealershipTimeZone } from '../../lib/dealershipTimeZone'
import { PaymentDetailPageClient } from './PaymentDetailPageClient'

export async function PaymentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [response, timeZone] = await Promise.all([getPayment(id), getDealershipTimeZone()])
  // An unreadable or missing record is a 404, never a 200 or a 500.
  if (!response.success || !response.data.paymentTransaction) notFound()

  return (
    <PaymentDetailPageClient
      id={id}
      timeZone={timeZone}
      initialPayment={response.success ? response.data.paymentTransaction : null}
      initialRefunds={response.success ? response.data.paymentRefunds || [] : []}
      initialEvents={response.success ? response.data.paymentProviderEvents || [] : []}
      initialError={null}
    />
  )
}

export default PaymentDetailPage
