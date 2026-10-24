import { getAccountingBatches, getAccountingMappings } from '../actions'
import { getDealershipTimeZone } from '../../lib/dealershipTimeZone'
import { AccountingPageClient } from './AccountingPageClient'

export async function AccountingPage() {
  const [batches, mappings, timeZone] = await Promise.all([
    getAccountingBatches({ status: 'all', search: '', sourceType: 'all' }),
    getAccountingMappings(),
    getDealershipTimeZone(),
  ])

  return (
    <AccountingPageClient
      timeZone={timeZone}
      initialBatches={batches.success ? batches.data.batches : []}
      initialCounts={batches.success ? batches.data.counts : null}
      initialBatchError={batches.success ? null : batches.error}
      initialMappings={mappings.success ? mappings.data.accountingMappings || [] : []}
      rooftops={mappings.success ? mappings.data.rooftops || [] : []}
      initialMappingError={mappings.success ? null : mappings.error}
    />
  )
}

export default AccountingPage
