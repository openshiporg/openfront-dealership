import { getCancellationsWorkspace } from '../actions/cancellations'
import { getDealershipTimeZone } from '../../lib/dealershipTimeZone'
import { FinanceCancellationsPageClient } from './FinanceCancellationsPageClient'

export async function FinanceCancellationsPage({ searchParams }: { searchParams: Promise<{ deal?: string | string[] }> }) {
  const [response, timeZone, params] = await Promise.all([getCancellationsWorkspace(), getDealershipTimeZone(), searchParams])
  const dealId = typeof params?.deal === 'string' ? params.deal : null
  return (
    <FinanceCancellationsPageClient
      initial={response.success ? response.data : null}
      initialError={response.success ? null : response.error}
      timeZone={timeZone}
      focusDealId={dealId}
    />
  )
}

export default FinanceCancellationsPage
