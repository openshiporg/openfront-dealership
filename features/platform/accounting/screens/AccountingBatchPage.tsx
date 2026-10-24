import { getAccountingBatch } from '../actions'
import { getDealershipTimeZone } from '../../lib/dealershipTimeZone'
import { AccountingBatchPageClient } from './AccountingBatchPageClient'

export async function AccountingBatchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [response, timeZone] = await Promise.all([getAccountingBatch(id), getDealershipTimeZone()])

  return (
    <AccountingBatchPageClient
      id={id}
      timeZone={timeZone}
      initialBatch={response.success ? response.data.batch : null}
      initialResponses={response.success ? response.data.responses : []}
      initialSource={response.success ? response.data.source : null}
      initialError={response.success ? null : response.error}
    />
  )
}

export default AccountingBatchPage
