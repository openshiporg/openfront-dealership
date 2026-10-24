import { getPayment } from '../actions'
import { getDealershipTimeZone } from '../../lib/dealershipTimeZone'
import { PaymentDetailPageClient } from './PaymentDetailPageClient'

export async function PaymentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [response, timeZone] = await Promise.all([getPayment(id), getDealershipTimeZone()])

  return (
    <PaymentDetailPageClient
      id={id}
      timeZone={timeZone}
      initialPayment={response.success ? response.data.paymentTransaction : null}
      initialRefunds={response.success ? response.data.paymentRefunds || [] : []}
      initialEvents={response.success ? response.data.paymentProviderEvents || [] : []}
      initialError={response.success ? null : response.error}
    />
  )
}

export default PaymentDetailPage
