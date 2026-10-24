'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Plus, RefreshCw, Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { PageContainer } from '@/features/dashboard/components/PageContainer'
import { basePath } from '@/features/dashboard/lib/config'
import { Code, DeskHeader, DeskSection, Notice, Panel, Pill, Readout, ReadoutStrip, Segmented, TitleLine, Track } from '@/features/platform/components/desk'
import { formatCentsForInput, parseDollarsToCents } from '@/features/platform/deals/lib/moneyInput'
import { getFinanceProductCatalog, saveFinanceProduct } from '../actions/catalog'
import { FinanceFormDialog, type FieldErrors, type FinanceFormField } from '../components/FinanceFormDialog'
import type { CatalogProduct, CatalogRooftop } from '../lib/catalogTypes'
import { PRODUCT_CATEGORIES, categoryLabels, formatCents, newIdempotencyKey } from '../lib/display'

type Catalog = { products: CatalogProduct[]; rooftops: CatalogRooftop[]; sessionRooftopId: string | null }
type Editor = { mode: 'create' | 'edit'; product?: CatalogProduct; values: Record<string, string>; idempotencyKey: string }

const CODE_PATTERN = /^[A-Z0-9][A-Z0-9_-]{1,79}$/

export function FinanceProductsPageClient({ initial, initialError }: { initial: Catalog | null; initialError: string | null }) {
  const router = useRouter()
  const [catalog, setCatalog] = useState<Catalog | null>(initial)
  const [error, setError] = useState<string | null>(initialError)
  const [loading, setLoading] = useState(false)
  const [rooftopId, setRooftopId] = useState<string>(initial?.sessionRooftopId || '')
  const [tab, setTab] = useState<'active' | 'inactive' | 'all'>('active')
  const [category, setCategory] = useState('all')
  const [search, setSearch] = useState('')
  const [editor, setEditor] = useState<Editor | null>(null)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [notice, setNotice] = useState<{ tone: 'ok' | 'bad'; text: string } | null>(null)

  const rooftops = catalog?.rooftops || []
  const rooftopName = (id: string) => rooftops.find(rooftop => rooftop.id === id)?.name || 'Rooftop'

  const reload = async () => {
    setLoading(true)
    const response = await getFinanceProductCatalog()
    if (response.success) {
      setCatalog(response.data)
      setError(null)
      if (!rooftopId) setRooftopId(response.data.sessionRooftopId || '')
    } else setError(response.error)
    setLoading(false)
    router.refresh()
  }

  const rooftopProducts = useMemo(() => (catalog?.products || []).filter(product => !rooftopId || product.rooftop?.id === rooftopId), [catalog, rooftopId])
  const counts = {
    active: rooftopProducts.filter(product => product.active).length,
    inactive: rooftopProducts.filter(product => !product.active).length,
    all: rooftopProducts.length,
  }
  const term = search.trim().toLowerCase()
  const visible = rooftopProducts
    .filter(product => tab === 'all' || (tab === 'active' ? product.active : !product.active))
    .filter(product => category === 'all' || product.category === category)
    .filter(product => !term || `${product.code} ${product.name}`.toLowerCase().includes(term))
  const activeProducts = rooftopProducts.filter(product => product.active)
  const costKnown = activeProducts.filter(product => product.costCents != null)
  const averageMargin = costKnown.length ? costKnown.reduce((sum, product) => sum + (product.retailPriceCents - (product.costCents || 0)), 0) / costKnown.length : null

  const openCreate = () => {
    setFieldErrors({}); setFormError(null)
    setEditor({ mode: 'create', idempotencyKey: newIdempotencyKey('finance-product'), values: { rooftopId: rooftopId || catalog?.sessionRooftopId || '', code: '', name: '', category: 'service-contract', retail: '', cost: '' } })
  }
  const openEdit = (product: CatalogProduct) => {
    setFieldErrors({}); setFormError(null)
    setEditor({
      mode: 'edit', product, idempotencyKey: newIdempotencyKey('finance-product'),
      values: { rooftopId: product.rooftop?.id || '', rooftopName: product.rooftop?.name || '', code: product.code, name: product.name, category: product.category, retail: formatCentsForInput(product.retailPriceCents), cost: product.costCents == null ? '' : formatCentsForInput(product.costCents), active: product.active ? 'yes' : '' },
    })
  }

  const submit = async () => {
    if (!editor) return
    const v = editor.values
    const errors: FieldErrors = {}
    const code = (v.code || '').trim().toUpperCase()
    if (!v.rooftopId) errors.rooftopId = 'Select a rooftop.'
    if (editor.mode === 'create') {
      if (!CODE_PATTERN.test(code)) errors.code = 'Use 2-80 letters, digits, dashes or underscores.'
      else if ((catalog?.products || []).some(product => product.rooftop?.id === v.rooftopId && product.code === code)) errors.code = 'This code already exists at this rooftop.'
    }
    if (!(v.name || '').trim()) errors.name = 'Enter a product name.'
    else if (v.name.trim().length > 200) errors.name = 'Use 200 characters or fewer.'
    if (!PRODUCT_CATEGORIES.includes(v.category as typeof PRODUCT_CATEGORIES[number])) errors.category = 'Select a category.'
    const retail = (v.retail || '').trim() ? parseDollarsToCents(v.retail) : null
    if (retail == null) errors.retail = 'Enter a dollar amount, for example 1,299.50.'
    const costHidden = editor.mode === 'edit' && editor.product?.costCents == null
    const cost = (v.cost || '').trim() ? parseDollarsToCents(v.cost) : null
    if (!(costHidden && !(v.cost || '').trim()) && cost == null) errors.cost = 'Enter a dollar amount, for example 899.'
    setFieldErrors(errors)
    if (Object.keys(errors).length) return
    setBusyId('editor'); setFormError(null)
    const response = await saveFinanceProduct({
      rooftopId: v.rooftopId,
      code: editor.mode === 'edit' ? editor.product!.code : code,
      name: v.name.trim(),
      category: v.category,
      retailPriceCents: retail!,
      costCents: cost,
      active: editor.mode === 'create' ? true : v.active === 'yes',
      expectNew: editor.mode === 'create',
      idempotencyKey: editor.idempotencyKey,
    })
    setBusyId(null)
    if (!response.success) { setFormError(response.error); return }
    setEditor(null)
    setNotice({ tone: 'ok', text: editor.mode === 'create' ? `${code} added.` : `${editor.product!.code} saved.` })
    await reload()
  }

  const toggleActive = async (product: CatalogProduct) => {
    if (!product.rooftop) return
    setBusyId(product.id); setNotice(null)
    const response = await saveFinanceProduct({
      rooftopId: product.rooftop.id,
      code: product.code,
      name: product.name,
      category: product.category,
      retailPriceCents: product.retailPriceCents,
      costCents: product.costCents,
      active: !product.active,
      expectNew: false,
      idempotencyKey: newIdempotencyKey('finance-product'),
    })
    setBusyId(null)
    setNotice(response.success ? { tone: 'ok', text: `${product.code} ${product.active ? 'deactivated' : 'activated'}.` } : { tone: 'bad', text: response.error })
    if (response.success) await reload()
  }

  const editorFields: FinanceFormField[] = !editor ? [] : [
    editor.mode === 'create'
      ? { name: 'rooftopId', label: 'Rooftop', type: 'select', options: rooftops.map(rooftop => ({ value: rooftop.id, label: rooftop.name })), wide: true }
      : { name: 'rooftopName', label: 'Rooftop', type: 'readonly', wide: true },
    editor.mode === 'create' ? { name: 'code', label: 'Code', placeholder: 'VSC-60', maxLength: 80 } : { name: 'code', label: 'Code', type: 'readonly' },
    { name: 'category', label: 'Category', type: 'select', options: PRODUCT_CATEGORIES.map(value => ({ value, label: categoryLabels[value] })) },
    { name: 'name', label: 'Name', maxLength: 200, wide: true },
    { name: 'retail', label: 'Retail price', type: 'money', placeholder: '$1,299' },
    { name: 'cost', label: 'Dealer cost', type: 'money', placeholder: editor.mode === 'edit' && editor.product?.costCents == null ? 'Unchanged' : '$899', description: editor.mode === 'edit' && editor.product?.costCents == null ? 'Hidden for your role; blank keeps the current cost' : undefined },
    ...(editor.mode === 'edit' ? [{ name: 'active', label: 'Active on menus', type: 'checkbox' as const }] : []),
  ]

  const breadcrumbs = [
    { type: 'link' as const, label: 'Dashboard', href: basePath },
    { type: 'page' as const, label: 'Platform' },
    { type: 'link' as const, label: 'Finance', href: `${basePath}/platform/finance` },
    { type: 'page' as const, label: 'F&I products' },
  ]

  const header = (
    <DeskHeader
      title="F&I products"
      tone={error ? 'bad' : counts.active > 0 ? 'ok' : 'warn'}
      status={error ? 'Unavailable' : `${counts.active} active`}
      meta={error ? 'Unavailable' : `${rooftopId ? rooftopName(rooftopId) : 'All rooftops'} · ${counts.active} active · ${counts.inactive} inactive`}
      actions={
        <Track>
          <Pill asChild variant="plain">
            <Link href={`${basePath}/platform/finance`}><ArrowLeft />Finance</Link>
          </Pill>
          <Pill onClick={reload} disabled={loading} aria-label="Refresh">
            <RefreshCw className={loading ? 'animate-spin' : undefined} />
            Refresh
          </Pill>
          <Pill variant="primary" onClick={openCreate} disabled={!rooftops.length || Boolean(error)} title={!rooftops.length ? 'No rooftop available' : undefined}>
            <Plus />
            New product
          </Pill>
        </Track>
      }
    />
  )

  if (error && !catalog) {
    return (
      <PageContainer title="F&I products" header={header} breadcrumbs={breadcrumbs}>
        <div className="space-y-3 px-4 pb-24 md:px-6">
          <Notice tone="bad">
            <p className="font-medium">Products are unavailable</p>
            <p className="mt-0.5 text-muted-foreground">{error}</p>
          </Notice>
          <Track><Pill onClick={reload} disabled={loading}>Retry</Pill></Track>
        </div>
      </PageContainer>
    )
  }

  return (
    <PageContainer title="F&I products" header={header} breadcrumbs={breadcrumbs}>
      <div className="min-w-0 max-w-full space-y-6 px-4 pb-24 md:px-6">
        {notice && (
          <Notice tone={notice.tone}>
            <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-2">
              <p className="min-w-0">{notice.text}</p>
              <Track><Pill size="sm" variant="plain" onClick={() => setNotice(null)}>Dismiss</Pill></Track>
            </div>
          </Notice>
        )}
        {error && <Notice tone="bad">{error}</Notice>}

        <ReadoutStrip>
          <Readout label="Active" value={counts.active} tone={counts.active > 0 ? 'ok' : 'warn'} />
          <Readout label="Inactive" value={counts.inactive} />
          <Readout label="Avg margin" value={averageMargin == null ? '-' : formatCents(Math.round(averageMargin))} sub={averageMargin == null ? 'Cost hidden or no products' : 'Active products'} />
        </ReadoutStrip>

        <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-center">
          {rooftops.length > 1 && (
            <Select value={rooftopId || 'all'} onValueChange={value => setRooftopId(value === 'all' ? '' : value)}>
              <SelectTrigger className="h-11 w-full rounded-full lg:w-[220px]" aria-label="Rooftop"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All rooftops</SelectItem>
                {rooftops.map(rooftop => <SelectItem key={rooftop.id} value={rooftop.id}>{rooftop.name}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          <Segmented
            label="Product status"
            value={tab}
            onChange={setTab}
            options={[
              { value: 'active', label: 'Active', count: counts.active, tone: 'ok' },
              { value: 'inactive', label: 'Inactive', count: counts.inactive, tone: 'idle' },
              { value: 'all', label: 'All', count: counts.all },
            ]}
          />
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="h-11 w-full rounded-full lg:w-[190px]" aria-label="Category"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {PRODUCT_CATEGORIES.map(value => <SelectItem key={value} value={value}>{categoryLabels[value]}</SelectItem>)}
            </SelectContent>
          </Select>
          <div className="relative min-w-0 flex-1 lg:max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="h-11 rounded-full pl-9" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search code or name" aria-label="Search products" />
          </div>
          {loading && <span className="text-sm text-muted-foreground" role="status">Refreshing…</span>}
        </div>

        <DeskSection title="Catalog" count={visible.length}>
          {visible.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-10 text-center text-sm text-muted-foreground">
              <p>{rooftopProducts.length === 0 ? 'No products at this rooftop' : 'No matching products'}</p>
              <Track>
                {rooftopProducts.length === 0
                  ? <Pill size="sm" variant="primary" onClick={openCreate} disabled={!rooftops.length}>New product</Pill>
                  : <Pill size="sm" onClick={() => { setSearch(''); setCategory('all'); setTab('all') }}>Reset filters</Pill>}
              </Track>
            </div>
          ) : (
            <Panel className="divide-y">
              {visible.map(product => {
                const margin = product.costCents == null ? null : product.retailPriceCents - product.costCents
                const busy = busyId === product.id
                return (
                  <div key={product.id} className="flex min-w-0 flex-col gap-3 px-4 py-3 md:flex-row md:items-center md:justify-between">
                    <div className="flex min-w-0 flex-1 items-start justify-between gap-4">
                      <div className="min-w-0">
                        <TitleLine as="p" tone={product.active ? 'ok' : 'idle'} status={product.active ? 'Active' : 'Inactive'} className="text-sm font-medium">
                          {product.name}
                        </TitleLine>
                        <p className="pl-4 text-xs text-muted-foreground">
                          <Code>{product.code}</Code> · {categoryLabels[product.category] || product.category} · {product.active ? 'Active' : 'Inactive'}
                          {!rooftopId && product.rooftop ? ` · ${product.rooftop.name}` : ''}
                          {product.quotesCount ? ` · ${product.quotesCount} quotes` : ''}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-sm font-medium tabular-nums">{formatCents(product.retailPriceCents)}</p>
                        <p className="font-mono text-[11px] tabular-nums text-muted-foreground">
                          Cost {formatCents(product.costCents, 'hidden')}{margin != null ? ` · ${formatCents(margin)}` : ''}
                        </p>
                      </div>
                    </div>
                    <Track className="self-start md:shrink-0">
                      <Pill size="sm" onClick={() => openEdit(product)} disabled={busy}>Edit</Pill>
                      <Pill size="sm" variant={product.active ? 'plain' : 'raised'} onClick={() => toggleActive(product)} disabled={busy}>
                        {busy ? 'Saving…' : product.active ? 'Deactivate' : 'Activate'}
                      </Pill>
                    </Track>
                  </div>
                )
              })}
            </Panel>
          )}
        </DeskSection>

        <FinanceFormDialog
          open={Boolean(editor)}
          title={editor?.mode === 'create' ? 'New F&I product' : `Edit ${editor?.product?.code || 'product'}`}
          fields={editorFields}
          values={editor?.values || {}}
          errors={fieldErrors}
          error={formError}
          busy={busyId === 'editor'}
          submitLabel={editor?.mode === 'create' ? 'Add product' : 'Save'}
          onValuesChange={values => setEditor(current => current ? { ...current, values } : current)}
          onSubmit={submit}
          onOpenChange={open => { if (!open) setEditor(null) }}
        />
      </div>
    </PageContainer>
  )
}
