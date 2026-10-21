'use client'

import { useState } from 'react'
import { getDealTimeline, type DomainTimelineEntry } from '../actions'

export function FinanceEvidenceHistory({ dealId, aggregateType, label }: {
  dealId: string
  aggregateType: 'Deal' | 'FinanceFundingCase' | 'DeliveryCase'
  label: string
}) {
  const [entries, setEntries] = useState<DomainTimelineEntry[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const load = async () => {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      const result = await getDealTimeline(aggregateType, dealId)
      if (!result.success || !result.data) throw new Error(result.error || 'Request failed')
      setEntries(result.data.domainTimeline)
    } catch (error) {
      setError(`History is unavailable: ${error instanceof Error ? error.message : 'Request failed'}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <details
      className="mt-2 text-sm"
      onToggle={event => {
        if (event.currentTarget.open && entries === null && !busy) void load()
      }}
    >
      <summary>{label} · latest 20 events</summary>
      <button type="button" className="mt-2 underline" disabled={busy} onClick={() => void load()}>
        {busy ? 'Loading…' : 'Refresh history'}
      </button>
      {error && (
        <p role="status" className="mt-2 text-amber-700">
          {error}
        </p>
      )}
      {entries?.length === 0 && <p className="mt-2">No history yet.</p>}
      {entries?.map(entry => (
        <details key={entry.id} className="mt-2 rounded border p-2">
          <summary>
            {entry.action} · {new Date(entry.occurredAt).toLocaleString()} · {entry.actor?.name || 'Unknown'}
          </summary>
          <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-all text-xs">
            {JSON.stringify(entry.afterSnapshot, null, 2)}
          </pre>
        </details>
      ))}
    </details>
  )
}
