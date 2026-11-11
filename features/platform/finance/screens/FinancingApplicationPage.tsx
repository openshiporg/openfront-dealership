import { notFound } from 'next/navigation'
import { getFinancingApplication } from '../actions/applications'
import { getDealershipTimeZone } from '../../lib/dealershipTimeZone'
import { FinancingApplicationPageClient } from './FinancingApplicationPageClient'

export async function FinancingApplicationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [response, timeZone] = await Promise.all([getFinancingApplication(id), getDealershipTimeZone()])
  // An unreadable or missing record is a 404, never a 200 or a 500.
  if (!response.success || !response.data.financingApplication) notFound()
  return (
    <FinancingApplicationPageClient
      id={id}
      initial={response.success ? response.data.financingApplication : null}
      initialError={null}
      timeZone={timeZone}
    />
  )
}

export default FinancingApplicationPage
