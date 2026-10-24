import { getPaymentProviders, getPayments } from '../actions'
import { getDealershipTimeZone } from '../../lib/dealershipTimeZone'
import { PaymentsPageClient } from './PaymentsPageClient'

export async function PaymentsPage() {
  const timeZone = await getDealershipTimeZone()
  const [payments, providers] = await Promise.all([
    getPayments({ status: 'all', provider: 'all', from: '', to: '', search: '' }, timeZone),
    getPaymentProviders(),
  ])

  return (
    <PaymentsPageClient
      timeZone={timeZone}
      initialTransactions={payments.success ? payments.data.transactions : []}
      initialCounts={payments.success ? payments.data.counts : null}
      initialError={payments.success ? null : payments.error}
      initialProviders={providers.success ? providers.data.paymentProviders || [] : []}
      initialProviderError={providers.success ? null : providers.error}
    />
  )
}

export default PaymentsPage
