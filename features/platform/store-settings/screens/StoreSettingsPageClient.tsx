'use client'

import { useState, type ReactNode } from 'react'
import * as RadioGroupPrimitive from '@radix-ui/react-radio-group'
import { RadioGroup } from '@/components/ui/radio-group'
import { sanitizeStoreLogoSvg } from '@/features/lib/sanitize-store-logo'
import { StoreLogo } from '../components/StoreLogo'
import { LogoPicker } from '../components/LogoPicker'
import { AlertCircle, Building2, Globe2, MapPin, Palette, Save } from 'lucide-react'
import { toast } from 'sonner'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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

function Section({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }) {
  return (
    <section className="overflow-hidden rounded-lg border bg-card">
      <div className="flex items-center gap-2 border-b bg-muted/25 px-5 py-3">
        <span className="text-muted-foreground">{icon}</span>
        <h2 className="text-sm font-semibold">{title}</h2>
      </div>
      <div className="space-y-5 p-5">{children}</div>
    </section>
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
    <div className="space-y-2">
      <Label htmlFor={id}>{label}{required ? ' *' : ''}</Label>
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

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 md:px-6">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <h1 className="text-2xl font-semibold tracking-tight">Store Settings</h1>
          <Button onClick={save} disabled={isSaving || Boolean(initialError) || invalidMark}>
            <Save className="mr-2 size-4" />
            {isSaving ? 'Saving…' : 'Save settings'}
          </Button>
        </header>

        {!initialSettings && !initialError ? (
          <Alert>
            <AlertCircle className="size-4" />
            <AlertTitle>Add your dealership details</AlertTitle>
            <AlertDescription>
              Enter a dealership name and short name to publish your storefront.
            </AlertDescription>
          </Alert>
        ) : null}

        {error ? (
          <Alert variant="destructive">
            <AlertCircle className="size-4" />
            <AlertTitle>Settings were not saved</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        <div className="grid gap-6 xl:grid-cols-2 xl:items-start">
          <div className="space-y-6">
            <Section title="Business identity" icon={<Building2 className="size-4" />}>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Dealership name" value={form.name} onChange={value => update('name', value)} required />
                <Field label="Short name" value={form.shortName} onChange={value => update('shortName', value)} required />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Sales email" type="email" value={form.salesEmail} onChange={value => update('salesEmail', value)} />
                <Field label="Service email" type="email" value={form.serviceEmail} onChange={value => update('serviceEmail', value)} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Phone" type="tel" value={form.phone} onChange={value => update('phone', value)} />
                <Field label="Website URL" type="url" value={form.websiteUrl} onChange={value => update('websiteUrl', value)} placeholder="https://example.com" />
              </div>
            </Section>

            <Section title="Location and hours" icon={<MapPin className="size-4" />}>
              <Field label="Address line 1" value={form.addressLine1} onChange={value => update('addressLine1', value)} />
              <Field label="Address line 2" value={form.addressLine2} onChange={value => update('addressLine2', value)} />
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="City" value={form.city} onChange={value => update('city', value)} />
                <Field label="State" value={form.state} onChange={value => update('state', value)} />
                <Field label="Postal code" value={form.postalCode} onChange={value => update('postalCode', value)} />
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="Monday–Friday" value={form.hoursMonFri} onChange={value => update('hoursMonFri', value)} />
                <Field label="Saturday" value={form.hoursSaturday} onChange={value => update('hoursSaturday', value)} />
                <Field label="Sunday" value={form.hoursSunday} onChange={value => update('hoursSunday', value)} />
              </div>
            </Section>
          </div>

          <div className="space-y-6">
            <Section title="Homepage" icon={<Globe2 className="size-4" />}>
              <Field label="Homepage title" value={form.homepageTitle} onChange={value => update('homepageTitle', value)} placeholder="Inventory and service" />
              <div className="space-y-2">
                <Label htmlFor="store-settings-homepage-description">Description</Label>
                <Textarea
                  id="store-settings-homepage-description"
                  value={form.homepageDescription}
                  onChange={event => update('homepageDescription', event.target.value)}
                  maxLength={1000}
                />
              </div>
              <Field label="Currency code" value={form.currencyCode} onChange={value => update('currencyCode', value.toUpperCase())} required />
            </Section>

            <Section title="Branding" icon={<Palette className="size-4" />}>
              <div className="space-y-3">
                <Label>Logo color</Label>
                <RadioGroup value={form.logoColor} onValueChange={value => update('logoColor', value)} className="grid-cols-3 gap-2 rounded-3xl bg-muted p-1" aria-label="Logo color">
                  {HUE_PRESETS.map(preset => {
                    const value = String(preset.value)
                    const selected = form.logoColor === value
                    return (
                      <RadioGroupPrimitive.Item
                        key={preset.value}
                        value={value}
                        aria-label={preset.name}
                        className={`flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-full px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring ${selected ? 'bg-background shadow-sm' : 'text-muted-foreground'}`}
                      >
                        <span aria-hidden="true" className="size-5 shrink-0 rounded-full" style={{ background: '#155eef', filter: `hue-rotate(${preset.value}deg)` }} />
                        <span>{preset.name}</span>
                      </RadioGroupPrimitive.Item>
                    )
                  })}
                </RadioGroup>
              </div>

              <div className="space-y-2">
                <LogoPicker value={form.logoIcon} hue={form.logoColor} onChange={value => update('logoIcon', value)} />
              </div>

              {safePreviewMark ? (
                <div aria-label="Logo" className="flex items-center gap-3 rounded-md border bg-background p-3">
                  <StoreLogo svg={safePreviewMark} color={form.logoColor} className="size-10" />
                </div>
              ) : invalidMark ? <p role="alert" className="text-sm text-destructive">Invalid or unsupported SVG.</p> : null}
            </Section>
          </div>
        </div>
      </div>
    </div>
  )
}
