'use client'

import { useMemo, useState } from 'react'
import { CalendarClock, Download, Eye, Play } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Code, Facts, Notice, Panel, Pill, Segmented, TitleLine, Track } from '@/features/platform/components/desk'
import { EmptyRow, TAP, TAP_INPUT, TAP_SM } from '@/features/platform/catalog/components/formKit'
import { type ReportRun, type SavedReport, getReportRunResult, queueDueReports, runReport } from '../actions'
import { downloadReportRun } from '../lib/downloadRun'
import { RUN_STATE, type RunStatus, effectiveRunStatus, reportTypeLabel } from '../lib/reportOptions'
import { formatDateTime } from '../lib/time'

type StatusFilter = RunStatus | 'all'
const PREVIEW_LIMIT = 6000

export function RunsPanel({
  runs,
  reports,
  error,
  timeZone,
  reportFilter,
  onReportFilterChange,
  onReload,
}: {
  runs: ReportRun[]
  reports: SavedReport[]
  error: string | null
  timeZone: string
  reportFilter: string
  onReportFilterChange: (value: string) => void
  onReload: () => Promise<void>
}) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [workingId, setWorkingId] = useState<string | null>(null)
  const [bulk, setBulk] = useState<'queue' | 'process' | null>(null)
  const [notice, setNotice] = useState<{ tone: 'ok' | 'bad' | 'warn'; text: string } | null>(null)
  const [viewing, setViewing] = useState<ReportRun | null>(null)
  const [preview, setPreview] = useState<{ text: string; truncated: boolean } | null>(null)
  const [previewError, setPreviewError] = useState<string | null>(null)

  const scoped = useMemo(() => runs.filter(run => reportFilter === 'all' || run.savedReport?.id === reportFilter), [runs, reportFilter])
  const counts = useMemo(() => {
    const result: Record<StatusFilter, number> = { all: scoped.length, queued: 0, completed: 0, failed: 0, expired: 0 }
    for (const run of scoped) result[effectiveRunStatus(run)] += 1
    return result
  }, [scoped])
  const visible = scoped.filter(run => statusFilter === 'all' || effectiveRunStatus(run) === statusFilter)
  const queued = scoped.filter(run => effectiveRunStatus(run) === 'queued')

  const process = async (run: ReportRun) => {
    if (!run.savedReport) return false
    setWorkingId(run.id)
    const response = await runReport({ reportId: run.savedReport.id, runId: run.id, idempotencyKey: `desk-process:${run.id}` })
    setWorkingId(null)
    if (!response.success) { setNotice({ tone: 'bad', text: `${run.savedReport.name}: ${response.error}` }); return false }
    return true
  }

  const processOne = async (run: ReportRun) => {
    setNotice(null)
    if (await process(run)) { setNotice({ tone: 'ok', text: `${run.savedReport?.name} completed` }); await onReload() }
  }

  const processAll = async () => {
    setBulk('process'); setNotice(null)
    let done = 0
    for (const run of queued) { if (await process(run)) done += 1; else break }
    setBulk(null)
    if (done) setNotice(current => current?.tone === 'bad' ? { ...current, text: `${done} completed. ${current.text}` } : { tone: 'ok', text: `${done} queued ${done === 1 ? 'run' : 'runs'} completed` })
    await onReload()
  }

  const queueDue = async () => {
    setBulk('queue'); setNotice(null)
    const response = await queueDueReports()
    setBulk(null)
    if (!response.success) { setNotice({ tone: 'bad', text: response.error }); return }
    const count = response.data?.queuedCount || 0
    setNotice({ tone: count ? 'ok' : 'warn', text: count ? `${count} due ${count === 1 ? 'report' : 'reports'} queued` : 'No scheduled reports are due' })
    await onReload()
  }

  const download = async (run: ReportRun) => {
    const failure = await downloadReportRun(run.id)
    if (failure) setNotice({ tone: 'bad', text: failure })
  }

  const view = async (run: ReportRun) => {
    setViewing(run); setPreview(null); setPreviewError(null)
    if (effectiveRunStatus(run) !== 'completed' && effectiveRunStatus(run) !== 'expired') return
    const response = await getReportRunResult(run.id)
    if (!response.success || !response.data) { setPreviewError(response.success ? 'Run has no result' : response.error); return }
    const report = (response.data.snapshot as { report?: { content?: string } } | null)?.report
    const text = typeof report?.content === 'string' ? report.content : JSON.stringify(report ?? {}, null, 2)
    setPreview({ text: text.slice(0, PREVIEW_LIMIT), truncated: text.length > PREVIEW_LIMIT })
  }

  return (
    <div className="space-y-4">
      {error && <Notice tone="bad">{error}</Notice>}
      {notice && <Notice tone={notice.tone}>{notice.text}</Notice>}
      <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <Segmented<StatusFilter>
          label="Filter runs"
          value={statusFilter}
          onChange={setStatusFilter}
          size="sm"
          options={[
            { value: 'all', label: 'All', count: counts.all },
            { value: 'queued', label: 'Queued', count: counts.queued, tone: counts.queued ? 'info' : undefined },
            { value: 'completed', label: 'Completed', count: counts.completed },
            { value: 'expired', label: 'Expired', count: counts.expired },
            { value: 'failed', label: 'Failed', count: counts.failed, tone: counts.failed ? 'bad' : undefined },
          ]}
        />
        <Select value={reportFilter} onValueChange={onReportFilterChange}>
          <SelectTrigger className={`${TAP_INPUT} w-full sm:w-56`} aria-label="Saved report"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All reports</SelectItem>
            {reports.map(report => <SelectItem key={report.id} value={report.id}>{report.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Track className="sm:ml-auto">
          <Pill className={TAP} disabled={bulk !== null} onClick={queueDue}>
            <CalendarClock />
            {bulk === 'queue' ? 'Queueing…' : 'Queue due reports'}
          </Pill>
          <Pill variant="primary" className={TAP} disabled={bulk !== null || queued.length === 0} title={queued.length === 0 ? 'No queued runs' : undefined} onClick={processAll}>
            <Play />
            {bulk === 'process' ? 'Processing…' : `Process queued${queued.length ? ` (${queued.length})` : ''}`}
          </Pill>
        </Track>
      </div>

      <Panel className="overflow-hidden">
        {visible.length === 0 ? (
          <EmptyRow>{runs.length === 0 ? 'No report runs yet' : 'No runs match'}</EmptyRow>
        ) : (
          <ul className="divide-y">
            {visible.map(run => {
              const status = effectiveRunStatus(run)
              return (
                <li key={run.id} className="flex min-w-0 flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <TitleLine as="p" tone={RUN_STATE[status].tone} status={RUN_STATE[status].label} className="text-sm font-medium">
                      {run.savedReport?.name || 'Deleted report'}
                    </TitleLine>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {[RUN_STATE[status].label, run.savedReport ? reportTypeLabel(run.savedReport.reportType) : null, run.exportFormat.toUpperCase(), status === 'queued' ? `Queued ${formatDateTime(run.createdAt, timeZone)}` : `Completed ${formatDateTime(run.completedAt || run.createdAt, timeZone)}`, status === 'completed' && run.expiresAt ? `Expires ${formatDateTime(run.expiresAt, timeZone)}` : null].filter(Boolean).join(' · ')}
                    </p>
                    {run.errorCode && <p className="mt-0.5 text-xs text-red-600 dark:text-red-400">{run.errorCode}</p>}
                  </div>
                  <Track className="shrink-0 self-start sm:self-center">
                    {status === 'queued' && (
                      <Pill size="sm" variant="primary" className={TAP_SM} disabled={workingId !== null || bulk !== null} onClick={() => processOne(run)}>
                        <Play />
                        {workingId === run.id ? 'Processing…' : 'Process'}
                      </Pill>
                    )}
                    {status === 'completed' && (
                      <Pill size="sm" className={TAP_SM} onClick={() => download(run)}>
                        <Download />
                        Download
                      </Pill>
                    )}
                    <Pill size="sm" className={TAP_SM} aria-label="View run" onClick={() => view(run)}>
                      <Eye />
                    </Pill>
                  </Track>
                </li>
              )
            })}
          </ul>
        )}
      </Panel>

      <Sheet open={viewing !== null} onOpenChange={value => { if (!value) setViewing(null) }}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
          {viewing && (
            <>
              <SheetHeader>
                <SheetTitle>{viewing.savedReport?.name || 'Report run'}</SheetTitle>
                <SheetDescription>{RUN_STATE[effectiveRunStatus(viewing)].label}</SheetDescription>
              </SheetHeader>
              <div className="space-y-4 px-4 pb-24">
                <Facts
                  items={[
                    { label: 'Report type', value: viewing.savedReport ? reportTypeLabel(viewing.savedReport.reportType) : '-' },
                    { label: 'Format', value: viewing.exportFormat.toUpperCase() },
                    { label: 'Created', value: formatDateTime(viewing.createdAt, timeZone) },
                    { label: 'Completed', value: formatDateTime(viewing.completedAt, timeZone) },
                    { label: 'Expires', value: formatDateTime(viewing.expiresAt, timeZone) },
                    viewing.resultDigest ? { label: 'Digest', value: <Code>{viewing.resultDigest.slice(0, 16)}</Code> } : null,
                    viewing.errorCode ? { label: 'Error', value: viewing.errorCode } : null,
                  ]}
                />
                {effectiveRunStatus(viewing) === 'completed' && (
                  <Track>
                    <Pill size="sm" className={TAP_SM} onClick={() => download(viewing)}>
                      <Download />
                      Download
                    </Pill>
                  </Track>
                )}
                {previewError && <Notice tone="bad">{previewError}</Notice>}
                {preview && (
                  <div className="space-y-1">
                    <p className="font-mono text-[11px] font-medium uppercase tracking-[0.1em] text-muted-foreground">Result{preview.truncated ? ' (first 6,000 characters)' : ''}</p>
                    <pre className="max-h-[50dvh] overflow-auto whitespace-pre-wrap break-all rounded-lg bg-muted/50 p-3 font-mono text-[11px]">{preview.text}</pre>
                  </div>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}
