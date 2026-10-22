'use client'

import { useState, type ReactNode } from 'react'
import * as RadioGroupPrimitive from '@radix-ui/react-radio-group'
import { RadioGroup } from '@/components/ui/radio-group'
import { sanitizeStoreLogoSvg } from '@/features/lib/sanitize-store-logo'
import { StoreLogo } from '../components/StoreLogo'
import { LogoPicker } from '../components/LogoPicker'
import { Save } from 'lucide-react'
import { toast } from 'sonner'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { DeskHeader, DeskSection, Notice, Pill, Track } from '@/features/platform/components/desk'
import { Textarea } from '@/components/ui/textarea'
import {
  type DealershipStoreSettings,
  saveDealershipStoreSettings,
} from '../actions'
import { DEFAULT_STORE_LOGO_COLOR, normalizeStoreLogoColor } from '@/features/lib/store-logo'
import { HUE_PRESETS, LOGO_ICONS } from '../lib/icon-registry'

const EMPTY_SETTINGS: DealershipStoreSettings = {
  name: '',
  shortName: '',
  salesEmail: '',
  serviceEmail: '',
  phone: '',
  addressLine1: '',
  addressLine2: '',
  city: '',
  state: '',
  postalCode: '',
  hoursMonFri: '',
  hoursSaturday: '',
  hoursSunday: '',
  websiteUrl: '',
  currencyCode: 'USD',
  homepageTitle: '',
  homepageDescription: '',
  logoIcon: LOGO_ICONS[0].lightSvg,
  logoColor: DEFAULT_STORE_LOGO_COLOR,
}

const labelClass = 'font-mono text-[11px] font-medium uppercase tracking-[0.1em] text-muted-foreground'

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <DeskSection title={title}>
      <div className="space-y-4">{children}</div>
    </DeskSection>
  )
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
  required = false,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  type?: string
  required?: boolean
}) {
  const id = `store-settings-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`
  return (
    <div className="min-w-0 space-y-1.5">
      <Label htmlFor={id} className={labelClass}>{label}{required ? ' *' : ''}</Label>
      <Input
        id={id}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        required={required}
      />
    </div>
  )
}

export function StoreSettingsPageClient({
  initialSettings,
  initialError,
}: {
  initialSettings: DealershipStoreSettings | null
  initialError: string | null
}) {
  const [form, setForm] = useState<DealershipStoreSettings>({
    ...EMPTY_SETTINGS,
    ...initialSettings,
    logoIcon: initialSettings?.logoIcon || EMPTY_SETTINGS.logoIcon,
    logoColor: normalizeStoreLogoColor(initialSettings?.logoColor),
  })
  const safePreviewMark = sanitizeStoreLogoSvg(form.logoIcon)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(initialError)

  const update = (key: keyof DealershipStoreSettings, value: string) => {
    setForm(current => ({ ...current, [key]: value }))
  }

  const save = async () => {
    if (initialError || invalidMark) return
    setIsSaving(true)
    setError(null)
    const result = await saveDealershipStoreSettings(form)
    if (result.success && result.data) {
      setForm(result.data)
      toast.success('Store settings saved')
    } else if (!result.success) {
      setError(result.error)
      toast.error(result.error)
    }
    setIsSaving(false)
  }

  const invalidMark = Boolean(form.logoIcon.trim()) && !safePreviewMark

  const saveButton = (
    <Track>
      <Pill variant="primary" onClick={save} disabled={isSaving || Boolean(initialError) || invalidMark}>
        <Save />
        {isSaving ? 'Saving…' : 'Save settings'}
      </Pill>
    </Track>
  )

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto min-w-0 max-w-6xl space-y-8 px-4 py-6 md:px-6">
        <DeskHeader
          title="Store settings"
          tone={initialError ? 'bad' : !initialSettings ? 'warn' : 'ok'}
          status={initialError ? 'Unavailable' : !initialSettings ? 'Not set up' : 'Set up'}
          meta={[form.name || null, form.currencyCode || null].filter(Boolean).join(' · ') || undefined}
          actions={saveButton}
        />

        {!initialSettings && !initialError ? (
          <Notice tone="warn">Add a dealership name and short name to publish the storefront.</Notice>
        ) : null}

        {error ? (
          <Notice tone="bad">
            <p className="font-medium">Settings were not saved</p>
            <p className="mt-0.5">{error}</p>
          </Notice>
        ) : null}

        <div className="grid gap-8 xl:grid-cols-2 xl:items-start">
          <div className="min-w-0 space-y-8">
            <Section title="Identity">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Dealership name" value={form.name} onChange={value => update('name', value)} required />
                <Field label="Short name" value={form.shortName} onChange={value => update('shortName', value)} required />
              </div>
              <div className="space-y-1.5">
                <p className={labelClass}>Logo color</p>
                <RadioGroup value={form.logoColor} onValueChange={value => update('logoColor', value)} className="grid grid-cols-2 gap-1 rounded-2xl bg-muted p-1 shadow-[inset_0_1px_2px_rgb(0_0_0/0.08)] min-[400px]:grid-cols-3 sm:grid-cols-4 dark:bg-black/30" aria-label="Logo color">
                  {HUE_PRESETS.map(preset => {
                    const value = String(preset.value)
                    const selected = form.logoColor === value
                    return (
                      <RadioGroupPrimitive.Item
                        key={preset.value}
                        value={value}
                        aria-label={preset.name}
                        className={`flex min-h-9 min-w-0 items-center gap-2 rounded-full px-3 py-1.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring ${selected ? 'bg-background font-medium text-foreground shadow-[0_1px_2px_rgb(0_0_0/0.12)] dark:bg-zinc-800' : 'text-muted-foreground hover:text-foreground'}`}
                      >
                        <span aria-hidden="true" className="size-4 shrink-0 rounded-full" style={{ background: '#155eef', filter: `hue-rotate(${preset.value}deg)` }} />
                        <span className="truncate">{preset.name}</span>
                      </RadioGroupPrimitive.Item>
                    )
                  })}
                </RadioGroup>
              </div>

              <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-start">
                <div className="min-w-0 flex-1">
                  <LogoPicker value={form.logoIcon} hue={form.logoColor} onChange={value => update('logoIcon', value)} />
                </div>
                {safePreviewMark ? (
                  <div aria-label="Logo" className="flex shrink-0 items-center gap-3 self-start rounded-xl border bg-card p-3">
                    <StoreLogo svg={safePreviewMark} color={form.logoColor} className="size-10" />
                    {(form.shortName || form.name) && <span className="text-sm font-semibold">{form.shortName || form.name}</span>}
                  </div>
                ) : null}
              </div>
              {invalidMark ? <Notice tone="bad">Invalid or unsupported SVG.</Notice> : null}
            </Section>

            <Section title="Contact">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Sales email" type="email" value={form.salesEmail} onChange={value => update('salesEmail', value)} />
                <Field label="Service email" type="email" value={form.serviceEmail} onChange={value => update('serviceEmail', value)} />
                <Field label="Phone" type="tel" value={form.phone} onChange={value => update('phone', value)} />
                <Field label="Website URL" type="url" value={form.websiteUrl} onChange={value => update('websiteUrl', value)} placeholder="https://example.com" />
              </div>
            </Section>

            <Section title="Location">
              <Field label="Address line 1" value={form.addressLine1} onChange={value => update('addressLine1', value)} />
              <Field label="Address line 2" value={form.addressLine2} onChange={value => update('addressLine2', value)} />
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="City" value={form.city} onChange={value => update('city', value)} />
                <Field label="State" value={form.state} onChange={value => update('state', value)} />
                <Field label="Postal code" value={form.postalCode} onChange={value => update('postalCode', value)} />
              </div>
            </Section>
          </div>

          <div className="min-w-0 space-y-8">
            <Section title="Hours">
              <div className="grid gap-4 sm:grid-cols-3 xl:grid-cols-1">
                <Field label="Monday–Friday" value={form.hoursMonFri} onChange={value => update('hoursMonFri', value)} />
                <Field label="Saturday" value={form.hoursSaturday} onChange={value => update('hoursSaturday', value)} />
                <Field label="Sunday" value={form.hoursSunday} onChange={value => update('hoursSunday', value)} />
              </div>
            </Section>

            <Section title="Storefront">
              <Field label="Homepage title" value={form.homepageTitle} onChange={value => update('homepageTitle', value)} placeholder="Inventory and service" />
              <div className="space-y-1.5">
                <Label htmlFor="store-settings-homepage-description" className={labelClass}>Description</Label>
                <Textarea
                  id="store-settings-homepage-description"
                  value={form.homepageDescription}
                  onChange={event => update('homepageDescription', event.target.value)}
                  maxLength={1000}
                />
              </div>
            </Section>

            <Section title="Currency">
              <div className="max-w-[12rem]">
                <Field label="Currency code" value={form.currencyCode} onChange={value => update('currencyCode', value.toUpperCase())} required />
              </div>
            </Section>
          </div>
        </div>

        <div className="flex justify-end border-t pt-4">{saveButton}</div>
      </div>
    </div>
  )
}
