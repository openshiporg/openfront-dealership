import { getFinanceWorkspace } from '../actions'
import { FinanceDeskPageClient } from './FinanceDeskPageClient'
import { getDealershipTimeZone } from '../../lib/dealershipTimeZone'

export async function FinanceDeskPage() {
  const [response, timeZone] = await Promise.all([getFinanceWorkspace(), getDealershipTimeZone()])

  return (
    <FinanceDeskPageClient
      initialWorkspace={response.success ? response.data.financeWorkspace : null}
      initialError={response.success ? null : response.error}
      timeZone={timeZone}
    />
  )
}

export default FinanceDeskPage
