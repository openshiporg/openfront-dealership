'use client'

import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  RefreshCw,
  Search,
  Filter,
  Car,
  DollarSign,
  Clock,
  AlertTriangle,
  Plus,
  Triangle,
  Square,
  Circle,
} from 'lucide-react'
import { EmptyState } from '@/components/ui/empty-state'
import { PageContainer } from '@/features/dashboard/components/PageContainer'
import { basePath } from '@/features/dashboard/lib/config'
import {
  type InventoryVehicle,
  type IntakeRooftop,
  decideInventoryMerchandising,
  getInventoryWorkspace,
  intakeInventoryVehicle,
  moveInventoryStock,
  openInventoryReconWorkItem,
  recordInventoryCost,
  recordInventoryFeedRun,
  submitInventoryMerchandising,
  transitionInventoryAcquisition,
  transitionInventoryReconWorkItem,
  updateInventoryMerchandisingDraft,
} from '../actions'
import { selectPublicFeedRunCandidates } from '../lib/publicFeedCandidates'
import {
  createMerchandisingCommandAttempt,
  merchandisingCommandResultMessage,
  resolveMerchandisingCommandAttempt,
  resolveMerchandisingCommandResponse,
  UNCONFIRMED_MERCHANDISING_COMMAND_MESSAGE,
  type MerchandisingCommandAttempt,
  type MerchandisingCommandResult,
} from '../lib/merchandisingCommandOutcome'
import {
  createReconStartAttempt,
  normalizeReconStartResult,
  reconStartResultMessage,
  resolveReconStartAttempt,
  UNCONFIRMED_RECON_START_MESSAGE,
  type ReconStartAttempt,
} from '../lib/reconStartOutcome'
import {
  createReconCompletionAttempt,
  normalizeReconCompletionResult,
  reconCompletionResultMessage,
  resolveReconCompletionAttempt,
  UNCONFIRMED_RECON_COMPLETION_MESSAGE,
  type ReconCompletionAttempt,
} from '../lib/reconCompletionOutcome'
import {
  normalizePublicFeedRunResult,
  publicFeedRunResultMessage,
  resolvePublicFeedRunAttempt,
  UNCONFIRMED_PUBLIC_FEED_RUN_MESSAGE,
  type PublicFeedRunAttempt,
} from '../lib/publicFeedRunOutcome'

type Vehicle = InventoryVehicle

type InventoryTaskType = 'intake' | 'edit' | 'move' | 'cost' | 'recon-open' | 'recon-complete'
type InventoryTask = { type: InventoryTaskType; vehicle: Vehicle | null; reconWorkItem?: Vehicle['reconWorkItems'][number]; idempotencyKey: string; fields: Record<string, string>; reconCompletionAttempt?: ReconCompletionAttempt }

function moneyInputCents(value: string) {
  const trimmed = value.trim()
  if (!/^\d+(?:\.\d{1,2})?$/.test(trimmed)) return null
  const [whole, fraction = ''] = trimmed.split('.')
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, '0'))
  return Number.isSafeInteger(cents) && cents <= 2_147_483_647 ? cents : null
}

const statusColors: Record<string, string> = {
  available: 'bg-green-100 text-green-700',
  sold: 'bg-blue-100 text-blue-700',
  pending: 'bg-amber-100 text-amber-700',
  hold: 'bg-purple-100 text-purple-700',
  service: 'bg-slate-100 text-slate-700',
}

const conditionLabels: Record<string, string> = {
  new: 'New',
  used: 'Used',
  certified: 'Certified Pre-Owned',
}

function EmptyStateDefault() {
  return (
    <EmptyState
      title="No vehicles"
      description="Vehicles you add will appear here."
      icons={[Triangle, Square, Circle]}
    />
  )
}

function EmptyStateSearch({ onResetFilters }: { onResetFilters: () => void }) {
  return (
    <EmptyState
      title="No results found"
      description="Try adjusting your search or filters."
      icons={[Search]}
      action={{ label: 'Reset filters', onClick: onResetFilters }}
    />
  )
}

export function VehicleListPageClient({
  initialVehicles,
  initialIntakeRooftops,
  initialError,
  currencyCode,
}: {
  initialVehicles: Vehicle[]
  initialIntakeRooftops: IntakeRooftop[]
  initialError: string | null
  currencyCode: string
}) {
  const [vehicles, setVehicles] = useState<Vehicle[]>(initialVehicles)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(initialError)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [sortOrder, setSortOrder] = useState<string>('age-desc')
  const [searchQuery, setSearchQuery] = useState('')
  const [actionId, setActionId] = useState<string | null>(null)
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null)
  const [intakeRooftops, setIntakeRooftops] = useState<IntakeRooftop[]>(initialIntakeRooftops)
  const [intakeRooftopId, setIntakeRooftopId] = useState(initialIntakeRooftops[0]?.id || '')
  const [task, setTask] = useState<InventoryTask | null>(null)
  const [taskError, setTaskError] = useState<string | null>(null)
  const [actionMessage, setActionMessage] = useState<string | null>(null)
  const [pendingFeedRun, setPendingFeedRun] = useState<PublicFeedRunAttempt | null>(null)
  const [pendingMerchandisingAttempt, setPendingMerchandisingAttempt] = useState<MerchandisingCommandAttempt | null>(null)
  const [pendingReconStart, setPendingReconStart] = useState<ReconStartAttempt | null>(null)

  const isInitialLoad = useRef(true)

  const loadVehicles = async () => {
    setLoading(true)
    setError(null)

    const response = await getInventoryWorkspace(statusFilter)
    if (response.success) {
      const rooftops = response.intakeRooftops
      setIntakeRooftops(rooftops)
      setIntakeRooftopId(current => current || rooftops[0]?.id || '')
      setVehicles(response.vehicles)
    } else {
      setError(response.error || 'Unable to load inventory.')
    }
    setLoading(false)
  }

  useEffect(() => {
    if (isInitialLoad.current) {
      isInitialLoad.current = false
      return
    }
    void loadVehicles()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter])

  const beginTask = (type: InventoryTaskType, vehicle: Vehicle | null = null, reconWorkItem?: Vehicle['reconWorkItems'][number]) => {
    if (type === 'intake' && !intakeRooftopId) {
      setActionMessage('No rooftop is available for intake.')
      return
    }
    const fields: Record<string, string> = type === 'intake' ? {
      vin: '', stockNumber: '', year: String(new Date().getFullYear()), make: '', model: '',
      purchaseDollars: '', retailDollars: '', mileage: '0', description: '', imagePath: '', locationCode: 'INTAKE',
    } : type === 'edit' && vehicle ? {
      retailDollars: vehicle.price.toFixed(2), mileage: String(vehicle.mileage), description: vehicle.description, imagePath: vehicle.primaryImagePath || '',
    } : type === 'move' && vehicle ? { locationCode: vehicle.locationCode } : type === 'cost' ? { dollars: '100', reference: '' } :
      type === 'recon-open' ? { title: '', estimatedDollars: '0' } : { actualDollars: '0' }
    setTaskError(null)
    setActionMessage(null)
    setTask({ type, vehicle, reconWorkItem, idempotencyKey: `inventory-${type}:${vehicle?.inventoryStockId || crypto.randomUUID()}:${crypto.randomUUID()}`, fields })
  }

  const intakeVehicle = () => beginTask('intake')
  const editMerchandisingDraft = (vehicle: Vehicle) => beginTask('edit', vehicle)
  const moveStock = (vehicle: Vehicle) => beginTask('move', vehicle)
  const addInventoryCost = (vehicle: Vehicle) => beginTask('cost', vehicle)

  const submitInventoryTask = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!task) return
    const field = (name: string) => task.fields[name]?.trim() || ''
    const money = (name: string, label: string) => {
      const cents = moneyInputCents(field(name))
      if (cents == null) throw new Error(`${label} must be a non-negative amount with no more than two decimal places.`)
      return cents
    }
    setTaskError(null)
    setActionMessage(null)
    setActionId(task.vehicle?.inventoryStockId || 'intake')
    let reconCompletionAttempt: ReconCompletionAttempt | null = task.reconCompletionAttempt ?? null
    let taskSuccessMessage = 'Saved.'
    try {
      let response: { success: boolean; error?: string } | undefined
      if (task.type === 'intake') {
        const vin = field('vin').toUpperCase()
        const stockNumber = field('stockNumber').toUpperCase()
        const year = Number(field('year'))
        const mileage = Number(field('mileage'))
        const make = field('make')
        const model = field('model')
        const locationCode = field('locationCode').toUpperCase()
        const purchasePriceCents = money('purchaseDollars', 'Purchase cost')
        const priceCents = money('retailDollars', 'Retail price')
        if (!/^[A-HJ-NPR-Z0-9]{17}$/.test(vin)) throw new Error('Enter a valid 17-character VIN (I, O, and Q are not used).')
        if (!stockNumber || !make || !model || !locationCode || !Number.isInteger(year) || year < 1886 || year > new Date().getFullYear() + 1 || !Number.isSafeInteger(mileage) || mileage < 0 || priceCents <= 0) {
          throw new Error('Enter a stock number, valid model year, make, model, non-negative odometer, location, and positive retail price.')
        }
        response = await intakeInventoryVehicle({
          rooftopId: intakeRooftopId, idempotencyKey: task.idempotencyKey,
          reason: 'Vehicle acquired and stocked from inventory operations desk', acquisitionSource: 'dealer-transfer', sourceReference: 'operator-recorded',
          vin, stockNumber, year, make, model, mileage, purchasePriceCents, listPriceCents: priceCents, priceCents,
          condition: 'used', description: field('description'), features: [], imagePath: field('imagePath'), locationCode, locationLabel: locationCode,
        })
      } else if (task.type === 'edit' && task.vehicle) {
        const priceCents = money('retailDollars', 'Retail price')
        const mileage = Number(field('mileage'))
        if (priceCents <= 0 || !Number.isSafeInteger(mileage) || mileage < 0 || !field('description') || !field('imagePath')) throw new Error('Enter a positive retail price, non-negative odometer, description, and primary image path.')
        response = await updateInventoryMerchandisingDraft({
          stockId: task.vehicle.inventoryStockId, priceCents, listPriceCents: priceCents, mileage, description: field('description'), imagePath: field('imagePath'),
          expectedUpdatedAt: task.vehicle.stockUpdatedAt, reason: 'Listing draft updated from inventory operations desk', idempotencyKey: task.idempotencyKey,
        })
      } else if (task.type === 'move' && task.vehicle) {
        const locationCode = field('locationCode').toUpperCase()
        if (!locationCode) throw new Error('Lot location is required.')
        response = await moveInventoryStock({ stockId: task.vehicle.inventoryStockId, locationCode, locationLabel: locationCode, expectedUpdatedAt: task.vehicle.stockUpdatedAt, reason: 'Moved from inventory operations desk', idempotencyKey: task.idempotencyKey })
      } else if (task.type === 'cost' && task.vehicle) {
        const amountCents = money('dollars', 'Inventory cost')
        if (amountCents <= 0) throw new Error('Enter a positive inventory cost.')
        response = await recordInventoryCost({ stockId: task.vehicle.inventoryStockId, costType: 'other', amountCents, reference: field('reference') || undefined, reason: 'Cost recorded from inventory operations desk', idempotencyKey: task.idempotencyKey })
      } else if (task.type === 'recon-open' && task.vehicle) {
        const title = field('title')
        if (!title) throw new Error('A reconditioning work item is required.')
        const estimatedCostCents = money('estimatedDollars', 'Estimated recon cost')
        response = await openInventoryReconWorkItem({ stockId: task.vehicle.inventoryStockId, title, category: 'other', estimatedCostCents, reason: 'Opened from inventory operations desk', idempotencyKey: task.idempotencyKey })
      } else if (task.type === 'recon-complete' && task.vehicle && task.reconWorkItem) {
        const attempt = resolveReconCompletionAttempt(task.reconCompletionAttempt ?? null, () => createReconCompletionAttempt(
          task.reconWorkItem!.id,
          task.vehicle!.inventoryStockId,
          task.reconWorkItem!.updatedAt,
          money('actualDollars', 'Actual recon cost'),
          'Completed from inventory operations desk',
          task.idempotencyKey
        ))
        reconCompletionAttempt = attempt
        setTask(current => current && current.idempotencyKey === task.idempotencyKey ? { ...current, reconCompletionAttempt: attempt } : current)
        const reconResponse = await transitionInventoryReconWorkItem({ id: attempt.workItemId, toStatus: attempt.toStatus, actualCostCents: attempt.actualCostCents, expectedUpdatedAt: attempt.expectedUpdatedAt, reason: attempt.reason, idempotencyKey: attempt.idempotencyKey })
        response = reconResponse
        const result = normalizeReconCompletionResult(
          reconResponse.success,
          reconResponse.success ? reconResponse.data.transitionInventoryReconWorkItem : null,
          attempt
        )
        if (!result) {
          setTaskError(UNCONFIRMED_RECON_COMPLETION_MESSAGE)
          return
        }
        taskSuccessMessage = reconCompletionResultMessage(result)
      }
      if (!response?.success) {
        setTaskError(response?.error || 'Unable to save. Your entries are kept so you can retry.')
        return
      }
      setTask(null)
      setActionMessage(taskSuccessMessage)
      await loadVehicles()
    } catch (error) {
      if (task.type === 'recon-complete' && reconCompletionAttempt) {
        setTaskError(UNCONFIRMED_RECON_COMPLETION_MESSAGE)
      } else {
        setTaskError(error instanceof Error ? error.message : 'Unable to save.')
      }
    } finally {
      setActionId(null)
    }
  }

  const advanceAcquisition = async (vehicle: Vehicle) => {
    if (!vehicle.acquisition || !['arrived', 'reconditioning'].includes(vehicle.acquisition.status)) return
    const toStatus = vehicle.acquisition.status === 'arrived' ? 'reconditioning' : 'frontline'
    if (toStatus === 'frontline' && (vehicle.reconStatus !== 'completed' || vehicle.merchandisingStatus !== 'approved')) {
      setActionMessage('Complete recon and approve the listing before marking this vehicle frontline.')
      return
    }
    setActionId(vehicle.inventoryStockId)
    const response = await transitionInventoryAcquisition({
      id: vehicle.acquisition.id,
      toStatus,
      expectedUpdatedAt: vehicle.acquisition.updatedAt,
      reason: `${toStatus} from inventory operations desk`,
      idempotencyKey: `acquisition-transition:${vehicle.acquisition.id}:${crypto.randomUUID()}`,
    })
    setActionMessage(response.success ? `Acquisition moved to ${toStatus}.` : `Unable to update acquisition: ${response.error}`)
    await loadVehicles()
    setActionId(null)
  }

  const executeMerchandisingAttempt = async (attempt: MerchandisingCommandAttempt) => {
    setPendingMerchandisingAttempt(attempt)
    setActionId(attempt.stockId)
    try {
      const response = attempt.kind === 'approve'
        ? await decideInventoryMerchandising({ id: attempt.versionId, decision: attempt.decision, reason: attempt.reason, expectedUpdatedAt: attempt.expectedUpdatedAt, idempotencyKey: attempt.idempotencyKey })
        : await submitInventoryMerchandising({ stockId: attempt.stockId, reason: attempt.reason, idempotencyKey: attempt.idempotencyKey })
      const result = resolveMerchandisingCommandResponse(
        response.success,
        response.success ? response.data[attempt.kind === 'approve' ? 'decideInventoryMerchandising' : 'submitInventoryMerchandising'] : null,
        attempt
      )
      if (!result) {
        setPendingMerchandisingAttempt(attempt)
        setActionMessage(UNCONFIRMED_MERCHANDISING_COMMAND_MESSAGE)
        return
      }
      setPendingMerchandisingAttempt(null)
      setActionMessage(merchandisingCommandResultMessage(attempt, result))
      await loadVehicles()
    } catch {
      setPendingMerchandisingAttempt(attempt)
      setActionMessage(UNCONFIRMED_MERCHANDISING_COMMAND_MESSAGE)
    } finally {
      setActionId(null)
    }
  }

  const submitOrApproveMerchandising = async (vehicle: Vehicle) => {
    if (pendingMerchandisingAttempt) return
    const attempt = createMerchandisingCommandAttempt(vehicle.inventoryStockId, vehicle.latestMerchandisingVersion, () => crypto.randomUUID())
    await executeMerchandisingAttempt(attempt)
  }

  const retryMerchandisingAttempt = async () => {
    const attempt = resolveMerchandisingCommandAttempt(pendingMerchandisingAttempt, () => null)
    if (attempt) await executeMerchandisingAttempt(attempt)
  }

  const executeReconStartAttempt = async (attempt: ReconStartAttempt) => {
    setPendingReconStart(attempt)
    setActionId(attempt.stockId)
    try {
      const response = await transitionInventoryReconWorkItem({ id: attempt.workItemId, toStatus: attempt.toStatus, expectedUpdatedAt: attempt.expectedUpdatedAt, reason: attempt.reason, idempotencyKey: attempt.idempotencyKey })
      const result = normalizeReconStartResult(response.success, response.success ? response.data.transitionInventoryReconWorkItem : null, attempt)
      if (!result) {
        setPendingReconStart(attempt)
        setActionMessage(null)
        return
      }
      setPendingReconStart(null)
      setActionMessage(reconStartResultMessage(result))
      await loadVehicles()
    } catch {
      setPendingReconStart(attempt)
      setActionMessage(null)
    } finally {
      setActionId(null)
    }
  }

  const retryReconStart = async () => {
    const attempt = resolveReconStartAttempt(pendingReconStart, () => null)
    if (attempt) await executeReconStartAttempt(attempt)
  }

  const advanceRecon = async (vehicle: Vehicle) => {
    if (pendingReconStart) return
    const active = vehicle.reconWorkItems.find(item => ['open', 'in-progress'].includes(item.status))
    if (!active) return beginTask('recon-open', vehicle)
    if (active.status === 'in-progress') return beginTask('recon-complete', vehicle, active)
    const attempt = createReconStartAttempt(active.id, vehicle.inventoryStockId, active.updatedAt, () => crypto.randomUUID())
    await executeReconStartAttempt(attempt)
  }

  const recordPublicFeed = async () => {
    const candidateStockIds = selectPublicFeedRunCandidates(vehicles).map(vehicle => vehicle.inventoryStockId)
    const attempt = resolvePublicFeedRunAttempt(pendingFeedRun, candidateStockIds, () => `public-feed:${crypto.randomUUID()}`)
    if (!attempt) { setActionMessage('No vehicles are ready to publish.'); return }
    setPendingFeedRun(attempt)
    setActionId('feed')
    try {
      const response = await recordInventoryFeedRun({ channelKey: 'public-inventory-feed', stockIds: attempt.stockIds, errors: [], idempotencyKey: attempt.idempotencyKey })
      const result = response.success ? normalizePublicFeedRunResult(response.data.recordInventoryFeedRun, attempt.stockIds.length) : null
      if (!result) {
        setPendingFeedRun(attempt)
        setActionMessage(UNCONFIRMED_PUBLIC_FEED_RUN_MESSAGE)
        return
      }
      setActionMessage(publicFeedRunResultMessage(result))
      setPendingFeedRun(null)
      await loadVehicles()
    } catch {
      setPendingFeedRun(attempt)
      setActionMessage(UNCONFIRMED_PUBLIC_FEED_RUN_MESSAGE)
    } finally {
      setActionId(null)
    }
  }

  const filteredVehicles = vehicles.filter(v => {
    if (!searchQuery) return true
    const search = searchQuery.toLowerCase()
    const str = `${v.year} ${v.make} ${v.model} ${v.vin} ${v.stockNumber} ${v.locationCode}`.toLowerCase()
    return str.includes(search)
  }).sort((a, b) => {
    if (sortOrder === 'age-asc') return calculateDaysInStock(a) - calculateDaysInStock(b)
    if (sortOrder === 'price-desc') return b.price - a.price
    if (sortOrder === 'price-asc') return a.price - b.price
    if (sortOrder === 'stock') return a.stockNumber.localeCompare(b.stockNumber)
    return calculateDaysInStock(b) - calculateDaysInStock(a)
  })

  const formatCurrency = (value: number | null | undefined) => {
    if (value == null) return '-'
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: currencyCode, maximumFractionDigits: 0 }).format(value)
  }

  function calculateDaysInStock(vehicle: Vehicle) {
    const date = vehicle.dateAcquired || vehicle.createdAt
    if (!date) return 0
    return Math.floor((Date.now() - new Date(date).getTime()) / (1000 * 60 * 60 * 24))
  }

  const totalValue = filteredVehicles.filter(v => v.status === 'available').reduce((sum, v) => sum + (v.price || 0), 0)
  const avgDaysInStock = filteredVehicles.filter(v => v.status === 'available').length > 0
    ? Math.round(filteredVehicles.filter(v => v.status === 'available').reduce((sum, v) => sum + calculateDaysInStock(v), 0) / filteredVehicles.filter(v => v.status === 'available').length)
    : 0
  const agingCount = filteredVehicles.filter(v => v.status === 'available' && calculateDaysInStock(v) > 60).length
  const updateTaskField = (name: string, value: string) => setTask(current => current ? { ...current, fields: { ...current.fields, [name]: value } } : current)
  const taskInput = (name: string, label: string, options: { type?: string; required?: boolean; min?: number; step?: number; maxLength?: number; inputMode?: 'decimal' | 'numeric' | 'text'; disabled?: boolean } = {}) => (
    <label key={name} htmlFor={`inventory-task-${name}`} className="grid gap-1.5 text-sm">
      <span className="font-medium">{label}</span>
      <Input id={`inventory-task-${name}`} type={options.type || 'text'} inputMode={options.inputMode} min={options.min} step={options.step} maxLength={options.maxLength} required={options.required ?? true} disabled={options.disabled} value={task?.fields[name] || ''} onChange={event => updateTaskField(name, event.target.value)} />
    </label>
  )
  const taskTitle = task?.type === 'intake' ? 'Intake vehicle' : task?.type === 'edit' ? 'Edit listing draft' : task?.type === 'move' ? 'Move inventory' : task?.type === 'cost' ? 'Record inventory cost' : task?.type === 'recon-open' ? 'Open recon work' : 'Complete recon work'

  const isFiltered = Boolean(searchQuery.trim()) || statusFilter !== 'all'
  const resetFilters = () => {
    setSearchQuery('')
    setStatusFilter('all')
  }

  const breadcrumbs = [
    { type: 'link' as const, label: 'Dashboard', href: basePath },
    { type: 'page' as const, label: 'Platform' },
    { type: 'page' as const, label: 'Inventory' },
  ]

  const header = (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-50">Inventory</h1>
        <p className="text-muted-foreground">Manage vehicle inventory, pricing, photos, and merchandising.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {intakeRooftops.length > 1 && (
          <Select value={intakeRooftopId} onValueChange={setIntakeRooftopId}>
            <SelectTrigger className="w-full sm:w-[180px]" aria-label="Intake rooftop">
              <SelectValue placeholder="Intake rooftop" />
            </SelectTrigger>
            <SelectContent>
              {intakeRooftops.map(rooftop => (
                <SelectItem key={rooftop.id} value={rooftop.id}>
                  {rooftop.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <Button variant="outline" onClick={loadVehicles} disabled={loading}>
          <RefreshCw className="h-4 w-4 mr-2" /> Refresh
        </Button>
        <Button variant="outline" onClick={intakeVehicle} disabled={actionId === 'intake' || !intakeRooftopId}>
          <Plus className="h-4 w-4 mr-2" /> Intake vehicle
        </Button>
        <Button onClick={recordPublicFeed} disabled={actionId === 'feed'}>
          {pendingFeedRun ? 'Retry publishing' : 'Publish feed'}
        </Button>
      </div>
    </div>
  )

  return (
    <PageContainer title="Inventory" header={header} breadcrumbs={breadcrumbs}>
    <div className="min-w-0 space-y-6 px-4 pb-6 md:px-6">
      {actionMessage && (
        <div role="status" className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/40 px-3 py-2 text-sm">
          <span>{actionMessage}</span>
          {pendingMerchandisingAttempt && (
            <Button variant="outline" size="sm" onClick={retryMerchandisingAttempt} disabled={Boolean(actionId)}>
              Retry
            </Button>
          )}
        </div>
      )}
      {pendingReconStart && (
        <div role="status" className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/40 px-3 py-2 text-sm">
          <span>{UNCONFIRMED_RECON_START_MESSAGE}</span>
          <Button variant="outline" size="sm" onClick={retryReconStart} disabled={Boolean(actionId)}>
            Retry
          </Button>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center">
                <Car className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Inventory</p>
                <p className="text-xl font-bold">{filteredVehicles.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-green-100 flex items-center justify-center">
                <DollarSign className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Value</p>
                <p className="text-xl font-bold">{formatCurrency(totalValue)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-amber-100 flex items-center justify-center">
                <Clock className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Avg Days in Stock</p>
                <p className="text-xl font-bold">{avgDaysInStock}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-red-100 flex items-center justify-center">
                <AlertTriangle className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Aging (60+ days)</p>
                <p className="text-xl font-bold">{agingCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
        <div className="relative w-full sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by VIN, stock #, make, model..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
            aria-label="Search inventory"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[180px]" aria-label="Filter by status">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="available">Available</SelectItem>
            <SelectItem value="sold">Sold</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="hold">On Hold</SelectItem>
            <SelectItem value="service">In Service</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sortOrder} onValueChange={setSortOrder}>
          <SelectTrigger className="w-full sm:w-[180px]" aria-label="Sort inventory">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="age-desc">Oldest first</SelectItem>
            <SelectItem value="age-asc">Newest first</SelectItem>
            <SelectItem value="price-desc">Price high to low</SelectItem>
            <SelectItem value="price-asc">Price low to high</SelectItem>
            <SelectItem value="stock">Stock number</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {selectedVehicle && (
        <Card role="region" aria-label={`Vehicle details for ${selectedVehicle.stockNumber}`}>
          <CardContent className="space-y-4 p-4 sm:p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Vehicle details</p>
                <h2 className="mt-1 break-words text-lg font-semibold">{selectedVehicle.year} {selectedVehicle.make} {selectedVehicle.model} {selectedVehicle.trim || ''}</h2>
                <p className="mt-1 break-all font-mono text-xs text-muted-foreground">Stock {selectedVehicle.stockNumber} · VIN {selectedVehicle.vin}</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => setSelectedVehicle(null)}>Close details</Button>
            </div>
            <div className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
              <div><p className="text-muted-foreground">Location / age</p><p className="font-medium">{selectedVehicle.locationLabel || selectedVehicle.locationCode} · {calculateDaysInStock(selectedVehicle)} days</p></div>
              <div><p className="text-muted-foreground">Retail / cost</p><p className="font-medium">{formatCurrency(selectedVehicle.price)} / {selectedVehicle.purchasePrice == null ? 'Not recorded' : formatCurrency(selectedVehicle.purchasePrice)}</p></div>
              <div><p className="text-muted-foreground">Acquisition / recon</p><p className="font-medium">{selectedVehicle.acquisition?.status || 'None'} / {selectedVehicle.reconStatus}</p></div>
              <div><p className="text-muted-foreground">Merchandising / feed</p><p className="font-medium">{selectedVehicle.merchandisingStatus} / {selectedVehicle.feedStatus}</p></div>
            </div>
            <div className="rounded-md border p-3 text-sm">
              <p className="font-medium">Listing</p>
              <p className="mt-1 break-words text-muted-foreground">{selectedVehicle.description || 'No description yet.'}</p>
              <p className="mt-2 text-xs text-muted-foreground">{selectedVehicle.primaryImagePath ? 'Photo added' : 'No photo'} · {selectedVehicle.reconWorkItems.length} recon work item{selectedVehicle.reconWorkItems.length === 1 ? '' : 's'}.</p>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12" role="status">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" aria-hidden="true"></div>
              <span className="sr-only">Loading inventory</span>
            </div>
          ) : error ? (
            <div className="py-12 text-center">
              <AlertTriangle className="mx-auto mb-4 h-12 w-12 text-destructive" />
              <p className="font-medium">Unable to load inventory</p>
              <p className="mt-1 text-sm text-muted-foreground">{error}</p>
              <Button variant="outline" className="mt-4" onClick={loadVehicles}>Retry</Button>
            </div>
          ) : filteredVehicles.length === 0 ? (
            isFiltered ? <EmptyStateSearch onResetFilters={resetFilters} /> : <EmptyStateDefault />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left py-3 px-4 font-medium">Stock #</th>
                    <th className="text-left py-3 px-4 font-medium">Vehicle</th>
                    <th className="text-left py-3 px-4 font-medium">VIN</th>
                    <th className="text-left py-3 px-4 font-medium">Location</th>
                    <th className="text-center py-3 px-4 font-medium">Pipeline</th>
                    <th className="text-center py-3 px-4 font-medium">Status</th>
                    <th className="text-right py-3 px-4 font-medium">Price</th>
                    <th className="text-right py-3 px-4 font-medium">Days</th>
                    <th className="text-right py-3 px-4 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredVehicles.map((vehicle) => {
                    const daysInStock = calculateDaysInStock(vehicle)
                    const isAging = daysInStock > 60 && vehicle.status === 'available'
                    return (
                      <tr key={vehicle.id} className={`border-b last:border-0 hover:bg-muted/50 ${isAging ? 'bg-red-50' : ''}`}>
                        <td className="py-3 px-4 font-mono text-xs">{vehicle.stockNumber}</td>
                        <td className="py-3 px-4">
                          <p className="font-medium">{vehicle.year} {vehicle.make} {vehicle.model}</p>
                          <p className="text-xs text-muted-foreground">
                            {vehicle.trim && `${vehicle.trim} · `}
                            {vehicle.color && `${vehicle.color} · `}
                            {conditionLabels[vehicle.condition] || vehicle.condition}
                          </p>
                        </td>
                        <td className="py-3 px-4 font-mono text-xs">{vehicle.vin}</td>
                        <td className="py-3 px-4"><span className="font-mono text-xs">{vehicle.locationCode}</span>{vehicle.locationLabel && <p className="text-xs text-muted-foreground">{vehicle.locationLabel}</p>}</td>
                        <td className="py-3 px-4 text-center space-y-1">
                          <Badge variant="outline">Acquisition: {vehicle.acquisition?.status || 'none'}</Badge>
                          <Badge variant="outline">Recon: {vehicle.reconStatus}</Badge>
                          <Badge variant="outline">Merch: {vehicle.merchandisingStatus}</Badge>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <Badge className={statusColors[vehicle.status] || 'bg-gray-100 text-gray-700'}>
                            {vehicle.status}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 text-right font-medium">{formatCurrency(vehicle.price)}</td>
                        <td className="py-3 px-4 text-right">
                          <span className={isAging ? 'text-red-600 font-medium' : ''}>
                            {daysInStock}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right space-x-1">
                          <Button variant="ghost" size="sm" disabled={actionId === vehicle.inventoryStockId} onClick={() => moveStock(vehicle)}>Move</Button>
                          {vehicle.acquisition && ['arrived', 'reconditioning'].includes(vehicle.acquisition.status) && (
                            <Button variant="ghost" size="sm" disabled={actionId === vehicle.inventoryStockId} onClick={() => advanceAcquisition(vehicle)}>
                              {vehicle.acquisition.status === 'arrived' ? 'Begin recon' : 'Mark frontline'}
                            </Button>
                          )}
                          <Button variant="ghost" size="sm" disabled={actionId === vehicle.inventoryStockId || vehicle.reconStatus === 'completed' || Boolean(pendingReconStart)} onClick={() => advanceRecon(vehicle)}>
                            {vehicle.reconStatus === 'not-started' ? 'Open recon' : vehicle.reconStatus === 'in-progress' ? 'Advance recon' : 'Recon complete'}
                          </Button>
                          <Button variant="ghost" size="sm" disabled={actionId === vehicle.inventoryStockId} onClick={() => addInventoryCost(vehicle)}>Cost</Button>
                          <Button variant="ghost" size="sm" disabled={actionId === vehicle.inventoryStockId} onClick={() => editMerchandisingDraft(vehicle)}>Edit listing</Button>
                          {vehicle.merchandisingStatus !== 'approved' && (
                            <Button variant="outline" size="sm" disabled={actionId === vehicle.inventoryStockId || Boolean(pendingMerchandisingAttempt)} onClick={() => submitOrApproveMerchandising(vehicle)}>
                              {vehicle.merchandisingStatus === 'submitted' ? 'Approve' : 'Submit'}
                            </Button>
                          )}
                          <Button variant="outline" size="sm" aria-expanded={selectedVehicle?.id === vehicle.id} onClick={() => setSelectedVehicle(current => current?.id === vehicle.id ? null : vehicle)}>Details</Button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={Boolean(task)} onOpenChange={open => { if (!open && !actionId && !task?.reconCompletionAttempt) { setTask(null); setTaskError(null) } }}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{taskTitle}</DialogTitle>
            <DialogDescription>
              {task?.type === 'intake' ? 'Add an acquired vehicle to inventory.' :
                task?.type === 'edit' ? 'Update the listing price, odometer, description, and photo.' :
                  task?.type === 'recon-complete' ? 'Record the actual recon cost.' :
                    task?.type === 'recon-open' ? 'Add a recon work item for this vehicle.' :
                      task?.type === 'cost' ? 'Add a cost to this vehicle.' : 'Update the vehicle lot location.'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submitInventoryTask} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              {task?.type === 'intake' && <>
                {taskInput('vin', '17-character VIN', { required: true, maxLength: 17 })}
                {taskInput('stockNumber', 'Stock number')}
                {taskInput('year', 'Model year', { type: 'number', min: 1886, step: 1 })}
                {taskInput('make', 'Make')}
                {taskInput('model', 'Model')}
                {taskInput('mileage', 'Odometer', { type: 'number', min: 0, step: 1 })}
                {taskInput('purchaseDollars', `Purchase cost (${currencyCode})`, { inputMode: 'decimal' })}
                {taskInput('retailDollars', `Retail price (${currencyCode})`, { inputMode: 'decimal' })}
                {taskInput('locationCode', 'Lot location')}
              </>}
              {task?.type === 'edit' && <>
                {taskInput('retailDollars', `Retail price (${currencyCode})`, { inputMode: 'decimal' })}
                {taskInput('mileage', 'Odometer', { type: 'number', min: 0, step: 1 })}
              </>}
              {task?.type === 'move' && taskInput('locationCode', 'New lot location')}
              {task?.type === 'cost' && <>
                {taskInput('dollars', `Cost amount (${currencyCode})`, { inputMode: 'decimal' })}
                {taskInput('reference', 'Invoice or reference (optional)', { required: false })}
              </>}
              {task?.type === 'recon-open' && <>
                {taskInput('title', 'Work item')}
                {taskInput('estimatedDollars', `Estimated cost (${currencyCode})`, { inputMode: 'decimal' })}
              </>}
              {task?.type === 'recon-complete' && taskInput('actualDollars', `Actual cost (${currencyCode})`, { inputMode: 'decimal', disabled: Boolean(task.reconCompletionAttempt) })}
              {(task?.type === 'intake' || task?.type === 'edit') && <>
                <label htmlFor="inventory-task-description" className="grid gap-1.5 text-sm sm:col-span-2">
                  <span className="font-medium">Description{task.type === 'edit' ? '' : ' (optional)'}</span>
                  <Textarea id="inventory-task-description" required={task.type === 'edit'} value={task.fields.description || ''} onChange={event => updateTaskField('description', event.target.value)} rows={3} />
                </label>
                <label htmlFor="inventory-task-imagePath" className="grid gap-1.5 text-sm sm:col-span-2">
                  <span className="font-medium">Photo URL{task.type === 'edit' ? '' : ' (optional)'}</span>
                  <Input id="inventory-task-imagePath" required={task.type === 'edit'} value={task.fields.imagePath || ''} onChange={event => updateTaskField('imagePath', event.target.value)} placeholder="/inventory/vehicle.jpg" />
                </label>
              </>}
            </div>
            {taskError && <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">{taskError}</p>}
            <DialogFooter>
              <Button type="button" variant="outline" disabled={Boolean(actionId) || Boolean(task?.reconCompletionAttempt)} onClick={() => { setTask(null); setTaskError(null) }}>Cancel</Button>
              <Button type="submit" disabled={Boolean(actionId)}>{actionId ? 'Saving…' : task?.reconCompletionAttempt ? 'Retry' : 'Save'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
    </PageContainer>
  )
}
