import { getFinanceWorkspace } from '../actions'
import { FinanceDeskPageClient } from './FinanceDeskPageClient'

export async function FinanceDeskPage() {
  const response = await getFinanceWorkspace()

  return (
    <FinanceDeskPageClient
      initialWorkspace={response.success ? response.data.financeWorkspace : null}
      initialError={response.success ? null : response.error}
    />
  )
}

export default FinanceDeskPage
