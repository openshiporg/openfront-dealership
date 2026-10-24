'use server'

import { revalidatePath } from 'next/cache'

import { keystoneClient } from '@/features/dashboard/lib/keystoneClient'
import { inventoryCommandRequest } from '../lib/inventoryCommandClient'

export type FeedRunError = {
  id: string
  errorCode: string
  message: string
  rowReference: string | null
  stock: { id: string; stockNumber: string; vehicle: { id: string; year: number; make: string; model: string } | null } | null
}

export type FeedRun = {
  id: string
  channelKey: string
  status: string
  attemptedCount: number
  succeededCount: number
  failedCount: number
  startedAt: string
  completedAt: string
  recordedBy: { name: string | null } | null
  errors: FeedRunError[]
}

export type FeedHistoryResult =
  | { success: true; runs: FeedRun[]; counts: Record<string, number> }
  | { success: false; error: string }

export async function getFeedHistory(status: string, channelKey: string): Promise<FeedHistoryResult> {
  const filters: Record<string, unknown>[] = []
  if (status && status !== 'all') filters.push({ status: { equals: status } })
  if (channelKey && channelKey !== 'all') filters.push({ channelKey: { equals: channelKey } })
  const response = await keystoneClient<Record<string, any>>(`
    query InventoryFeedHistory($where: InventoryFeedRunWhereInput!) {
      inventoryFeedRuns(where: $where, orderBy: { completedAt: desc }, take: 100) {
        id channelKey status attemptedCount succeededCount failedCount startedAt completedAt
        recordedBy { name }
        errors(take: 200) { id errorCode message rowReference stock { id stockNumber vehicle { id year make model } } }
      }
      all: inventoryFeedRunsCount
      succeeded: inventoryFeedRunsCount(where: { status: { equals: "succeeded" } })
      partial: inventoryFeedRunsCount(where: { status: { equals: "partial" } })
      failed: inventoryFeedRunsCount(where: { status: { equals: "failed" } })
    }
  `, { where: filters.length ? { AND: filters } : {} }, { cache: 'no-store' })
  if (!response.success) return { success: false, error: response.error }
  return {
    success: true,
    runs: (response.data.inventoryFeedRuns || []).map((run: any) => ({ ...run, errors: run.errors || [] })),
    counts: { all: response.data.all || 0, succeeded: response.data.succeeded || 0, partial: response.data.partial || 0, failed: response.data.failed || 0 },
  }
}

/** Records an operator-run marketplace export: which units went out and which the marketplace refused. */
export async function recordMarketplaceExport(data: {
  stockIds: string[]
  errors: Array<{ stockId: string; errorCode: string; message: string; rowReference?: string }>
  idempotencyKey: string
}) {
  const response = await inventoryCommandRequest<{ recordInventoryFeedRun: { id: string; status: string; attemptedCount: number; failedCount: number; reused: boolean } }>(`
    mutation RecordMarketplaceExport($data: RecordInventoryFeedRunInput!) {
      recordInventoryFeedRun(data: $data) { id status attemptedCount failedCount reused }
    }
  `, { data: { channelKey: 'manual-marketplace-export', ...data } })
  if (response.success) {
    revalidatePath('/dashboard/platform/vehicles/feed')
    revalidatePath('/dashboard/platform/vehicles')
  }
  return response
}
