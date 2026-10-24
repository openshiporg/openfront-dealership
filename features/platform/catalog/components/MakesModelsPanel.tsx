'use client'

import { useMemo, useState } from 'react'
import { Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Code, DeskSection, Notice, Panel, Pill, Segmented, TitleLine, Track } from '@/features/platform/components/desk'
import { cn } from '@/lib/utils'
import { type CatalogMake, type CatalogModel, type InventoryPair, addInventoryPairs, deleteMake, deleteModel, saveMake, saveModel } from '../actions'
import { ConfirmDialog, EmptyRow, Field, FormDialog, TAP, TAP_INPUT, TAP_SM } from './formKit'

export const BODY_STYLES = [
  { value: 'sedan', label: 'Sedan' },
  { value: 'suv', label: 'SUV' },
  { value: 'truck', label: 'Truck' },
  { value: 'coupe', label: 'Coupe' },
  { value: 'hatchback', label: 'Hatchback' },
  { value: 'convertible', label: 'Convertible' },
  { value: 'wagon', label: 'Wagon' },
  { value: 'van', label: 'Van' },
  { value: 'minivan', label: 'Minivan' },
]
const bodyStyleLabel = (value: string | null) => BODY_STYLES.find(style => style.value === value)?.label || null

type MakeFilter = 'all' | 'with-models' | 'no-models'
type MakeDraft = { id?: string; name: string }
type ModelDraft = { id?: string; makeId: string; name: string; bodyStyle: string; baseYear: string }
type Pending = { kind: 'make'; make: CatalogMake } | { kind: 'model'; model: CatalogModel }

const pairKey = (make: string, model: string) => `${make.trim().toLowerCase()}|${model.trim().toLowerCase()}`

export function MakesModelsPanel({
  makes,
  inventoryPairs,
  error,
  onReload,
}: {
  makes: CatalogMake[]
  inventoryPairs: InventoryPair[]
  error: string | null
  onReload: () => Promise<void>
}) {
  const [filter, setFilter] = useState<MakeFilter>('all')
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(makes[0]?.id || null)
  const [makeDraft, setMakeDraft] = useState<MakeDraft | null>(null)
  const [modelDraft, setModelDraft] = useState<ModelDraft | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [pending, setPending] = useState<Pending | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [addingPairs, setAddingPairs] = useState<string | null>(null)
  const [pairError, setPairError] = useState<string | null>(null)

  const counts = {
    all: makes.length,
    withModels: makes.filter(make => make.modelsCount > 0).length,
    noModels: makes.filter(make => make.modelsCount === 0).length,
  }
  const visible = useMemo(() => {
    const term = search.trim().toLowerCase()
    return makes
      .filter(make => filter === 'all' || (filter === 'with-models' ? make.modelsCount > 0 : make.modelsCount === 0))
      .filter(make => !term || make.name.toLowerCase().includes(term) || make.models.some(model => model.name.toLowerCase().includes(term)))
  }, [makes, filter, search])
  const selected = makes.find(make => make.id === selectedId) || null

  const catalogPairs = useMemo(() => new Set(makes.flatMap(make => make.models.map(model => pairKey(make.name, model.name)))), [makes])
  const missingPairs = inventoryPairs.filter(pair => !catalogPairs.has(pairKey(pair.make, pair.model)))

  const closeForms = () => { setMakeDraft(null); setModelDraft(null); setFieldErrors({}); setFormError(null) }

  const submitMake = async () => {
    if (!makeDraft) return
    const name = makeDraft.name.trim()
    const errors: Record<string, string> = {}
    if (!name) errors.name = 'Name is required'
    else if (name.length > 100) errors.name = 'Name is too long'
    else if (makes.some(make => make.id !== makeDraft.id && make.name.toLowerCase() === name.toLowerCase())) errors.name = 'This make already exists'
    setFieldErrors(errors)
    if (Object.keys(errors).length) return
    setBusy(true); setFormError(null)
    const response = await saveMake({ id: makeDraft.id, name })
    setBusy(false)
    if (!response.success) { setFormError(response.error); return }
    setNotice(makeDraft.id ? `Make renamed to ${name}` : `Added ${name}`)
    closeForms()
    await onReload()
  }

  const submitModel = async () => {
    if (!modelDraft) return
    const name = modelDraft.name.trim()
    const make = makes.find(item => item.id === modelDraft.makeId)
    const errors: Record<string, string> = {}
    if (!make) errors.makeId = 'Choose a make'
    if (!name) errors.name = 'Name is required'
    else if (name.length > 100) errors.name = 'Name is too long'
    else if (make?.models.some(model => model.id !== modelDraft.id && model.name.toLowerCase() === name.toLowerCase())) errors.name = `${make.name} already has this model`
    let baseYear: number | null = null
    if (modelDraft.baseYear.trim()) {
      baseYear = Number(modelDraft.baseYear.trim())
      const maxYear = new Date().getFullYear() + 2
      if (!Number.isInteger(baseYear) || baseYear < 1900 || baseYear > maxYear) errors.baseYear = `Year must be 1900 to ${maxYear}`
    }
    setFieldErrors(errors)
    if (Object.keys(errors).length) return
    setBusy(true); setFormError(null)
    const response = await saveModel({ id: modelDraft.id, makeId: modelDraft.makeId, name, bodyStyle: modelDraft.bodyStyle === 'none' ? null : modelDraft.bodyStyle, baseYear })
    setBusy(false)
    if (!response.success) { setFormError(response.error); return }
    setNotice(modelDraft.id ? `Saved ${name}` : `Added ${make?.name} ${name}`)
    setSelectedId(modelDraft.makeId)
    closeForms()
    await onReload()
  }

  const confirmDelete = async () => {
    if (!pending) return
    setBusy(true); setFormError(null)
    const response = pending.kind === 'make' ? await deleteMake(pending.make.id) : await deleteModel(pending.model.id)
    setBusy(false)
    if (!response.success) { setFormError(response.error); return }
    setNotice(pending.kind === 'make' ? `Deleted ${pending.make.name}` : `Deleted ${pending.model.name}`)
    if (pending.kind === 'make' && selectedId === pending.make.id) setSelectedId(null)
    setPending(null)
    await onReload()
  }

  const addPairs = async (pairs: InventoryPair[], key: string) => {
    setAddingPairs(key); setNotice(null); setPairError(null)
    const response = await addInventoryPairs(pairs.map(pair => ({ make: pair.make, model: pair.model })))
    setAddingPairs(null)
    if (!response.success) { setPairError(response.error); return }
    setNotice(`Added ${response.added ?? 0} ${response.added === 1 ? 'model' : 'models'} from inventory`)
    await onReload()
  }

  return (
    <div className="space-y-4">
      {error && <Notice tone="bad">{error}</Notice>}
      {notice && <Notice tone="ok">{notice}</Notice>}

      {missingPairs.length > 0 && (
        <DeskSection
          title="In inventory, not in catalog"
          count={missingPairs.length}
          actions={
            <Track>
              <Pill size="sm" variant="primary" className={TAP_SM} disabled={addingPairs !== null} onClick={() => addPairs(missingPairs, 'all')}>
                <Plus />
                {addingPairs === 'all' ? 'Adding…' : 'Add all'}
              </Pill>
            </Track>
          }
        >
          {pairError && <Notice tone="bad" className="mb-3">{pairError}</Notice>}
          <ul className="flex flex-wrap gap-2">
            {missingPairs.map(pair => {
              const key = pairKey(pair.make, pair.model)
              return (
                <li key={key}>
                  <button
                    type="button"
                    disabled={addingPairs !== null}
                    onClick={() => addPairs([pair], key)}
                    className="inline-flex min-h-11 items-center gap-2 rounded-full border bg-card px-3 text-sm hover:bg-muted/50 disabled:opacity-50 sm:min-h-8"
                  >
                    <Plus className="size-3.5" />
                    <span>{pair.make} {pair.model}</span>
                    <Code>{pair.units}</Code>
                  </button>
                </li>
              )
            })}
          </ul>
        </DeskSection>
      )}

      <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <Segmented<MakeFilter>
          label="Filter makes"
          value={filter}
          onChange={setFilter}
          size="sm"
          options={[
            { value: 'all', label: 'All', count: counts.all },
            { value: 'with-models', label: 'With models', count: counts.withModels },
            { value: 'no-models', label: 'No models', count: counts.noModels, tone: counts.noModels ? 'warn' : undefined },
          ]}
        />
        <div className="relative min-w-0 sm:max-w-xs sm:flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input className={cn('pl-9', TAP_INPUT)} value={search} onChange={event => setSearch(event.target.value)} placeholder="Make or model" aria-label="Search makes and models" />
        </div>
        <Track className="sm:ml-auto">
          <Pill variant="primary" className={TAP} onClick={() => { closeForms(); setMakeDraft({ name: '' }) }}>
            <Plus />
            Add make
          </Pill>
        </Track>
      </div>

      <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <Panel className="overflow-hidden">
          {visible.length === 0 ? (
            <EmptyRow>{makes.length === 0 ? 'No makes yet' : 'No makes match'}</EmptyRow>
          ) : (
            <ul className="divide-y">
              {visible.map(make => (
                <li key={make.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(make.id)}
                    aria-pressed={make.id === selectedId}
                    className={cn('flex min-h-11 w-full min-w-0 items-baseline justify-between gap-3 px-4 py-3 text-left hover:bg-muted/40', make.id === selectedId && 'bg-muted/60')}
                  >
                    <TitleLine as="span" tone={make.modelsCount > 0 ? 'ok' : 'warn'} status={make.modelsCount > 0 ? 'Has models' : 'No models'} className="text-sm font-medium">
                      {make.name}
                    </TitleLine>
                    <span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">{make.modelsCount} {make.modelsCount === 1 ? 'model' : 'models'}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel className="overflow-hidden">
          {!selected ? (
            <EmptyRow>Select a make</EmptyRow>
          ) : (
            <div>
              <div className="flex min-w-0 flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
                <TitleLine as="h3" tone={selected.modelsCount > 0 ? 'ok' : 'warn'} className="text-base font-semibold">
                  {selected.name}
                  <span className="ml-2 font-mono text-xs font-normal tabular-nums text-muted-foreground">{selected.modelsCount}</span>
                </TitleLine>
                <Track>
                  <Pill size="sm" className={TAP_SM} onClick={() => { closeForms(); setMakeDraft({ id: selected.id, name: selected.name }) }}>
                    <Pencil />
                    Rename
                  </Pill>
                  <Pill
                    size="sm"
                    className={TAP_SM}
                    disabled={selected.modelsCount > 0}
                    title={selected.modelsCount > 0 ? 'Delete its models first' : undefined}
                    onClick={() => { setFormError(null); setPending({ kind: 'make', make: selected }) }}
                  >
                    <Trash2 />
                    Delete
                  </Pill>
                  <Pill size="sm" variant="primary" className={TAP_SM} onClick={() => { closeForms(); setModelDraft({ makeId: selected.id, name: '', bodyStyle: 'none', baseYear: '' }) }}>
                    <Plus />
                    Add model
                  </Pill>
                </Track>
              </div>
              {selected.modelsCount > 0 && <p className="border-b px-4 py-2 text-xs text-muted-foreground">Delete is available once the make has no models.</p>}
              {selected.models.length === 0 ? (
                <EmptyRow>No models</EmptyRow>
              ) : (
                <ul className="divide-y">
                  {selected.models.map(model => (
                    <li key={model.id} className="flex min-w-0 flex-wrap items-center justify-between gap-2 px-4 py-2.5">
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{model.name}</p>
                        <p className="text-xs text-muted-foreground">{[bodyStyleLabel(model.bodyStyle), model.baseYear ? `Since ${model.baseYear}` : null].filter(Boolean).join(' · ') || 'No body style'}</p>
                      </div>
                      <Track>
                        <Pill size="sm" className={TAP_SM} aria-label={`Edit ${model.name}`} onClick={() => { closeForms(); setModelDraft({ id: model.id, makeId: selected.id, name: model.name, bodyStyle: model.bodyStyle || 'none', baseYear: model.baseYear ? String(model.baseYear) : '' }) }}>
                          <Pencil />
                          Edit
                        </Pill>
                        <Pill size="sm" className={TAP_SM} aria-label={`Delete ${model.name}`} onClick={() => { setFormError(null); setPending({ kind: 'model', model }) }}>
                          <Trash2 />
                        </Pill>
                      </Track>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </Panel>
      </div>

      <FormDialog
        open={makeDraft !== null}
        title={makeDraft?.id ? 'Rename make' : 'Add make'}
        busy={busy}
        error={formError}
        onSubmit={submitMake}
        onOpenChange={open => { if (!open) closeForms() }}
      >
        <Field id="make-name" label="Name" error={fieldErrors.name}>
          <Input id="make-name" className={TAP_INPUT} autoFocus maxLength={100} value={makeDraft?.name || ''} aria-invalid={Boolean(fieldErrors.name)} onChange={event => setMakeDraft(draft => draft && { ...draft, name: event.target.value })} />
        </Field>
      </FormDialog>

      <FormDialog
        open={modelDraft !== null}
        title={modelDraft?.id ? 'Edit model' : 'Add model'}
        busy={busy}
        error={formError}
        onSubmit={submitModel}
        onOpenChange={open => { if (!open) closeForms() }}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="model-make" label="Make" error={fieldErrors.makeId}>
            <Select value={modelDraft?.makeId || ''} onValueChange={value => setModelDraft(draft => draft && { ...draft, makeId: value })}>
              <SelectTrigger id="model-make" className={TAP_INPUT}><SelectValue placeholder="Select make" /></SelectTrigger>
              <SelectContent>{makes.map(make => <SelectItem key={make.id} value={make.id}>{make.name}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field id="model-name" label="Name" error={fieldErrors.name}>
            <Input id="model-name" className={TAP_INPUT} autoFocus maxLength={100} value={modelDraft?.name || ''} aria-invalid={Boolean(fieldErrors.name)} onChange={event => setModelDraft(draft => draft && { ...draft, name: event.target.value })} />
          </Field>
          <Field id="model-body" label="Body style">
            <Select value={modelDraft?.bodyStyle || 'none'} onValueChange={value => setModelDraft(draft => draft && { ...draft, bodyStyle: value })}>
              <SelectTrigger id="model-body" className={TAP_INPUT}><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {BODY_STYLES.map(style => <SelectItem key={style.value} value={style.value}>{style.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field id="model-year" label="Base year" error={fieldErrors.baseYear}>
            <Input id="model-year" className={TAP_INPUT} inputMode="numeric" maxLength={4} value={modelDraft?.baseYear || ''} aria-invalid={Boolean(fieldErrors.baseYear)} onChange={event => setModelDraft(draft => draft && { ...draft, baseYear: event.target.value })} />
          </Field>
        </div>
      </FormDialog>

      <ConfirmDialog
        open={pending !== null}
        title={pending?.kind === 'make' ? `Delete ${pending.make.name}?` : `Delete ${pending?.kind === 'model' ? pending.model.name : ''}?`}
        confirmLabel="Delete"
        busy={busy}
        error={formError}
        onConfirm={confirmDelete}
        onOpenChange={open => { if (!open) { setPending(null); setFormError(null) } }}
      />
    </div>
  )
}
