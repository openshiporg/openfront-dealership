import { getFinancingApplication } from '../actions/applications'
import { getDealershipTimeZone } from '../../lib/dealershipTimeZone'
import { FinancingApplicationPageClient } from './FinancingApplicationPageClient'

export async function FinancingApplicationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [response, timeZone] = await Promise.all([getFinancingApplication(id), getDealershipTimeZone()])
  return (
    <FinancingApplicationPageClient
      id={id}
      initial={response.success ? response.data.financingApplication : null}
      initialError={response.success ? (response.data.financingApplication ? null : 'Application not found or not accessible.') : response.error}
      timeZone={timeZone}
    />
  )
}

export default FinancingApplicationPage
