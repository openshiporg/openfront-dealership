'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { type MoneyLine } from '@/features/keystone/lifecycle/dealPricing'

export function WorksheetLines({ title, category, lines, onChange, disabled }: {
  title: string
  category: string
  lines: MoneyLine[]
  onChange: (lines: MoneyLine[]) => void
  disabled?: boolean
}) {
  const update = (index: number, patch: Partial<MoneyLine>) => onChange(lines.map((line, position) => position === index ? { ...line, ...patch } : line))
  return (
    <fieldset disabled={disabled} className="space-y-3 rounded-lg border p-3">
      <legend className="px-1 text-sm font-medium">{title}</legend>
      {lines.length === 0 && <p className="text-sm text-muted-foreground">No {title.toLowerCase()} recorded.</p>}
      {lines.map((line, index) => (
        <div key={`${category}-${index}`} className="grid gap-3 rounded-md bg-muted/30 p-3 sm:grid-cols-[1fr_1.5fr_1fr_auto]">
          <div className="space-y-1"><Label htmlFor={`${category}-${index}-code`}>Code</Label><Input id={`${category}-${index}-code`} value={line.code || `legacy-${index + 1}`} maxLength={80} onChange={event => update(index, { code: event.target.value })} /></div>
          <div className="space-y-1"><Label htmlFor={`${category}-${index}-name`}>Description</Label><Input id={`${category}-${index}-name`} value={line.name || ''} maxLength={160} onChange={event => update(index, { name: event.target.value })} /></div>
          <div className="space-y-1"><Label htmlFor={`${category}-${index}-amount`}>Amount (USD)</Label><Input id={`${category}-${index}-amount`} type="number" min="0" step="0.01" value={Number(line.amountCents ?? Math.round(Number(line.amount || 0) * 100)) / 100} onChange={event => update(index, { amountCents: Math.round(Number(event.target.value) * 100) })} /></div>
          <Button type="button" variant="outline" className="self-end" aria-label={`Remove ${line.name || title} line ${index + 1}`} onClick={() => onChange(lines.filter((_, position) => position !== index))}>Remove</Button>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" disabled={disabled || lines.length >= 50} onClick={() => onChange([...lines, { code: `${category}-${crypto.randomUUID().slice(0, 8)}`, name: '', amountCents: 0, source: 'operator-recorded' }])}>Add {category} line</Button>
    </fieldset>
  )
}
