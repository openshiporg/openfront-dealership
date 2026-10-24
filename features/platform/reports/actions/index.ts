'use server'

import { revalidatePath } from 'next/cache'

import { keystoneClient } from '@/features/dashboard/lib/keystoneClient'
import { operatorCommandRequest } from '@/features/platform/lib/operatorCommandClient'

const REPORTS_PATH = '/dashboard/platform/reports'

export type ReportRooftop = { id: string; name: string }
export type SavedReport = {
  id: string
  name: string
  reportType: string
  filters: Record<string, string | number> | null
  exportFormat: string
  schedule: string
  active: boolean
  nextRunAt: string | null
  updatedAt: string
  createdAt: string
  owner: { id: string; name: string | null } | null
  rooftop: ReportRooftop | null
}
export type ReportRun = {
  id: string
  status: string
  exportFormat: string
  resultDigest: string | null
  errorCode: string | null
  completedAt: string | null
  expiresAt: string | null
  createdAt: string
  savedReport: { id: string; name: string; reportType: string } | null
}
export type AuditEvent = {
  id: string
  eventKey: string
  aggregateType: string
  aggregateId: string
  action: string
  beforeSnapshot: unknown
  afterSnapshot: unknown
  metadata: unknown
  occurredAt: string
  actor: { id: string; name: string | null; email: string | null } | null
  rooftop: ReportRooftop | null
}
export type OutboxEvent = {
  id: string
  deliveryKey: string
  topic: string
  aggregateType: string
  aggregateId: string
  status: string
  attemptCount: number
  availableAt: string
  processedAt: string | null
  lastError: string | null
  createdAt: string
}
export type OutboxCounts = { pending: number; processing: number; delivered: number; failed: number; oldestPending: string | null }

type Section<T> = { data: T; error: string | null }
export type ReportsData = {
  savedReports: Section<SavedReport[]>
  runs: Section<ReportRun[]>
  rooftops: ReportRooftop[]
}

const SAVED_REPORT_FIELDS = 'id name reportType filters exportFormat schedule active nextRunAt updatedAt createdAt owner { id name } rooftop { id name }'
const RUN_FIELDS = 'id status exportFormat resultDigest errorCode completedAt expiresAt createdAt savedReport { id name reportType }'

export async function getReportsData(): Promise<ReportsData> {
  const [saved, runs, rooftops] = await Promise.all([
    keystoneClient<{ savedReports: SavedReport[] | null }>(`query SavedReports { savedReports(orderBy: [{ name: asc }], take: 200) { ${SAVED_REPORT_FIELDS} } }`, {}, { cache: 'no-store' }),
    keystoneClient<{ reportRuns: ReportRun[] | null }>(`query ReportRuns { reportRuns(orderBy: [{ createdAt: desc }], take: 200) { ${RUN_FIELDS} } }`, {}, { cache: 'no-store' }),
    keystoneClient<{ rooftops: ReportRooftop[] | null }>(`query ReportRooftops { rooftops(orderBy: { name: asc }, take: 100) { id name } }`, {}, { cache: 'no-store' }),
  ])
  return {
    savedReports: saved.success ? { data: saved.data.savedReports || [], error: null } : { data: [], error: saved.error },
    runs: runs.success ? { data: runs.data.reportRuns || [], error: null } : { data: [], error: runs.error },
    rooftops: rooftops.success ? rooftops.data.rooftops || [] : [],
  }
}

type Result<T = undefined> = { success: true; data?: T } | { success: false; error: string }

export type SaveReportInput = {
  reportId?: string
  rooftopId: string
  name: string
  reportType: string
  exportFormat: string
  schedule: string
  filters: Record<string, string | number>
  active: boolean
  expectedUpdatedAt?: string
  idempotencyKey: string
}

export async function saveReport(input: SaveReportInput): Promise<Result> {
  const response = await operatorCommandRequest<{ saveOperationalReport: { id: string } }>(`
    mutation SaveOperationalReport($data: SaveOperationalReportInput!) {
      saveOperationalReport(data: $data) { id }
    }
  `, { data: { ...input, reportId: input.reportId || null, expectedUpdatedAt: input.expectedUpdatedAt || null } })
  if (!response.success) return { success: false, error: response.error }
  revalidatePath(REPORTS_PATH)
  return { success: true }
}

/** Runs a saved report now; with runId, computes that queued run in place. */
export async function runReport(input: { reportId: string; runId?: string; idempotencyKey: string }): Promise<Result<ReportRun>> {
  const response = await operatorCommandRequest<{ runSavedReport: ReportRun }>(`
    mutation RunSavedReport($data: RunSavedReportInput!) {
      runSavedReport(data: $data) { ${RUN_FIELDS} }
    }
  `, { data: { reportId: input.reportId, runId: input.runId || null, idempotencyKey: input.idempotencyKey } })
  if (!response.success) return { success: false, error: response.error }
  revalidatePath(REPORTS_PATH)
  return { success: true, data: response.data.runSavedReport }
}

export async function queueDueReports(): Promise<Result<{ queuedCount: number }>> {
  const response = await operatorCommandRequest<{ queueDueSavedReports: { queuedCount: number; runIds: string[] } }>(`
    mutation QueueDueSavedReports { queueDueSavedReports { queuedCount runIds } }
  `, {})
  if (!response.success) return { success: false, error: response.error }
  revalidatePath(REPORTS_PATH)
  return { success: true, data: { queuedCount: response.data.queueDueSavedReports.queuedCount } }
}

export async function getReportRunResult(id: string): Promise<Result<{ snapshot: unknown; exportFormat: string; name: string; completedAt: string | null }>> {
  const response = await keystoneClient<{ reportRun: { resultSnapshot: unknown; exportFormat: string; completedAt: string | null; savedReport: { name: string } | null } | null }>(`
    query ReportRunResult($id: ID!) { reportRun(where: { id: $id }) { resultSnapshot exportFormat completedAt savedReport { name } } }
  `, { id }, { cache: 'no-store' })
  if (!response.success) return { success: false, error: response.error }
  if (!response.data.reportRun) return { success: false, error: 'Run not found' }
  const run = response.data.reportRun
  return { success: true, data: { snapshot: run.resultSnapshot, exportFormat: run.exportFormat, name: run.savedReport?.name || 'report', completedAt: run.completedAt } }
}

export type AuditQuery = { aggregateType?: string; aggregateId?: string; action?: string; rooftopId?: string; since?: string; until?: string; limit?: number }

export async function searchAudit(query: AuditQuery): Promise<Result<AuditEvent[]>> {
  const response = await operatorCommandRequest<{ auditSearch: AuditEvent[] }>(`
    query AuditSearch($aggregateType: String, $aggregateId: ID, $action: String, $rooftopId: ID, $since: String, $until: String, $limit: Int) {
      auditSearch(aggregateType: $aggregateType, aggregateId: $aggregateId, action: $action, rooftopId: $rooftopId, since: $since, until: $until, limit: $limit) {
        id eventKey aggregateType aggregateId action beforeSnapshot afterSnapshot metadata occurredAt
        actor { id name email }
        rooftop { id name }
      }
    }
  `, {
    aggregateType: query.aggregateType?.trim() || null,
    aggregateId: query.aggregateId?.trim() || null,
    action: query.action?.trim() || null,
    rooftopId: query.rooftopId || null,
    since: query.since || null,
    until: query.until || null,
    limit: query.limit ?? 100,
  })
  if (!response.success) return { success: false, error: response.error }
  return { success: true, data: response.data.auditSearch || [] }
}

export async function getOutbox(status: string, topic: string): Promise<Result<{ events: OutboxEvent[]; counts: OutboxCounts }>> {
  const where: Record<string, unknown> = {}
  if (status !== 'all') where.status = { equals: status }
  if (topic.trim()) where.topic = { contains: topic.trim(), mode: 'insensitive' }
  const response = await keystoneClient<{
    events: OutboxEvent[] | null
    pending: number
    processing: number
    delivered: number
    failed: number
    oldest: Array<{ availableAt: string }> | null
  }>(`
    query OutboxHealth($where: DomainOutboxEventWhereInput!) {
      events: domainOutboxEvents(where: $where, orderBy: [{ availableAt: desc }], take: 200) {
        id deliveryKey topic aggregateType aggregateId status attemptCount availableAt processedAt lastError createdAt
      }
      pending: domainOutboxEventsCount(where: { status: { equals: "pending" } })
      processing: domainOutboxEventsCount(where: { status: { equals: "processing" } })
      delivered: domainOutboxEventsCount(where: { status: { equals: "delivered" } })
      failed: domainOutboxEventsCount(where: { status: { equals: "failed" } })
      oldest: domainOutboxEvents(where: { status: { equals: "pending" } }, orderBy: [{ availableAt: asc }], take: 1) { availableAt }
    }
  `, { where }, { cache: 'no-store' })
  if (!response.success) return { success: false, error: response.error }
  const data = response.data
  return {
    success: true,
    data: {
      events: data.events || [],
      counts: { pending: data.pending || 0, processing: data.processing || 0, delivered: data.delivered || 0, failed: data.failed || 0, oldestPending: data.oldest?.[0]?.availableAt || null },
    },
  }
}
