import { getCustomerDuplicateCount, getLead } from '../actions'
import { LeadDetailPageClient } from './LeadDetailPageClient'

export async function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const response = await getLead(id)
  const lead = response.success ? response.data.lead : null
  const duplicateCount = lead?.customer?.id ? await getCustomerDuplicateCount(lead.customer.id) : 0

  return (
    <LeadDetailPageClient
      id={id}
      initialLead={lead}
      initialDuplicateCount={duplicateCount}
      initialError={response.success ? (lead ? null : 'This lead was not found.') : response.error}
    />
  )
}

export default LeadDetailPage
