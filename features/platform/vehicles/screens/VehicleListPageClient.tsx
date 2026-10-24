'use client'

import { useEffect, useRef, useState, type FormEvent } from 'react'
import Link from 'next/link'
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ClipboardList, History, MoreHorizontal, Plus, RefreshCw, Search, Upload } from 'lucide-react'
import { LiveVehiclePhotos, reorderPhotoIds, uploadVehiclePhoto, VehiclePhotoEditor } from '../components/VehiclePhotos'
import { PageContainer } from '@/features/dashboard/components/PageContainer'
import { basePath } from '@/features/dashboard/lib/config'
import {
  Code,
  DeskHeader,
  DeskSection,
  Facts,
  Notice,
  Panel,
  Pill,
  Readout,
  ReadoutStrip,
  Segmented,
  TitleLine,
  Track,
  type DeskTone,
} from '@/features/platform/components/desk'
import {
  type InventoryMake,
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
import { ACQUISITION_SOURCES, COST_TYPES, RECON_CATEGORIES, acquisitionSourceLabels, costTypeLabels, reconCategoryLabels } from '../lib/inventoryLabels'
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

type InventoryTaskType = 'intake' | 'edit' | 'photos' | 'move' | 'cost' | 'recon-open' | 'recon-complete'
type StagedPhoto = { id: string; file: File | null; url: string; name: string }
type InventoryTask = { type: InventoryTaskType; vehicle: Vehicle | null; reconWorkItem?: Vehicle['reconWorkItems'][number]; idempotencyKey: string; fields: Record<string, string>; reconCompletionAttempt?: ReconCompletionAttempt }

/** Accepts 33450, 33,450, $33,450.00 and 33450.5. */
function moneyInputCents(value: string) {
  const trimmed = value.trim().replace(/^\$\s*/, '')
  if (!/^(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d{1,2})?$/.test(trimmed)) return null
  const [whole, fraction = ''] = trimmed.replace(/,/g, '').split('.')
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, '0'))
  return Number.isSafeInteger(cents) && cents <= 2_147_483_647 ? cents : null
}

const statusTones: Record<string, DeskTone> = {
  available: 'ok',
  prep: 'info',
  pending: 'warn',
  hold: 'info',
  service: 'idle',
  sold: 'accent',
}

const statusLabels: Record<string, string> = {
  available: 'Available',
  prep: 'In prep',
  pending: 'Pending',
  hold: 'On hold',
  service: 'In service',
  sold: 'Sold',
}

const LOT_STATUSES = ['available', 'prep', 'pending', 'hold', 'service', 'sold'] as const

/** Intake stocks a unit as Vehicle.status `service` until it is marked frontline; that is prep, not a repair. */
function lotStage(vehicle: Vehicle) {
  return vehicle.status === 'service' && !vehicle.frontlineAt ? 'prep' : vehicle.status
}

/** The workspace filters on Vehicle.status; prep and service share `service`. */
function serverStatusFilter(stage: string) {
  return stage === 'prep' ? 'service' : stage
}

const acquisitionLabels: Record<string, string> = {
  appraised: 'Appraised',
  approved: 'Acquisition approved',
  purchased: 'Purchased',
  arrived: 'Arrived',
  reconditioning: 'Sent to recon',
  frontline: 'Frontline',
  cancelled: 'Acquisition cancelled',
}

const reconLabels: Record<string, string> = {
  'not-started': 'Recon not started',
  'in-progress': 'Recon in progress',
  completed: 'Recon done',
}

const listingLabels: Record<string, string> = {
  draft: 'Listing draft',
  submitted: 'Listing awaiting approval',
  approved: 'Listing approved',
  rejected: 'Listing rejected',
}

const conditionLabels: Record<string, string> = {
  new: 'New',
  used: 'Used',
  certified: 'Certified Pre-Owned',
}

const CONDITIONS = ['new', 'used', 'certified'] as const
const OTHER_MAKE = '__other'

function featureList(value: string) {
  return [...new Set(value.split(/[\n,]/).map(feature => feature.trim()).filter(Boolean))].slice(0, 100)
}

const fieldLabelClass = 'font-mono text-[11px] font-medium uppercase tracking-[0.1em] text-muted-foreground'

function countByStage(list: Vehicle[]) {
  return list.reduce<Record<string, number>>((counts, vehicle) => {
    const stage = lotStage(vehicle)
    counts[stage] = (counts[stage] || 0) + 1
    return counts
  }, {})
}

/** Reads the work items first; the stock-level status says "in progress" as soon as an item is opened. */
function reconLabel(vehicle: Vehicle) {
  const items = vehicle.reconWorkItems
  if (items.some(item => item.status === 'in-progress')) return 'Recon in progress'
  if (items.some(item => item.status === 'open')) return items.some(item => item.status === 'completed') ? 'Recon open' : 'Recon not started'
  if (vehicle.reconStatus === 'completed' || (items.length > 0 && items.every(item => ['completed', 'cancelled'].includes(item.status)))) return 'Recon done'
  return reconLabels[vehicle.reconStatus] || vehicle.reconStatus
}

/** What the merchandising gate (inventoryPublication.ts) will refuse, as the next step to take. */
function listingNeeds(vehicle: Vehicle): 'photos' | 'details' | null {
  if (!vehicle.images.length) return 'photos'
  if (!vehicle.description.trim() || vehicle.price <= 0) return 'details'
  return null
}

function hasOpenRecon(vehicle: Vehicle) {
  return vehicle.reconWorkItems.some(item => ['open', 'in-progress'].includes(item.status))
}


export function VehicleListPageClient({
  initialVehicles,
  initialIntakeRooftops,
  initialError,
  currencyCode,
  makes = [],
}: {
  initialVehicles: Vehicle[]
  initialIntakeRooftops: IntakeRooftop[]
  initialError: string | null
  currencyCode: string
  makes?: InventoryMake[]
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
  const [actionMessage, setActionMessageText] = useState<string | null>(null)
  const [actionTone, setActionTone] = useState<DeskTone>('idle')
  const setActionMessage = (message: string | null, tone: DeskTone = 'idle') => {
    setActionMessageText(message)
    setActionTone(tone)
  }
  const [pendingFeedRun, setPendingFeedRun] = useState<PublicFeedRunAttempt | null>(null)
  const [pendingMerchandisingAttempt, setPendingMerchandisingAttempt] = useState<MerchandisingCommandAttempt | null>(null)
  const [pendingReconStart, setPendingReconStart] = useState<ReconStartAttempt | null>(null)
  const [intakePhotos, setIntakePhotos] = useState<StagedPhoto[]>([])
  const [intakePhotoStatus, setIntakePhotoStatus] = useState<string | null>(null)
  const [lotCounts, setLotCounts] = useState<Record<string, number> | null>(() => initialError ? null : countByStage(initialVehicles))

  const isInitialLoad = useRef(true)
  /** The open task's unit as last loaded, so photo changes made in a dialog show straight away. */
  const currentTaskVehicle = task?.vehicle ? vehicles.find(vehicle => vehicle.inventoryStockId === task.vehicle!.inventoryStockId) ?? task.vehicle : null

  const loadVehicles = async () => {
    setLoading(true)
    setError(null)

    const response = await getInventoryWorkspace(serverStatusFilter(statusFilter))
    if (response.success) {
      const rooftops = response.intakeRooftops
      setIntakeRooftops(rooftops)
      setIntakeRooftopId(current => current || rooftops[0]?.id || '')
      setVehicles(statusFilter === 'all' ? response.vehicles : response.vehicles.filter(vehicle => lotStage(vehicle) === statusFilter))
      const counted = countByStage(response.vehicles)
      setLotCounts(current => {
        if (statusFilter === 'all') return counted
        if (!current) return current
        const stages = statusFilter === 'prep' || statusFilter === 'service' ? ['prep', 'service'] : [statusFilter]
        return { ...current, ...Object.fromEntries(stages.map(stage => [stage, counted[stage] || 0])) }
      })
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
      vin: '', stockNumber: '', year: String(new Date().getFullYear()), condition: 'used', makeChoice: '', make: '', model: '', trim: '',
      exteriorColor: '', interiorColor: '', features: '',
      purchaseDollars: '', retailDollars: '', mileage: '0', description: '', locationCode: 'INTAKE', acquisitionSource: 'dealer-transfer', sourceReference: '',
    } : type === 'edit' && vehicle ? {
      retailDollars: vehicle.price.toFixed(2), mileage: String(vehicle.mileage), description: vehicle.description,
    } : type === 'photos' ? {} : type === 'move' && vehicle ? { locationCode: vehicle.locationCode } : type === 'cost' ? { costType: 'other', dollars: '100', reference: '' } :
      type === 'recon-open' ? { title: '', category: 'inspection', estimatedDollars: '0' } : { actualDollars: '0' }
    setTaskError(null)
    setActionMessage(null)
    if (type === 'intake') clearIntakePhotos()
    setTask({ type, vehicle, reconWorkItem, idempotencyKey: `inventory-${type}:${vehicle?.inventoryStockId || crypto.randomUUID()}:${crypto.randomUUID()}`, fields })
  }

  const clearIntakePhotos = () => {
    setIntakePhotos(current => {
      current.forEach(photo => { if (photo.file) URL.revokeObjectURL(photo.url) })
      return []
    })
    setIntakePhotoStatus(null)
  }
  const closeTask = () => {
    setTask(null)
    setTaskError(null)
    clearIntakePhotos()
  }
  const stageIntakeFiles = (files: File[]) => setIntakePhotos(current => [
    ...current,
    ...files.map(file => ({ id: crypto.randomUUID(), file, url: URL.createObjectURL(file), name: file.name })),
  ])
  const stageIntakeUrl = (url: string) => setIntakePhotos(current => [...current, { id: crypto.randomUUID(), file: null, url, name: url.split('/').pop() || 'Photo' }])
  const moveIntakePhoto = (id: string, to: number) => setIntakePhotos(current => {
    const order = reorderPhotoIds(current.map(photo => photo.id), id, to)
    return order.map(photoId => current.find(photo => photo.id === photoId)!)
  })
  const removeIntakePhoto = (id: string) => setIntakePhotos(current => current.filter(photo => {
    if (photo.id === id && photo.file) URL.revokeObjectURL(photo.url)
    return photo.id !== id
  }))

  /** Intake photos go up after the unit is stocked, in the order shown; the first becomes primary. */
  const uploadIntakePhotos = async (stockId: string, idempotencyKey: string) => {
    let failed = 0
    for (const [index, photo] of intakePhotos.entries()) {
      setIntakePhotoStatus(`Uploading photo ${index + 1} of ${intakePhotos.length}`)
      try {
        const response = await uploadVehiclePhoto(stockId, photo, `${idempotencyKey}:photo:${photo.id}`)
        if (!response.success) failed += 1
      } catch {
        failed += 1
      }
    }
    setIntakePhotoStatus(null)
    return failed
  }

  const intakeVehicle = () => beginTask('intake')
  const editMerchandisingDraft = (vehicle: Vehicle) => beginTask('edit', vehicle)
  const managePhotos = (vehicle: Vehicle) => beginTask('photos', vehicle)
  const moveStock = (vehicle: Vehicle) => beginTask('move', vehicle)
  const addInventoryCost = (vehicle: Vehicle) => beginTask('cost', vehicle)

  const submitInventoryTask = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!task) return
    if (task.type === 'photos') {
      closeTask()
      return
    }
    const field = (name: string) => task.fields[name]?.trim() || ''
    const money = (name: string, label: string) => {
      const cents = moneyInputCents(field(name))
      if (cents == null) throw new Error(`${label} must be an amount such as 33,450 or 33450.00.`)
      return cents
    }
    setTaskError(null)
    setActionMessage(null)
    setActionId(task.vehicle?.inventoryStockId || 'intake')
    let reconCompletionAttempt: ReconCompletionAttempt | null = task.reconCompletionAttempt ?? null
    let taskSuccessMessage = 'Saved.'
    let taskSuccessTone: DeskTone = 'idle'
    try {
      let response: { success: boolean; error?: string } | undefined
      if (task.type === 'intake') {
        const vin = field('vin').toUpperCase()
        const stockNumber = field('stockNumber').toUpperCase()
        const year = Number(field('year'))
        const mileage = Number(field('mileage'))
        const make = makes.length && field('makeChoice') !== OTHER_MAKE ? field('makeChoice') : field('make')
        const model = field('model')
        const condition = field('condition')
        if (!CONDITIONS.includes(condition as typeof CONDITIONS[number])) throw new Error('Choose a condition.')
        const locationCode = field('locationCode').toUpperCase()
        const purchasePriceCents = money('purchaseDollars', 'Purchase cost')
        const priceCents = money('retailDollars', 'Retail price')
        if (!/^[A-HJ-NPR-Z0-9]{17}$/.test(vin)) throw new Error('Enter a valid 17-character VIN (I, O, and Q are not used).')
        if (!stockNumber || !make || !model || !locationCode || !Number.isInteger(year) || year < 1886 || year > new Date().getFullYear() + 1 || !Number.isSafeInteger(mileage) || mileage < 0 || priceCents <= 0) {
          throw new Error('Enter a stock number, valid model year, make, model, non-negative odometer, location, and positive retail price.')
        }
        const intakeResponse = await intakeInventoryVehicle({
          rooftopId: intakeRooftopId, idempotencyKey: task.idempotencyKey,
          reason: 'Vehicle acquired and stocked from inventory operations desk', acquisitionSource: ACQUISITION_SOURCES.includes(field('acquisitionSource') as typeof ACQUISITION_SOURCES[number]) ? field('acquisitionSource') : 'dealer-transfer', sourceReference: field('sourceReference') || 'operator-recorded',
          vin, stockNumber, year, make, model, trim: field('trim'), exteriorColor: field('exteriorColor'), interiorColor: field('interiorColor'),
          mileage, purchasePriceCents, listPriceCents: priceCents, priceCents,
          condition, description: field('description'), features: featureList(task.fields.features || ''), imagePath: '', locationCode, locationLabel: locationCode,
        })
        if (intakeResponse.success && intakePhotos.length) {
          const failed = await uploadIntakePhotos(intakeResponse.data.intakeInventoryVehicle.stockId, task.idempotencyKey)
          if (failed) {
            taskSuccessMessage = `Unit stocked. ${failed} of ${intakePhotos.length} photos did not upload; add them from Photos.`
            taskSuccessTone = 'warn'
          } else {
            taskSuccessMessage = `Unit stocked with ${intakePhotos.length} ${intakePhotos.length === 1 ? 'photo' : 'photos'}.`
          }
        }
        response = intakeResponse
      } else if (task.type === 'edit' && task.vehicle) {
        const priceCents = money('retailDollars', 'Retail price')
        const mileage = Number(field('mileage'))
        if (priceCents <= 0 || !Number.isSafeInteger(mileage) || mileage < 0 || !field('description')) throw new Error('Enter a positive retail price, non-negative odometer, and description.')
        // Photo changes in this dialog save on their own and move the stock revision forward.
        const current = currentTaskVehicle || task.vehicle
        response = await updateInventoryMerchandisingDraft({
          stockId: current.inventoryStockId, priceCents, listPriceCents: priceCents, mileage, description: field('description'),
          expectedUpdatedAt: current.stockUpdatedAt, reason: 'Listing draft updated from inventory operations desk', idempotencyKey: task.idempotencyKey,
        })
      } else if (task.type === 'move' && task.vehicle) {
        const locationCode = field('locationCode').toUpperCase()
        if (!locationCode) throw new Error('Lot location is required.')
        response = await moveInventoryStock({ stockId: task.vehicle.inventoryStockId, locationCode, locationLabel: locationCode, expectedUpdatedAt: task.vehicle.stockUpdatedAt, reason: 'Moved from inventory operations desk', idempotencyKey: task.idempotencyKey })
      } else if (task.type === 'cost' && task.vehicle) {
        const amountCents = money('dollars', 'Inventory cost')
        if (amountCents <= 0) throw new Error('Enter a positive inventory cost.')
        response = await recordInventoryCost({ stockId: task.vehicle.inventoryStockId, costType: COST_TYPES.includes(field('costType') as typeof COST_TYPES[number]) ? field('costType') : 'other', amountCents, reference: field('reference') || undefined, reason: 'Cost recorded from inventory operations desk', idempotencyKey: task.idempotencyKey })
      } else if (task.type === 'recon-open' && task.vehicle) {
        const title = field('title')
        if (!title) throw new Error('A reconditioning work item is required.')
        const estimatedCostCents = money('estimatedDollars', 'Estimated recon cost')
        response = await openInventoryReconWorkItem({ stockId: task.vehicle.inventoryStockId, title, category: RECON_CATEGORIES.includes(field('category') as typeof RECON_CATEGORIES[number]) ? field('category') : 'other', estimatedCostCents, reason: 'Opened from inventory operations desk', idempotencyKey: task.idempotencyKey })
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
        if (!reconResponse.success && reconResponse.rejected) {
          // Refused before anything was written: show why and let the amount be corrected.
          reconCompletionAttempt = null
          setTask(current => current && current.idempotencyKey === task.idempotencyKey ? { ...current, reconCompletionAttempt: undefined } : current)
          setTaskError(reconResponse.error)
          return
        }
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
      closeTask()
      setActionMessage(taskSuccessMessage, taskSuccessTone)
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
      setActionMessage('Finish recon and approve the listing before marking frontline.', 'warn')
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
    if (response.success) setActionMessage(toStatus === 'frontline' ? 'Marked frontline.' : 'Sent to recon.')
    else setActionMessage(response.error, 'bad')
    await loadVehicles()
    setActionId(null)
  }

  const executeMerchandisingAttempt = async (attempt: MerchandisingCommandAttempt) => {
    setPendingMerchandisingAttempt(attempt)
    setActionId(attempt.stockId)
    try {
      const response = attempt.kind !== 'submit'
        ? await decideInventoryMerchandising({ id: attempt.versionId, decision: attempt.decision, reason: attempt.reason, expectedUpdatedAt: attempt.expectedUpdatedAt, idempotencyKey: attempt.idempotencyKey })
        : await submitInventoryMerchandising({ stockId: attempt.stockId, reason: attempt.reason, idempotencyKey: attempt.idempotencyKey })
      if (!response.success && response.rejected) {
        setPendingMerchandisingAttempt(null)
        setActionMessage(response.error, 'bad')
        await loadVehicles()
        return
      }
      const result = resolveMerchandisingCommandResponse(
        response.success,
        response.success ? response.data[attempt.kind !== 'submit' ? 'decideInventoryMerchandising' : 'submitInventoryMerchandising'] : null,
        attempt
      )
      if (!result) {
        setPendingMerchandisingAttempt(attempt)
        setActionMessage(UNCONFIRMED_MERCHANDISING_COMMAND_MESSAGE, 'warn')
        return
      }
      setPendingMerchandisingAttempt(null)
      setActionMessage(merchandisingCommandResultMessage(attempt, result))
      await loadVehicles()
    } catch {
      setPendingMerchandisingAttempt(attempt)
      setActionMessage(UNCONFIRMED_MERCHANDISING_COMMAND_MESSAGE, 'warn')
    } finally {
      setActionId(null)
    }
  }

  const submitOrApproveMerchandising = async (vehicle: Vehicle) => {
    if (pendingMerchandisingAttempt) return
    const attempt = createMerchandisingCommandAttempt(vehicle.inventoryStockId, vehicle.latestMerchandisingVersion, () => crypto.randomUUID(), vehicle.publicListing.action)
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
      if (!response.success && response.rejected) {
        setPendingReconStart(null)
        setActionMessage(response.error, 'bad')
        await loadVehicles()
        return
      }
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
      if (!response.success && response.rejected) {
        setPendingFeedRun(null)
        setActionMessage(response.error, 'bad')
        await loadVehicles()
        return
      }
      const result = response.success ? normalizePublicFeedRunResult(response.data.recordInventoryFeedRun, attempt.stockIds.length) : null
      if (!result) {
        setPendingFeedRun(attempt)
        setActionMessage(UNCONFIRMED_PUBLIC_FEED_RUN_MESSAGE, 'warn')
        return
      }
      setActionMessage(publicFeedRunResultMessage(result))
      setPendingFeedRun(null)
      await loadVehicles()
    } catch {
      setPendingFeedRun(attempt)
      setActionMessage(UNCONFIRMED_PUBLIC_FEED_RUN_MESSAGE, 'warn')
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
  const taskInput = (name: string, label: string, options: { type?: string; required?: boolean; min?: number; step?: number; maxLength?: number; inputMode?: 'decimal' | 'numeric' | 'text'; disabled?: boolean; list?: string } = {}) => (
    <label key={name} htmlFor={`inventory-task-${name}`} className="grid gap-1.5 text-sm">
      <span className={fieldLabelClass}>{label}</span>
      <Input id={`inventory-task-${name}`} type={options.type || 'text'} inputMode={options.inputMode} min={options.min} step={options.step} maxLength={options.maxLength} required={options.required ?? true} disabled={options.disabled} list={options.list} value={task?.fields[name] || ''} onChange={event => updateTaskField(name, event.target.value)} />
    </label>
  )
  const taskSelect = (name: string, label: string, options: ReadonlyArray<{ value: string; label: string }>) => (
    <label key={name} htmlFor={`inventory-task-${name}`} className="grid gap-1.5 text-sm">
      <span className={fieldLabelClass}>{label}</span>
      <Select value={task?.fields[name] || ''} onValueChange={value => updateTaskField(name, value)}>
        <SelectTrigger id={`inventory-task-${name}`}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map(option => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
        </SelectContent>
      </Select>
    </label>
  )
  const taskTitle = task?.type === 'intake' ? 'Intake vehicle' : task?.type === 'edit' ? 'Edit listing draft' : task?.type === 'photos' ? 'Photos' : task?.type === 'move' ? 'Move inventory' : task?.type === 'cost' ? 'Record inventory cost' : task?.type === 'recon-open' ? 'Add recon work item' : 'Finish recon work item'
  const intakeMakeChoice = task?.type === 'intake' ? task.fields.makeChoice || '' : ''
  const intakeModels = makes.find(make => make.name === intakeMakeChoice)?.models || []

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

  const lotTotal = lotCounts ? Object.values(lotCounts).reduce((sum, count) => sum + count, 0) : undefined
  const statusOptions = [
    { value: 'all', label: 'All', count: lotTotal },
    ...LOT_STATUSES.map(status => ({ value: status, label: statusLabels[status], count: lotCounts ? lotCounts[status] || 0 : undefined, tone: statusTones[status] })),
  ]
  const reconOpenCount = filteredVehicles.filter(hasOpenRecon).length
  const intakeRooftopName = intakeRooftops.find(rooftop => rooftop.id === intakeRooftopId)?.name

  const header = (
    <DeskHeader
      title="Inventory"
      tone={error ? 'bad' : agingCount > 0 ? 'warn' : 'ok'}
      status={error ? 'Unavailable' : agingCount > 0 ? `${agingCount} aging units` : 'No aging units'}
      meta={[lotTotal !== undefined ? `${lotTotal} units` : null, intakeRooftopName].filter(Boolean).join(' · ') || undefined}
      actions={
        <>
          {intakeRooftops.length > 1 && (
            <Select value={intakeRooftopId} onValueChange={setIntakeRooftopId}>
              <SelectTrigger className="h-9 w-full rounded-full sm:w-[180px]" aria-label="Intake rooftop">
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
          <Track>
            <Pill onClick={loadVehicles} disabled={loading} aria-label="Refresh">
              <RefreshCw className={loading ? 'animate-spin' : undefined} />
              <span className="max-sm:sr-only">Refresh</span>
            </Pill>
            <Pill asChild>
              <Link href={`${basePath}/platform/vehicles/acquisitions`}><ClipboardList /><span className="max-sm:sr-only">Acquisitions</span></Link>
            </Pill>
            <Pill asChild>
              <Link href={`${basePath}/platform/vehicles/feed`}><History /><span className="max-sm:sr-only">Feed</span></Link>
            </Pill>
            <Pill onClick={intakeVehicle} disabled={actionId === 'intake' || !intakeRooftopId}>
              <Plus /> Intake
            </Pill>
            <Pill variant="primary" onClick={recordPublicFeed} disabled={actionId === 'feed'}>
              <Upload />
              {pendingFeedRun ? 'Retry publishing' : 'Publish feed'}
            </Pill>
          </Track>
        </>
      }
    />
  )

  const renderDetails = (vehicle: Vehicle) => (
    <div role="region" aria-label={`Vehicle details for ${vehicle.stockNumber}`} className="mt-3 grid gap-x-8 gap-y-3 rounded-lg bg-muted/40 p-3 sm:ml-4 lg:grid-cols-2">
      <Facts
        items={[
          { label: 'VIN', value: vehicle.vin, mono: true },
          { label: 'Stock #', value: vehicle.stockNumber, mono: true },
          { label: 'Location', value: vehicle.locationLabel || vehicle.locationCode },
          { label: 'Days in stock', value: calculateDaysInStock(vehicle), mono: true },
          { label: 'Retail', value: formatCurrency(vehicle.price), mono: true },
          { label: 'Cost', value: vehicle.purchasePrice == null ? 'Not recorded' : formatCurrency(vehicle.purchasePrice), mono: true },
        ]}
      />
      <Facts
        items={[
          { label: 'Acquisition', value: vehicle.acquisition ? acquisitionLabels[vehicle.acquisition.status] || vehicle.acquisition.status : 'None' },
          { label: 'Recon', value: reconLabel(vehicle) },
          { label: 'Listing', value: listingLabels[vehicle.merchandisingStatus] || vehicle.merchandisingStatus },
          { label: 'Storefront', value: vehicle.publicListing.live ? 'Live' : `Not live: ${vehicle.publicListing.reason || 'Not available'}` },
          { label: 'Feed', value: vehicle.feedStatus },
          { label: 'Colours', value: [vehicle.color, vehicle.interiorColor].filter(Boolean).join(' / ') || 'Not recorded' },
          { label: 'Photos', value: vehicle.images.length || 'None', mono: vehicle.images.length > 0 },
          { label: 'Recon items', value: vehicle.reconWorkItems.length, mono: true },
        ]}
      />
      <div className="min-w-0 border-t pt-3 text-sm lg:col-span-2">
        <p className={fieldLabelClass}>Listing</p>
        <p className="mt-1 break-words text-muted-foreground">{vehicle.description || 'No description'}</p>
      </div>
      <div className="lg:col-span-2">
        <Track>
          <Pill size="sm" asChild><Link href={`${basePath}/platform/vehicles/${vehicle.id}`}>Open vehicle</Link></Pill>
          <Pill size="sm" onClick={() => managePhotos(vehicle)}>Photos</Pill>
          <Pill size="sm" variant="plain" onClick={() => setSelectedVehicle(null)}>Close details</Pill>
        </Track>
      </div>
    </div>
  )

  return (
    <PageContainer title="Inventory" header={header} breadcrumbs={breadcrumbs}>
    <div className="min-w-0 max-w-full space-y-6 px-4 pb-24 md:px-6">
      {actionMessage && (
        <Notice tone={actionTone}>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <span>{actionMessage}</span>
            {pendingMerchandisingAttempt && (
              <Track>
                <Pill size="sm" onClick={retryMerchandisingAttempt} disabled={Boolean(actionId)}>Retry</Pill>
              </Track>
            )}
          </div>
        </Notice>
      )}
      {pendingReconStart && (
        <Notice tone="warn">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <span>{UNCONFIRMED_RECON_START_MESSAGE}</span>
            <Track>
              <Pill size="sm" onClick={retryReconStart} disabled={Boolean(actionId)}>Retry</Pill>
            </Track>
          </div>
        </Notice>
      )}

      <ReadoutStrip>
        <Readout label="Units" value={filteredVehicles.length} />
        <Readout label="Retail value" value={formatCurrency(totalValue)} sub="Available units" />
        <Readout label="Avg days" value={avgDaysInStock} sub="Available units" />
        <Readout label="Aging 60+" value={agingCount} tone={agingCount > 0 ? 'warn' : 'ok'} />
        <Readout label="Recon open" value={reconOpenCount} tone={reconOpenCount > 0 ? 'info' : 'idle'} />
      </ReadoutStrip>

      <div className="flex min-w-0 flex-col gap-3">
        <Segmented label="Filter by status" value={statusFilter} onChange={setStatusFilter} options={statusOptions} className="self-start" />
        <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative w-full sm:max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Stock #, VIN, make, model"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="rounded-full pl-9"
              aria-label="Search inventory"
            />
          </div>
          <Select value={sortOrder} onValueChange={setSortOrder}>
            <SelectTrigger className="w-full rounded-full sm:w-[180px]" aria-label="Sort inventory">
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
      </div>

      <DeskSection title={statusFilter === 'all' ? 'Lot' : statusLabels[statusFilter] || statusFilter} count={loading || error ? undefined : filteredVehicles.length}>
        {loading ? (
          <div className="flex items-center justify-center py-12" role="status">
            <RefreshCw className="size-5 animate-spin text-muted-foreground" aria-hidden="true" />
            <span className="sr-only">Loading inventory</span>
          </div>
        ) : error ? (
          <Notice tone="bad">
            <p className="font-medium">Unable to load inventory</p>
            <p className="mt-0.5 text-muted-foreground">{error}</p>
            <Track className="mt-2">
              <Pill size="sm" onClick={loadVehicles}>Retry</Pill>
            </Track>
          </Notice>
        ) : filteredVehicles.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-12 text-center">
            <p className="text-sm text-muted-foreground">{isFiltered ? 'No matches' : 'No vehicles'}</p>
            {isFiltered && (
              <Track>
                <Pill size="sm" onClick={resetFilters}>Reset filters</Pill>
              </Track>
            )}
          </div>
        ) : (
          <Panel className="divide-y">
            {filteredVehicles.map((vehicle) => {
              const daysInStock = calculateDaysInStock(vehicle)
              const isAging = daysInStock > 60 && vehicle.status === 'available'
              const busy = actionId === vehicle.inventoryStockId
              const stage = lotStage(vehicle)
              const isOpen = selectedVehicle?.id === vehicle.id
              const subline = [
                vehicle.color,
                conditionLabels[vehicle.condition] || vehicle.condition,
                vehicle.locationLabel || vehicle.locationCode,
              ].filter(Boolean)
              const acquisitionStatus = vehicle.acquisition?.status
              const activeRecon = vehicle.reconWorkItems.find(item => ['open', 'in-progress'].includes(item.status))
              const reconDone = vehicle.reconStatus === 'completed'
              const listingApproved = vehicle.merchandisingStatus === 'approved'
              const needs = listingNeeds(vehicle)
              // One step at a time: send to recon, work the recon items, approve the listing, then frontline.
              const actions: Array<{ key: string; label: string; onClick: () => void; disabled?: boolean }> = []
              if (acquisitionStatus === 'arrived' && vehicle.acquisition) {
                actions.push({ key: 'acquisition', label: 'Send to recon', onClick: () => advanceAcquisition(vehicle) })
              }
              if (!reconDone && acquisitionStatus !== 'arrived') {
                actions.push({
                  key: 'recon',
                  label: !activeRecon ? 'Add work item' : activeRecon.status === 'in-progress' ? 'Finish work' : 'Start work',
                  onClick: () => advanceRecon(vehicle),
                  disabled: Boolean(pendingReconStart),
                })
              }
              if (reconDone && (!listingApproved || vehicle.publicListing.action)) {
                const submits = vehicle.publicListing.action !== 'reapprove' && vehicle.merchandisingStatus !== 'submitted'
                const listingLabel = vehicle.publicListing.action === 'reapprove' ? 'Re-approve listing'
                  : vehicle.publicListing.action === 'resubmit' ? 'Resubmit listing'
                    : vehicle.merchandisingStatus === 'submitted' ? 'Approve listing' : 'Submit listing'
                // Submitting needs photos, a description and a price: offer the missing piece as the step.
                if (submits && needs === 'photos') actions.push({ key: 'listing', label: 'Add photos', onClick: () => managePhotos(vehicle) })
                else if (submits && needs === 'details') actions.push({ key: 'listing', label: 'Add description', onClick: () => editMerchandisingDraft(vehicle) })
                else actions.push({ key: 'listing', label: listingLabel, onClick: () => submitOrApproveMerchandising(vehicle), disabled: Boolean(pendingMerchandisingAttempt) })
              }
              if (acquisitionStatus === 'reconditioning' && vehicle.acquisition && reconDone && listingApproved && !vehicle.publicListing.action) {
                actions.push({ key: 'acquisition', label: 'Mark frontline', onClick: () => advanceAcquisition(vehicle) })
              }
              const showLive = stage === 'available' || stage === 'prep'
              const liveFlag = vehicle.publicListing.live
                ? <span className="text-emerald-700 dark:text-emerald-400">Live</span>
                : <span className={vehicle.publicListing.action || stage === 'available' ? 'text-amber-700 dark:text-amber-400' : undefined}>Not live: {vehicle.publicListing.reason || 'Not available'}</span>
              const statusParts = [
                acquisitionStatus && acquisitionStatus !== 'frontline' ? acquisitionLabels[acquisitionStatus] || acquisitionStatus : vehicle.frontlineAt ? 'Frontline' : null,
                reconLabel(vehicle),
                listingLabels[vehicle.merchandisingStatus] || vehicle.merchandisingStatus,
                !listingApproved && needs === 'photos' ? 'Needs photos' : !listingApproved && needs === 'details' ? 'Needs description' : null,
              ].filter(Boolean) as string[]
              return (
                <div key={vehicle.id} className="min-w-0 px-4 py-3">
                  <div className="flex min-w-0 flex-col gap-2 md:flex-row md:items-start md:justify-between md:gap-6">
                    <div className="min-w-0 flex-1">
                      <TitleLine as="h3" tone={statusTones[stage] || 'idle'} status={statusLabels[stage] || stage} className="text-sm font-medium text-foreground">
                        <Link href={`${basePath}/platform/vehicles/${vehicle.id}`} className="hover:underline">
                          {vehicle.year} {vehicle.make} {vehicle.model}
                          {vehicle.trim && <span className="font-normal text-muted-foreground"> {vehicle.trim}</span>}
                        </Link>
                      </TitleLine>
                      <p className="mt-0.5 flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5 pl-4 text-xs text-muted-foreground">
                        <Code className="text-foreground">{vehicle.stockNumber}</Code>
                        <Code><span title={vehicle.vin}>…{vehicle.vin.slice(-8)}</span></Code>
                        {subline.map(part => <span key={part}>{part}</span>)}
                      </p>
                      <p className="mt-0.5 flex min-w-0 flex-wrap gap-x-1.5 pl-4 font-mono text-[11px] uppercase tracking-[0.06em] text-muted-foreground">
                        <span>{statusLabels[stage] || stage}</span>
                        {statusParts.map(part => <span key={part}>· {part}</span>)}
                        {showLive && <span>· {liveFlag}</span>}
                      </p>
                    </div>
                    <dl className="grid shrink-0 grid-cols-3 gap-4 pl-4 text-xs md:pl-0 md:text-right">
                      <div className="min-w-0">
                        <dt className="sr-only">Mileage</dt>
                        <dd className="font-mono tabular-nums text-muted-foreground">{vehicle.mileage.toLocaleString('en-US')} mi</dd>
                      </div>
                      <div className="min-w-0 md:w-24">
                        <dt className="sr-only">Price</dt>
                        <dd className="text-sm font-semibold tabular-nums text-foreground">{formatCurrency(vehicle.price)}</dd>
                      </div>
                      <div className="min-w-0 md:w-14">
                        <dt className="sr-only">Days in stock</dt>
                        <dd className={`font-mono tabular-nums ${isAging ? 'font-semibold text-red-600 dark:text-red-400' : 'text-muted-foreground'}`}>{daysInStock}d</dd>
                      </div>
                    </dl>
                  </div>
                  <div className="mt-2 flex min-w-0 pl-4">
                    <Track>
                      {actions.map((action, index) => (
                        <Pill key={action.key} size="sm" variant={index === 0 ? 'primary' : undefined} disabled={busy || action.disabled} onClick={action.onClick}>
                          {action.label}
                        </Pill>
                      ))}
                      <Pill size="sm" variant={isOpen ? undefined : 'plain'} aria-expanded={isOpen} onClick={() => setSelectedVehicle(current => current?.id === vehicle.id ? null : vehicle)}>
                        Details
                      </Pill>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Pill size="sm" variant="plain" aria-label={`More actions for ${vehicle.stockNumber}`} disabled={busy}>
                            <MoreHorizontal />
                          </Pill>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild><Link href={`${basePath}/platform/vehicles/${vehicle.id}`}>Open vehicle</Link></DropdownMenuItem>
                          <DropdownMenuItem disabled={busy} onClick={() => moveStock(vehicle)}>Move</DropdownMenuItem>
                          <DropdownMenuItem disabled={busy} onClick={() => addInventoryCost(vehicle)}>Cost</DropdownMenuItem>
                          <DropdownMenuItem disabled={busy} onClick={() => editMerchandisingDraft(vehicle)}>Edit listing</DropdownMenuItem>
                          <DropdownMenuItem disabled={busy} onClick={() => managePhotos(vehicle)}>Photos</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </Track>
                  </div>
                  {isOpen && renderDetails(vehicle)}
                </div>
              )
            })}
          </Panel>
        )}
      </DeskSection>

      <Dialog open={Boolean(task)} onOpenChange={open => { if (!open && !actionId && !task?.reconCompletionAttempt) closeTask() }}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{taskTitle}</DialogTitle>
            <DialogDescription className="font-mono text-xs">
              {task?.vehicle
                ? `${task.vehicle.stockNumber} · ${task.vehicle.year} ${task.vehicle.make} ${task.vehicle.model}${task.reconWorkItem ? ` · ${task.reconWorkItem.title}` : ''}`
                : intakeRooftopName || 'New unit'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submitInventoryTask} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              {task?.type === 'intake' && <>
                {taskInput('vin', '17-character VIN', { required: true, maxLength: 17 })}
                {taskInput('stockNumber', 'Stock number')}
                {taskInput('year', 'Model year', { type: 'number', min: 1886, step: 1 })}
                <label htmlFor="inventory-task-condition" className="grid gap-1.5 text-sm">
                  <span className={fieldLabelClass}>Condition</span>
                  <Select value={task.fields.condition || 'used'} onValueChange={value => updateTaskField('condition', value)}>
                    <SelectTrigger id="inventory-task-condition">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CONDITIONS.map(condition => (
                        <SelectItem key={condition} value={condition}>{conditionLabels[condition]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </label>
                {makes.length > 0 ? (
                  <label htmlFor="inventory-task-makeChoice" className="grid gap-1.5 text-sm">
                    <span className={fieldLabelClass}>Make</span>
                    <Select value={intakeMakeChoice} onValueChange={value => { updateTaskField('makeChoice', value); updateTaskField('model', '') }}>
                      <SelectTrigger id="inventory-task-makeChoice">
                        <SelectValue placeholder="Choose make" />
                      </SelectTrigger>
                      <SelectContent>
                        {makes.map(make => (
                          <SelectItem key={make.id} value={make.name}>{make.name}</SelectItem>
                        ))}
                        <SelectItem value={OTHER_MAKE}>Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </label>
                ) : taskInput('make', 'Make', { maxLength: 100 })}
                {makes.length > 0 && intakeMakeChoice === OTHER_MAKE && taskInput('make', 'Other make', { maxLength: 100 })}
                {taskInput('model', 'Model', { maxLength: 100, list: intakeModels.length ? 'inventory-task-model-options' : undefined })}
                {intakeModels.length > 0 && (
                  <datalist id="inventory-task-model-options">
                    {intakeModels.map(model => <option key={model.id} value={model.name} />)}
                  </datalist>
                )}
                {taskInput('trim', 'Trim (optional)', { required: false, maxLength: 100 })}
                {taskInput('exteriorColor', 'Exterior colour (optional)', { required: false, maxLength: 100 })}
                {taskInput('interiorColor', 'Interior colour (optional)', { required: false, maxLength: 100 })}
                {taskInput('mileage', 'Odometer', { type: 'number', min: 0, step: 1 })}
                {taskInput('purchaseDollars', `Purchase cost (${currencyCode})`, { inputMode: 'decimal' })}
                {taskInput('retailDollars', `Retail price (${currencyCode})`, { inputMode: 'decimal' })}
                {taskInput('locationCode', 'Lot location')}
                {taskSelect('acquisitionSource', 'Acquired from', ACQUISITION_SOURCES.map(value => ({ value, label: acquisitionSourceLabels[value] })))}
                {taskInput('sourceReference', 'Source reference (optional)', { required: false, maxLength: 200 })}
              </>}
              {task?.type === 'edit' && <>
                {taskInput('retailDollars', `Retail price (${currencyCode})`, { inputMode: 'decimal' })}
                {taskInput('mileage', 'Odometer', { type: 'number', min: 0, step: 1 })}
              </>}
              {task?.type === 'move' && taskInput('locationCode', 'New lot location')}
              {task?.type === 'cost' && <>
                {taskSelect('costType', 'Cost type', COST_TYPES.map(value => ({ value, label: costTypeLabels[value] })))}
                {taskInput('dollars', `Cost amount (${currencyCode})`, { inputMode: 'decimal' })}
                {taskInput('reference', 'Invoice or reference (optional)', { required: false })}
              </>}
              {task?.type === 'recon-open' && <>
                {taskInput('title', 'Work item')}
                {taskSelect('category', 'Category', RECON_CATEGORIES.map(value => ({ value, label: reconCategoryLabels[value] })))}
                {taskInput('estimatedDollars', `Estimated cost (${currencyCode})`, { inputMode: 'decimal' })}
              </>}
              {task?.type === 'recon-complete' && taskInput('actualDollars', `Actual cost (${currencyCode})`, { inputMode: 'decimal', disabled: Boolean(task.reconCompletionAttempt) })}
              {task?.type === 'intake' && (
                <label htmlFor="inventory-task-features" className="grid gap-1.5 text-sm sm:col-span-2">
                  <span className={fieldLabelClass}>Features (optional, one per line)</span>
                  <Textarea id="inventory-task-features" value={task.fields.features || ''} onChange={event => updateTaskField('features', event.target.value)} rows={3} />
                </label>
              )}
              {(task?.type === 'intake' || task?.type === 'edit') && (
                <label htmlFor="inventory-task-description" className="grid gap-1.5 text-sm sm:col-span-2">
                  <span className={fieldLabelClass}>Description{task.type === 'edit' ? '' : ' (required to publish)'}</span>
                  <Textarea id="inventory-task-description" required={task.type === 'edit'} value={task.fields.description || ''} onChange={event => updateTaskField('description', event.target.value)} rows={3} />
                </label>
              )}
              {task?.type === 'intake' && (
                <VehiclePhotoEditor
                  label="Photos (required to publish)"
                  tiles={intakePhotos}
                  busy={Boolean(actionId)}
                  status={intakePhotoStatus}
                  onAddFiles={stageIntakeFiles}
                  onAddUrl={stageIntakeUrl}
                  onMove={moveIntakePhoto}
                  onRemove={removeIntakePhoto}
                />
              )}
              {(task?.type === 'edit' || task?.type === 'photos') && currentTaskVehicle && (
                <LiveVehiclePhotos
                  stockId={currentTaskVehicle.inventoryStockId}
                  images={currentTaskVehicle.images}
                  label={task.type === 'edit' ? 'Photos (saved as you change them)' : 'Photos (first is primary)'}
                  onChanged={loadVehicles}
                />
              )}
            </div>
            {taskError && <Notice tone="bad">{taskError}</Notice>}
            <DialogFooter className="sm:justify-end">
              <Track>
                {task?.type === 'photos' ? (
                  <Pill type="submit" variant="primary" className="max-sm:h-11">Done</Pill>
                ) : <>
                  <Pill variant="plain" className="max-sm:h-11" disabled={Boolean(actionId) || Boolean(task?.reconCompletionAttempt)} onClick={closeTask}>Cancel</Pill>
                  <Pill type="submit" variant="primary" className="max-sm:h-11" disabled={Boolean(actionId)}>{actionId ? 'Saving…' : task?.reconCompletionAttempt ? 'Retry' : 'Save'}</Pill>
                </>}
              </Track>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
    </PageContainer>
  )
}
