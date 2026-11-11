import { notFound } from 'next/navigation'
import { getAccountingBatch } from '../actions'
import { getDealershipTimeZone } from '../../lib/dealershipTimeZone'
import { AccountingBatchPageClient } from './AccountingBatchPageClient'

export async function AccountingBatchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [response, timeZone] = await Promise.all([getAccountingBatch(id), getDealershipTimeZone()])
  // An unreadable or missing record is a 404, never a 200 or a 500.
  if (!response.success || !response.data.batch) notFound()

  return (
    <AccountingBatchPageClient
      id={id}
      timeZone={timeZone}
      initialBatch={response.success ? response.data.batch : null}
      initialResponses={response.success ? response.data.responses : []}
      initialSource={response.success ? response.data.source : null}
      initialError={null}
    />
  )
}

export default AccountingBatchPage
