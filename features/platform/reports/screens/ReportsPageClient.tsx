'use client'

import { useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { PageContainer } from '@/features/dashboard/components/PageContainer'
import { basePath } from '@/features/dashboard/lib/config'
import { DeskHeader, Pill, Segmented, Track } from '@/features/platform/components/desk'
import { TAP } from '@/features/platform/catalog/components/formKit'
import { type ReportsData, getReportsData } from '../actions'
import { AuditPanel } from '../components/AuditPanel'
import { OutboxPanel } from '../components/OutboxPanel'
import { RunsPanel } from '../components/RunsPanel'
import { SavedReportsPanel } from '../components/SavedReportsPanel'
import { effectiveRunStatus } from '../lib/reportOptions'

export type ReportsTab = 'saved' | 'runs' | 'audit' | 'outbox'

export function ReportsPageClient({ initialData, initialTab, timeZone }: { initialData: ReportsData; initialTab: ReportsTab; timeZone: string }) {
  const [data, setData] = useState(initialData)
  const [tab, setTab] = useState<ReportsTab>(initialTab)
  const [runReportFilter, setRunReportFilter] = useState('all')
  const [loading, setLoading] = useState(false)

  const reload = async () => {
    setLoading(true)
    try { setData(await getReportsData()) } finally { setLoading(false) }
  }

  const changeTab = (next: ReportsTab) => {
    setTab(next)
    const url = new URL(window.location.href)
    url.searchParams.set('tab', next)
    window.history.replaceState(null, '', url)
  }

  const activeReports = data.savedReports.data.filter(report => report.active).length
  const queuedRuns = data.runs.data.filter(run => effectiveRunStatus(run) === 'queued').length
  const failedRuns = data.runs.data.filter(run => effectiveRunStatus(run) === 'failed').length
  const error = data.savedReports.error || data.runs.error

  const header = (
    <DeskHeader
      title="Reports"
      tone={error ? 'bad' : failedRuns ? 'bad' : queuedRuns ? 'info' : 'idle'}
      status={error ? 'Unavailable' : failedRuns ? `${failedRuns} failed runs` : queuedRuns ? `${queuedRuns} queued` : 'Up to date'}
      meta={`${activeReports} active saved reports · ${data.runs.data.length} runs · ${queuedRuns} queued`}
      actions={
        <Track>
          <Pill className={TAP} onClick={reload} disabled={loading}>
            <RefreshCw className={loading ? 'animate-spin' : undefined} />
            Refresh
          </Pill>
        </Track>
      }
    />
  )

  return (
    <PageContainer
      title="Reports"
      header={header}
      breadcrumbs={[
        { type: 'link', label: 'Dashboard', href: basePath },
        { type: 'page', label: 'Platform' },
        { type: 'page', label: 'Reports' },
      ]}
    >
      <div className="min-w-0 max-w-full space-y-4 px-4 pb-24 md:px-6">
        <Segmented<ReportsTab>
          label="Reports section"
          value={tab}
          onChange={changeTab}
          options={[
            { value: 'saved', label: 'Saved reports', count: data.savedReports.data.length },
            { value: 'runs', label: 'Runs', count: data.runs.data.length, tone: failedRuns ? 'bad' : queuedRuns ? 'info' : undefined },
            { value: 'audit', label: 'Audit' },
            { value: 'outbox', label: 'Outbox' },
          ]}
        />
        {tab === 'saved' && (
          <SavedReportsPanel
            reports={data.savedReports.data}
            runs={data.runs.data}
            rooftops={data.rooftops}
            error={data.savedReports.error}
            timeZone={timeZone}
            onReload={reload}
            onShowRuns={reportId => { setRunReportFilter(reportId); changeTab('runs') }}
          />
        )}
        {tab === 'runs' && (
          <RunsPanel
            runs={data.runs.data}
            reports={data.savedReports.data}
            error={data.runs.error}
            timeZone={timeZone}
            reportFilter={runReportFilter}
            onReportFilterChange={setRunReportFilter}
            onReload={reload}
          />
        )}
        {tab === 'audit' && <AuditPanel rooftops={data.rooftops} timeZone={timeZone} />}
        {tab === 'outbox' && <OutboxPanel timeZone={timeZone} />}
      </div>
    </PageContainer>
  )
}
