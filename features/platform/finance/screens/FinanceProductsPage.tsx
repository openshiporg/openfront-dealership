import { getFinanceProductCatalog } from '../actions/catalog'
import { FinanceProductsPageClient } from './FinanceProductsPageClient'

export async function FinanceProductsPage() {
  const response = await getFinanceProductCatalog()
  return (
    <FinanceProductsPageClient
      initial={response.success ? response.data : null}
      initialError={response.success ? null : response.error}
    />
  )
}

export default FinanceProductsPage
