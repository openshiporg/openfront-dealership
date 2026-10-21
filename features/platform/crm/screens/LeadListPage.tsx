import { getCrmLeads } from '../actions'
import { LeadListPageClient } from './LeadListPageClient'

export async function LeadListPage() {
  const response = await getCrmLeads()

  return (
    <LeadListPageClient
      initialLeads={response.success ? response.data.crmWorkspace.leads || [] : []}
      initialError={response.success ? null : response.error}
    />
  )
}

export default LeadListPage
