import { getReportRunResult } from '../actions'

const slug = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'report'

/** Fetches a completed run's stored result and saves it in its export format. Returns an error message, or null. */
export async function downloadReportRun(runId: string): Promise<string | null> {
  const response = await getReportRunResult(runId)
  if (!response.success) return response.error
  const result = response.data
  if (!result) return 'Run has no result'
  const snapshot = (result.snapshot || {}) as { report?: unknown }
  const report = snapshot.report as { contentType?: string; content?: string } | undefined
  const isCsv = result.exportFormat === 'csv' && typeof report?.content === 'string'
  if (!report) return 'Run has no result'
  const body = isCsv ? (report.content as string) : JSON.stringify(report, null, 2)
  const blob = new Blob([body], { type: isCsv ? 'text/csv' : 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${slug(result.name)}-${(result.completedAt || new Date().toISOString()).slice(0, 10)}.${isCsv ? 'csv' : 'json'}`
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  return null
}
