import { getPartsCatalog } from '../actions'
import { PartsPageClient } from './PartsPageClient'

export async function PartsPage() {
  const response = await getPartsCatalog()

  return (
    <PartsPageClient
      initialParts={response.success ? response.data.partsInventories || [] : []}
      initialRooftops={response.success ? response.data.rooftops || [] : []}
      initialError={response.success ? null : response.error}
    />
  )
}

export default PartsPage
