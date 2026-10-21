import { SubmissionError } from './submissionErrors'
import { localScheduleIso } from '../utils/localSchedule.mjs'
import { assertPublishableInventory, lockInventoryStock } from '../lifecycle/inventoryPublication'

export function requiredText(value: unknown, label: string, maxLength = 500) {
  const text = String(value || '').trim()
  if (!text) throw new SubmissionError(`${label} is required.`)
  if (text.length > maxLength) throw new SubmissionError(`${label} must be ${maxLength} characters or fewer.`)
  return text
}

export function optionalText(value: unknown, maxLength = 4000, label = 'Value') {
  const text = String(value || '').trim()
  if (text.length > maxLength) throw new SubmissionError(`${label} must be ${maxLength} characters or fewer.`)
  return text
}

export function validEmail(value: unknown) {
  const email = requiredText(value, 'Email', 320).toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new SubmissionError('A valid email is required.')
  }
  return email
}

export function validPhone(value: unknown, required = true) {
  const phone = optionalText(value, 50, 'Phone')
  if (!phone && !required) return ''
  const digits = phone.replace(/\D/g, '')
  if (digits.length < 7 || digits.length > 15) throw new SubmissionError('A valid phone number is required.')
  return phone
}

export function finiteNumber(value: unknown, label: string, options: { min?: number; max?: number; integer?: boolean } = {}) {
  const number = Number(value)
  if (!Number.isFinite(number)) throw new SubmissionError(`${label} must be a finite number.`)
  if (options.integer && !Number.isInteger(number)) throw new SubmissionError(`${label} must be a whole number.`)
  if (options.min != null && number < options.min) throw new SubmissionError(`${label} must be at least ${options.min}.`)
  if (options.max != null && number > options.max) throw new SubmissionError(`${label} must be at most ${options.max}.`)
  return number
}

export function splitCustomerName(value: unknown, fallbackFirst = 'Website', fallbackLast = 'Customer') {
  const parts = requiredText(value, 'Customer name', 200).split(/\s+/).filter(Boolean)
  const firstName = parts.shift() || fallbackFirst
  const lastName = parts.length ? parts.join(' ') : fallbackLast
  return { firstName, lastName }
}

export function parseScheduledTime(dateValue: unknown, timeValue: unknown, label = 'Appointment', timezone = 'UTC') {
  const date = requiredText(dateValue, `${label} date`, 10)
  const time = requiredText(timeValue, `${label} time`, 20)
  const match = time.match(/^(\d{1,2}):(\d{2})(?:\s*([ap]m))?$/i)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !match) {
    throw new SubmissionError(`${label} date or time is invalid.`)
  }
  let hours = Number(match[1])
  const minutes = Number(match[2])
  const meridiem = match[3]?.toLowerCase()
  if (meridiem && (hours < 1 || hours > 12)) throw new SubmissionError(`${label} date or time is invalid.`)
  if (meridiem === 'pm' && hours < 12) hours += 12
  if (meridiem === 'am' && hours === 12) hours = 0
  if (hours > 23 || minutes > 59) throw new SubmissionError(`${label} date or time is invalid.`)
  let scheduled: Date
  try { scheduled = new Date(localScheduleIso(date, hours, minutes, timezone)) }
  catch { throw new SubmissionError(`${label} date or time is invalid or ambiguous in the dealership timezone.`) }
  const now = Date.now()
  if (scheduled.getTime() < now - 5 * 60 * 1000 || scheduled.getTime() > now + 366 * 24 * 60 * 60 * 1000) {
    throw new SubmissionError(`${label} must be within the next year.`)
  }
  return { iso: scheduled.toISOString(), date, time }
}

export const PUBLIC_SUBMISSION_VEHICLE_QUERY = `
  id vin stockNumber year make model trim exteriorColor interiorColor mileage condition description priceCents listPriceCents features status
  images { id imagePath image { id extension } caption category isPrimary sortOrder }
  rooftop { id status dealerGroup { id status } }
  inventoryStock {
    id stockNumber reconStatus merchandisingStatus approvedRevisionHash frontlineAt
    rooftop { id status dealerGroup { id status } }
    merchandisingVersions(orderBy: { version: desc }, take: 1) { id version status snapshot }
  }
`

function unavailableVehicle(): never {
  throw new SubmissionError(
    'The selected vehicle is no longer available. Please choose another vehicle.',
    404,
    'VEHICLE_NOT_AVAILABLE'
  )
}

export async function resolveAvailableVehicle(context: any, vehicleId: unknown, rooftopId: string) {
  const id = optionalText(vehicleId, 100, 'Vehicle')
  if (!id) return null

  // The client supplies only an ID; list/detail data and any old revision are not authority.
  const candidate = await context.sudo().query.Vehicle.findOne({
    where: { id },
    query: PUBLIC_SUBMISSION_VEHICLE_QUERY,
  })
  if (
    !candidate || candidate.rooftop?.id !== rooftopId ||
    !candidate.inventoryStock?.id || candidate.inventoryStock.rooftop?.id !== rooftopId
  ) unavailableVehicle()

  // Serialize with publication commands, then hold rows touched by availability and
  // publication invalidation until the enclosing intake transaction commits.
  await lockInventoryStock(context, candidate.inventoryStock.id)
  await context.prisma.$queryRaw`SELECT "id" FROM "Vehicle" WHERE "id" = ${candidate.id} FOR SHARE`
  await context.prisma.$queryRaw`SELECT "id" FROM "VehicleImage" WHERE "vehicle" = ${candidate.id} FOR SHARE`
  await context.prisma.$queryRaw`SELECT "id" FROM "InventoryStock" WHERE "id" = ${candidate.inventoryStock.id} FOR SHARE`

  const vehicle = await context.sudo().query.Vehicle.findOne({
    where: { id },
    query: PUBLIC_SUBMISSION_VEHICLE_QUERY,
  })
  if (
    !vehicle || vehicle.inventoryStock?.id !== candidate.inventoryStock.id ||
    vehicle.status !== 'available' ||
    vehicle.rooftop?.id !== rooftopId ||
    vehicle.rooftop?.status !== 'active' ||
    vehicle.rooftop?.dealerGroup?.status !== 'active' ||
    vehicle.inventoryStock?.rooftop?.id !== rooftopId ||
    vehicle.inventoryStock?.rooftop?.status !== 'active' ||
    vehicle.inventoryStock?.rooftop?.dealerGroup?.status !== 'active' ||
    vehicle.inventoryStock?.rooftop?.dealerGroup?.id !== vehicle.rooftop?.dealerGroup?.id ||
    vehicle.inventoryStock?.reconStatus !== 'completed' ||
    vehicle.inventoryStock?.merchandisingStatus !== 'approved' ||
    !vehicle.inventoryStock?.approvedRevisionHash ||
    !vehicle.inventoryStock?.frontlineAt
  ) unavailableVehicle()

  try {
    // Keystone's GraphQL image field is nested; the canonical revision digest
    // uses Prisma's stored image columns. Normalize only this projection shape.
    const revisionVehicle = { ...vehicle, images: (vehicle.images || []).map((image: any) => ({
      ...image, image_id: image.image?.id ?? null, image_extension: image.image?.extension ?? null,
    })) }
    assertPublishableInventory({ ...vehicle.inventoryStock, vehicle: revisionVehicle })
  } catch {
    unavailableVehicle()
  }
  return vehicle
}

export function formatCurrency(value: unknown) {
  const number = Number(value || 0)
  return new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD', maximumFractionDigits: 0,
  }).format(number)
}
