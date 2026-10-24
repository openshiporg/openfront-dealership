import type { OperatorActionField } from '../../components/OperatorActionDialog'

export type ServiceChoice = { value: string; label: string }

/** Storefront booking service keys (features/keystone/mutations/submitServiceBooking.ts). */
export const SERVICE_BOOKING_TYPES: ServiceChoice[] = [
  { value: 'oil_change', label: 'Oil change' },
  { value: 'brake_service', label: 'Brake service' },
  { value: 'battery_service', label: 'Battery service' },
  { value: 'diagnostics', label: 'Diagnostics' },
  { value: 'tire_service', label: 'Tire service' },
  { value: 'state_inspection', label: 'State inspection' },
  { value: 'scheduled_maintenance', label: 'Scheduled maintenance' },
  { value: 'repair', label: 'Repair' },
  { value: 'other', label: 'Other' },
]

export const EMPTY_BOOKING = {
  customerName: '',
  customerPhone: '',
  customerEmail: '',
  appointmentAt: '',
  serviceType: '',
  vehicleYear: '',
  vehicleMake: '',
  vehicleModel: '',
  description: '',
}

export function bookingFields(): OperatorActionField[] {
  return [
    { name: 'customerName', label: 'Customer name', maxLength: 200 },
    { name: 'customerPhone', label: 'Phone', type: 'text', maxLength: 50, placeholder: '(202) 555-0147' },
    { name: 'customerEmail', label: 'Email', type: 'email', maxLength: 320 },
    { name: 'appointmentAt', label: 'Date and time', type: 'datetime-local', description: 'Dealership time' },
    { name: 'serviceType', label: 'Service', type: 'select', options: SERVICE_BOOKING_TYPES },
    { name: 'vehicleYear', label: 'Vehicle year', type: 'number', min: 1900, max: new Date().getFullYear() + 1, step: 1 },
    { name: 'vehicleMake', label: 'Make', maxLength: 100 },
    { name: 'vehicleModel', label: 'Model', maxLength: 100 },
    { name: 'description', label: 'Concern', type: 'textarea', required: false, maxLength: 4000 },
  ]
}

/** Splits a datetime-local value into the date and 24h time the booking command reads in dealership time. */
export function splitLocalDateTime(value: string) {
  const match = value.trim().match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/)
  if (!match) throw new Error('Date and time are required')
  return { date: match[1], time: match[2] }
}

/**
 * Repair-order totals are stored on ServiceOrder. addServiceOrderLineItem recomputes them from the
 * lines (labor + sublet as labor, part as parts, plus stored tax), but openServiceOrder accepts
 * totals directly, so an order can carry amounts no line backs.
 */
export function repairOrderTotalsCheck(order: {
  lineItems: Array<{ itemType: string; priceCents: number }>
  laborTotalCents: number | null
  partsTotalCents: number | null
  taxCents: number | null
  grandTotalCents: number | null
}) {
  const sum = (types: string[]) => order.lineItems.filter(line => types.includes(line.itemType)).reduce((total, line) => total + (line.priceCents || 0), 0)
  const lineLaborCents = sum(['labor', 'sublet'])
  const linePartsCents = sum(['part'])
  const laborCents = order.laborTotalCents ?? 0
  const partsCents = order.partsTotalCents ?? 0
  const taxCents = order.taxCents ?? 0
  const matches =
    laborCents === lineLaborCents &&
    partsCents === linePartsCents &&
    (order.grandTotalCents ?? 0) === laborCents + partsCents + taxCents
  return { lineLaborCents, linePartsCents, matches }
}
