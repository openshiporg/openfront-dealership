import { getAccountingWorkspace, getInstalledPaymentProviders } from '../actions'
import { AccountingWorkspacePageClient } from './AccountingWorkspacePageClient'

export async function AccountingWorkspacePage() {
  const [response, providersResponse] = await Promise.all([getAccountingWorkspace(), getInstalledPaymentProviders()])

  return (
    <AccountingWorkspacePageClient
      initialWorkspace={response.success ? response.data.accountingWorkspace : null}
      initialError={response.success ? null : response.error}
      paymentProviders={providersResponse.success ? providersResponse.data.paymentProviders || [] : []}
    />
  )
}

export default AccountingWorkspacePage
