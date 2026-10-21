import { permissions } from '../access'

export async function accountingWorkspace(_root: unknown, { limit = 50 }: { limit?: number }, context: any) {
  if (!context.session?.itemId || !permissions.canViewReports({ session: context.session })) throw new Error('Reporting permission is required')
  const take = Math.min(Math.max(Number(limit) || 50, 1), 100)
  const [mappings, batches, payments, refunds] = await Promise.all([
    context.db.AccountingMapping.findMany({ orderBy: [{ updatedAt: 'desc' }], take }),
    context.db.AccountingBatch.findMany({ orderBy: [{ updatedAt: 'desc' }], take }),
    context.db.PaymentTransaction.findMany({ orderBy: [{ updatedAt: 'desc' }], take }),
    context.db.PaymentRefund.findMany({ orderBy: [{ updatedAt: 'desc' }], take }),
  ])
  return { mappings, batches, payments, refunds }
}
