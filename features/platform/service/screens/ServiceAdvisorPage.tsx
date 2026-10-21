import { getFixedOpsWorkspace } from '../actions'
import { ServiceAdvisorPageClient } from './ServiceAdvisorPageClient'

export async function ServiceAdvisorPage() {
  const response = await getFixedOpsWorkspace()

  return (
    <ServiceAdvisorPageClient
      initialWorkspace={response.success ? response.data.fixedOpsWorkspace : null}
      initialError={response.success ? null : response.error}
    />
  )
}

export default ServiceAdvisorPage
