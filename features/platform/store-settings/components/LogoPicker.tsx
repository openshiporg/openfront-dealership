'use client'

import { useMemo, useState } from 'react'
import { CheckCircle2, Code2, X } from 'lucide-react'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { sanitizeStoreLogoSvg } from '@/features/lib/sanitize-store-logo'
import { LOGO_ICONS } from '@/features/platform/store-settings/lib/icon-registry'
import { Pill } from '@/features/platform/components/desk'

interface LogoPickerProps {
  value: string
  hue: string
  onChange: (svg: string) => void
  /** Controlled custom-SVG editor state. When given, the editor is rendered by the caller via <CustomSvgEditor>. */
  editing?: boolean
  onEditingChange?: (editing: boolean) => void
}

const triggerClassName = 'mt-1.5 h-10 w-full justify-between rounded-[4px] bg-card px-3 text-sm font-medium [&>svg]:size-3.5 [&>svg]:opacity-40'

export function LogoPicker({ value, hue, onChange, editing, onEditingChange }: LogoPickerProps) {
  const selectedIcon = useMemo(
    () => LOGO_ICONS.find((icon) => icon.lightSvg === value),
    [value]
  )
  const controlled = editing !== undefined
  const [localEditing, setLocalEditing] = useState(!selectedIcon)
  const isEditingCustom = controlled ? editing : localEditing
  const setEditing = (next: boolean) => {
    if (controlled) onEditingChange?.(next)
    else setLocalEditing(next)
  }

  const selectLogo = (id: string) => {
    if (id === 'custom') {
      setEditing(true)
      return
    }
    const icon = LOGO_ICONS.find((candidate) => candidate.id === id)
    if (!icon) return
    onChange(icon.lightSvg)
    setEditing(false)
  }

  return (
    <div className="min-w-0">
      <p className="text-[12px] font-medium text-muted-foreground">Logo</p>
      <Select value={selectedIcon?.id || 'custom'} onValueChange={selectLogo}>
        <SelectTrigger className={triggerClassName} aria-label="Choose a logo">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="max-h-[min(420px,var(--radix-select-content-available-height))] min-w-[280px]">
          <SelectItem value="custom">
            <span className="flex items-center gap-3">
              <span className="flex size-7 items-center justify-center rounded-[4px] border border-dashed border-border bg-muted/30">
                <Code2 className="size-3.5 text-muted-foreground" />
              </span>
              <span className="font-medium">Custom SVG</span>
            </span>
          </SelectItem>
          {LOGO_ICONS.map((icon) => (
            <SelectItem key={icon.id} value={icon.id}>
              <span className="flex items-center gap-3">
                <span
                  className="flex size-7 items-center justify-center overflow-hidden rounded-[4px] border border-border bg-background p-1 [&>svg]:block [&>svg]:size-full"
                  style={{ filter: `hue-rotate(${hue}deg)` }}
                  dangerouslySetInnerHTML={{ __html: icon.lightSvg }}
                  aria-hidden="true"
                />
                <span className="font-medium">{icon.name}</span>
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="mt-2 flex items-center gap-2">
        <Pill
          size="sm"
          variant={isEditingCustom ? undefined : 'plain'}
          className="max-sm:h-10"
          onClick={() => setEditing(!isEditingCustom)}
          aria-expanded={isEditingCustom}
          aria-controls={controlled ? 'store-settings-custom-svg' : undefined}
        >
          <Code2 />
          {selectedIcon ? 'Edit SVG' : 'Custom SVG'}
        </Pill>
        {!selectedIcon ? (
          <span className="inline-flex items-center gap-1 text-[12px] text-emerald-700 dark:text-emerald-300">
            <CheckCircle2 className="size-3" /> Custom
          </span>
        ) : null}
      </div>

      {!controlled && isEditingCustom ? (
        <CustomSvgEditor value={value} hue={hue} onChange={onChange} onClose={() => setEditing(false)} />
      ) : null}
    </div>
  )
}

/** Custom SVG editor: paste, preview, apply. Sanitised before it can be applied. */
export function CustomSvgEditor({
  value,
  hue,
  onChange,
  onClose,
}: {
  value: string
  hue: string
  onChange: (svg: string) => void
  onClose: () => void
}) {
  const [draft, setDraft] = useState(value)
  const safeDraft = useMemo(() => sanitizeStoreLogoSvg(draft), [draft])
  const hasValidDraft = safeDraft.length > 0
  const hasDraftChanges = safeDraft !== value

  return (
    <div id="store-settings-custom-svg" className="mt-3 rounded-md border bg-card p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[13px] font-medium text-foreground">Custom SVG</p>
          <p className="mt-0.5 text-[12px] leading-4 text-muted-foreground">
            No scripts, links, styles, event handlers or external assets.
          </p>
        </div>
        <Pill size="sm" variant="plain" className="shrink-0 px-1.5 max-sm:size-10" onClick={onClose} aria-label="Close custom SVG editor">
          <X />
        </Pill>
      </div>

      <Textarea
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        className="mt-3 min-h-32 resize-y rounded-[4px] font-mono text-[12px] leading-4"
        placeholder='<svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">…</svg>'
        spellCheck={false}
        aria-label="Custom SVG markup"
        aria-invalid={draft.length > 0 && !hasValidDraft}
      />

      <div className="mt-3 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span
            className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-[4px] border border-border bg-background p-1.5 [&>svg]:block [&>svg]:size-full"
            style={{ filter: `hue-rotate(${hue}deg)` }}
            dangerouslySetInnerHTML={{ __html: safeDraft }}
            aria-hidden="true"
          />
          <span className={`truncate text-[12px] ${hasValidDraft ? 'text-muted-foreground' : 'text-destructive'}`}>
            {hasValidDraft ? 'Preview' : 'Invalid SVG'}
          </span>
        </div>
        <Pill
          size="sm"
          variant="primary"
          className="shrink-0 max-sm:h-10"
          disabled={!hasValidDraft || !hasDraftChanges}
          onClick={() => {
            onChange(safeDraft)
            onClose()
          }}
        >
          Apply SVG
        </Pill>
      </div>
    </div>
  )
}
