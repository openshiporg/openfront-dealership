import { getFixedOpsWorkspace } from '../actions'
import { ServiceAdvisorPageClient } from './ServiceAdvisorPageClient'
import { getDealershipTimeZone } from '../../lib/dealershipTimeZone'

export async function ServiceAdvisorPage() {
  const [response, timeZone] = await Promise.all([getFixedOpsWorkspace(), getDealershipTimeZone()])

  return (
    <ServiceAdvisorPageClient
      initialWorkspace={response.success ? response.data.fixedOpsWorkspace : null}
      initialError={response.success ? null : response.error}
      timeZone={timeZone}
    />
  )
}

export default ServiceAdvisorPage
