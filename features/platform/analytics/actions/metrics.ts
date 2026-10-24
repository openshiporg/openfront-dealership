'use server'

import { keystoneClient } from '@/features/dashboard/lib/keystoneClient'
import { dayKey } from '@/features/platform/lib/format'

export type SalesMetrics = {
  totalSales: number
  totalRevenue: number
  avgDealProfit: number
  salesByStatus: { status: string; count: number }[]
  salesByMonth: { month: string; count: number; revenue: number }[]
  salesByRep: { name: string; count: number; revenue: number }[]
  vehiclesSold: { make: string; count: number }[]
  topVehicles: { year: number; make: string; model: string; count: number; revenue: number }[]
}

export type InventoryMetrics = {
  totalVehicles: number
  totalValue: number
  avgDaysInStock: number
  vehiclesByStatus: { status: string; count: number }[]
  vehiclesByCondition: { condition: string; count: number }[]
  agingBreakdown: { range: string; count: number }[]
  slowMoving: { id: string; stockNumber: string; make: string; model: string; year: number; daysInStock: number; price: number }[]
}

export type ServiceMetrics = {
  totalAppointments: number
  todayAppointments: number
  activeRepairOrders: number
  closedRepairOrders: number
  serviceRevenue: number
  avgRepairOrder: number
  settledRepairOrders: number
  /** Denominator of the operational parts fill rate; 0 means there is no rate to show. */
  partsCommittedQuantity: number
  appointmentsByStatus: { status: string; count: number }[]
  repairOrdersByStatus: { status: string; count: number; revenue: number }[]
  serviceTypeBreakdown: { serviceType: string; count: number }[]
  lowStockParts: { id: string; partNumber: string; description: string; quantity: number; minimumQuantity: number; price: number }[]
}

// Totals are only reported over complete record sets: every read is capped,
// ordered with an id tie-break, and checked against its access-filtered count,
// so a truncated or shifting result fails instead of showing partial totals.
const METRICS_RECORD_BUDGET = 500
const PARTS_RECORD_BUDGET = 100

const DELIVERED_DEALS_WHERE = {
  AND: [{ status: { equals: 'delivered' } }, { saleDate: { not: null } }],
}

type RecordSet<T> = { ok: true; rows: T[] } | { ok: false; error: string }

function completeRecordSet<T>(label: string, rows: unknown, count: unknown, budget: number): RecordSet<T> {
  if (!Array.isArray(rows) || typeof count !== 'number' || !Number.isInteger(count) || count < 0) {
    console.error(`${label} metrics response was incomplete.`)
    return { ok: false, error: `${label} metrics are unavailable.` }
  }
  if (count > budget) {
    console.error(`${label} metrics exceed the record budget.`, { count, budget })
    return { ok: false, error: `${label} metrics are unavailable: ${count} records exceed the ${budget}-record analysis limit.` }
  }
  const ids = new Set(
    rows.map((row: any) => row?.id).filter((id: unknown): id is string => typeof id === 'string' && id.length > 0)
  )
  if (rows.length !== count || ids.size !== rows.length) {
    console.error(`${label} metrics record set was incomplete.`, { count, rows: rows.length, uniqueIds: ids.size })
    return { ok: false, error: `${label} metrics are unavailable because the records could not be verified as complete. Retry.` }
  }
  return { ok: true, rows: rows as T[] }
}

export async function getSalesMetrics(): Promise<{ success: boolean; data?: SalesMetrics; error?: string }> {
  try {
    const query = `
      query GetDealsForMetrics($where: DealWhereInput!, $take: Int!) {
        deals(where: $where, take: $take, orderBy: [{ id: asc }]) {
          id
          vehiclePrice
          totalPrice
          grossCents
          status
          saleDate
          salesperson { id name }
          vehicle { id make model year }
        }
        dealsCount(where: $where)
      }
    `

    const response = await keystoneClient<{ deals: any[]; dealsCount: number | null }>(query, {
      where: DELIVERED_DEALS_WHERE,
      take: METRICS_RECORD_BUDGET,
    })

    if (!response.success || !response.data) {
      return { success: false, error: response.error || 'Failed to fetch deals' }
    }

    const records = completeRecordSet<any>('Sales', response.data.deals, response.data.dealsCount, METRICS_RECORD_BUDGET)
    if (!records.ok) {
      return { success: false, error: records.error }
    }
    const deals = records.rows

    const totalSales = deals.length
    const totalRevenue = deals.reduce((sum, d) => sum + (d.vehiclePrice || 0), 0)

    const profits = deals.map(d => Number(d.grossCents || 0) / 100)
    const avgDealProfit = profits.length > 0 ? profits.reduce((sum, profit) => sum + profit, 0) / profits.length : 0

    const statusCounts: Record<string, number> = {}
    deals.forEach(d => {
      statusCounts[d.status] = (statusCounts[d.status] || 0) + 1
    })
    const salesByStatus = Object.entries(statusCounts).map(([status, count]) => ({ status, count }))

    const monthCounts: Record<string, { count: number; revenue: number }> = {}
    deals.forEach(d => {
      const date = d.saleDate
      if (date) {
        const month = new Date(date).toISOString().slice(0, 7)
        if (!monthCounts[month]) monthCounts[month] = { count: 0, revenue: 0 }
        monthCounts[month].count++
        monthCounts[month].revenue += d.vehiclePrice || 0
      }
    })
    const salesByMonth = Object.entries(monthCounts)
      .map(([month, data]) => ({ month, ...data }))
      .sort((a, b) => a.month.localeCompare(b.month))

    const repCounts: Record<string, { name: string; count: number; revenue: number }> = {}
    deals.forEach(d => {
      if (d.salesperson) {
        const id = d.salesperson.id
        if (!repCounts[id]) repCounts[id] = { name: d.salesperson.name || 'Unknown', count: 0, revenue: 0 }
        repCounts[id].count++
        repCounts[id].revenue += d.vehiclePrice || 0
      }
    })
    const salesByRep = Object.values(repCounts).sort((a, b) => b.count - a.count)

    const makeCounts: Record<string, number> = {}
    deals.forEach(d => {
      if (d.vehicle?.make) {
        makeCounts[d.vehicle.make] = (makeCounts[d.vehicle.make] || 0) + 1
      }
    })
    const vehiclesSold = Object.entries(makeCounts)
      .map(([make, count]) => ({ make, count }))
      .sort((a, b) => b.count - a.count)

    // Sold units are valued at the deal's sale price, never the vehicle's current list price.
    const salePrice = (d: any) => Number(d.vehiclePrice || d.totalPrice || 0)
    const vehicleCombos: Record<string, { year: number; make: string; model: string; count: number; revenue: number }> = {}
    deals.forEach(d => {
      if (d.vehicle) {
        const key = `${d.vehicle.year}-${d.vehicle.make}-${d.vehicle.model}`
        if (!vehicleCombos[key]) {
          vehicleCombos[key] = { year: d.vehicle.year, make: d.vehicle.make, model: d.vehicle.model, count: 0, revenue: 0 }
        }
        vehicleCombos[key].count++
        vehicleCombos[key].revenue += salePrice(d)
      }
    })
    const topVehicles = Object.values(vehicleCombos)
      .sort((a, b) => b.count - a.count || b.revenue - a.revenue)
      .slice(0, 10)

    return {
      success: true,
      data: {
        totalSales,
        totalRevenue,
        avgDealProfit,
        salesByStatus,
        salesByMonth,
        salesByRep,
        vehiclesSold,
        topVehicles,
      },
    }
  } catch {
    console.error('Sales metrics failed without logging provider details.')
    return { success: false, error: 'Failed to fetch sales metrics' }
  }
}

export async function getInventoryMetrics(): Promise<{ success: boolean; data?: InventoryMetrics; error?: string }> {
  try {
    const query = `
      query GetVehiclesForMetrics($take: Int!) {
        vehicles(take: $take, orderBy: [{ id: asc }]) {
          id
          stockNumber
          make
          model
          year
          price
          purchasePrice
          status
          condition
          inventoryStock { id stockedAt }
        }
        vehiclesCount
      }
    `

    const response = await keystoneClient<{ vehicles: any[]; vehiclesCount: number | null }>(query, {
      take: METRICS_RECORD_BUDGET,
    })

    if (!response.success || !response.data) {
      return { success: false, error: response.error || 'Failed to fetch vehicles' }
    }

    const records = completeRecordSet<any>('Inventory', response.data.vehicles, response.data.vehiclesCount, METRICS_RECORD_BUDGET)
    if (!records.ok) {
      return { success: false, error: records.error }
    }
    const vehicles = records.rows

    const now = new Date()
    const totalVehicles = vehicles.length
    const totalValue = vehicles.reduce((sum, v) => sum + (v.price || 0), 0)

    // Age runs from the stock record's stockedAt, not from when the vehicle row was created.
    // Units with no stock record have no age and are left out of the aging figures.
    const daysInStock = (v: any) => {
      const stockedAt = v.inventoryStock?.stockedAt
      if (!stockedAt) return null
      return Math.max(0, Math.floor((now.getTime() - new Date(stockedAt).getTime()) / (1000 * 60 * 60 * 24)))
    }
    const daysInStockList = vehicles
      .filter(v => v.status === 'available')
      .map(daysInStock)
      .filter((days): days is number => days !== null)
    const avgDaysInStock = daysInStockList.length > 0
      ? daysInStockList.reduce((s, d) => s + d, 0) / daysInStockList.length
      : 0

    const statusCounts: Record<string, number> = {}
    vehicles.forEach(v => {
      statusCounts[v.status || 'unknown'] = (statusCounts[v.status || 'unknown'] || 0) + 1
    })
    const vehiclesByStatus = Object.entries(statusCounts).map(([status, count]) => ({ status, count }))

    const conditionCounts: Record<string, number> = {}
    vehicles.forEach(v => {
      conditionCounts[v.condition || 'unknown'] = (conditionCounts[v.condition || 'unknown'] || 0) + 1
    })
    const vehiclesByCondition = Object.entries(conditionCounts).map(([condition, count]) => ({ condition, count }))

    const agingBuckets = { '0-30': 0, '31-60': 0, '61-90': 0, '90+': 0 }
    vehicles
      .filter(v => v.status === 'available')
      .forEach(v => {
        const days = daysInStock(v)
        if (days === null) return
        if (days <= 30) agingBuckets['0-30']++
        else if (days <= 60) agingBuckets['31-60']++
        else if (days <= 90) agingBuckets['61-90']++
        else agingBuckets['90+']++
      })
    const agingBreakdown = Object.entries(agingBuckets).map(([range, count]) => ({ range, count }))

    const slowMoving = vehicles
      .filter(v => v.status === 'available' && daysInStock(v) !== null)
      .map(v => {
        return {
          id: v.id,
          stockNumber: v.stockNumber,
          make: v.make,
          model: v.model,
          year: v.year,
          daysInStock: daysInStock(v) as number,
          price: v.price || 0,
        }
      })
      .sort((a, b) => b.daysInStock - a.daysInStock)
      .slice(0, 10)

    return {
      success: true,
      data: {
        totalVehicles,
        totalValue,
        avgDaysInStock,
        vehiclesByStatus,
        vehiclesByCondition,
        agingBreakdown,
        slowMoving,
      },
    }
  } catch {
    console.error('Inventory metrics failed without logging provider details.')
    return { success: false, error: 'Failed to fetch inventory metrics' }
  }
}

export async function getServiceMetrics(timeZone: string): Promise<{ success: boolean; data?: ServiceMetrics; error?: string }> {
  try {
    const query = `
      query GetServiceMetrics($take: Int!, $partsTake: Int!) {
        serviceAppointments(orderBy: [{ appointmentDate: desc }, { id: asc }], take: $take) {
          id
          appointmentDate
          serviceType
          status
          estimatedDuration
          customerVehicleDescription
          assignedTech { id name }
        }
        serviceAppointmentsCount
        serviceOrders(orderBy: [{ id: asc }], take: $take) {
          id
          status
          laborTotal
          partsTotal
          tax
          grandTotal
          completedAt
          appointment { id serviceType appointmentDate }
        }
        serviceOrdersCount
        partsInventories(orderBy: [{ quantity: asc }, { id: asc }], take: $partsTake) {
          id
          partNumber
          description
          quantity
          minimumQuantity
          committedQuantity
          price
        }
        partsInventoriesCount
      }
    `

    const response = await keystoneClient<{
      serviceAppointments: any[]
      serviceAppointmentsCount: number | null
      serviceOrders: any[]
      serviceOrdersCount: number | null
      partsInventories: any[]
      partsInventoriesCount: number | null
    }>(query, { take: METRICS_RECORD_BUDGET, partsTake: PARTS_RECORD_BUDGET })

    if (!response.success || !response.data) {
      return { success: false, error: response.error || 'Failed to fetch service metrics' }
    }

    const appointmentRecords = completeRecordSet<any>('Service appointment', response.data.serviceAppointments, response.data.serviceAppointmentsCount, METRICS_RECORD_BUDGET)
    if (!appointmentRecords.ok) return { success: false, error: appointmentRecords.error }
    const orderRecords = completeRecordSet<any>('Repair order', response.data.serviceOrders, response.data.serviceOrdersCount, METRICS_RECORD_BUDGET)
    if (!orderRecords.ok) return { success: false, error: orderRecords.error }
    const partRecords = completeRecordSet<any>('Parts', response.data.partsInventories, response.data.partsInventoriesCount, PARTS_RECORD_BUDGET)
    if (!partRecords.ok) return { success: false, error: partRecords.error }

    const appointments = appointmentRecords.rows
    const orders = orderRecords.rows
    const parts = partRecords.rows
    const today = dayKey(Date.now(), timeZone)

    const totalAppointments = appointments.length
    const todayAppointments = appointments.filter(appointment => (
      appointment.appointmentDate && appointment.status !== 'cancelled' && dayKey(appointment.appointmentDate, timeZone) === today
    )).length

    const activeRepairOrders = orders.filter(order => ['estimate', 'approved', 'in-progress'].includes(order.status)).length
    const closedOrders = orders.filter(order => ['completed', 'invoiced', 'paid'].includes(order.status))
    const settledOrders = orders.filter(order => order.status === 'paid')
    const closedRepairOrders = closedOrders.length
    const serviceRevenue = settledOrders.reduce((sum, order) => sum + (order.grandTotal || 0), 0)
    const avgRepairOrder = settledOrders.length > 0 ? serviceRevenue / settledOrders.length : 0

    const appointmentStatusCounts: Record<string, number> = {}
    appointments.forEach(appointment => {
      const status = appointment.status || 'unknown'
      appointmentStatusCounts[status] = (appointmentStatusCounts[status] || 0) + 1
    })
    const appointmentsByStatus = Object.entries(appointmentStatusCounts).map(([status, count]) => ({ status, count }))

    const orderStatusCounts: Record<string, { count: number; revenue: number }> = {}
    orders.forEach(order => {
      const status = order.status || 'unknown'
      if (!orderStatusCounts[status]) orderStatusCounts[status] = { count: 0, revenue: 0 }
      orderStatusCounts[status].count++
      orderStatusCounts[status].revenue += order.grandTotal || 0
    })
    const repairOrdersByStatus = Object.entries(orderStatusCounts).map(([status, data]) => ({ status, ...data }))

    const serviceTypeCounts: Record<string, number> = {}
    appointments.forEach(appointment => {
      const serviceType = appointment.serviceType || 'unknown'
      serviceTypeCounts[serviceType] = (serviceTypeCounts[serviceType] || 0) + 1
    })
    const serviceTypeBreakdown = Object.entries(serviceTypeCounts)
      .map(([serviceType, count]) => ({ serviceType, count }))
      .sort((a, b) => b.count - a.count)

    const lowStockParts = parts
      .filter(part => (part.minimumQuantity || 0) > 0 && (part.quantity || 0) <= (part.minimumQuantity || 0))
      .map(part => ({
        id: part.id,
        partNumber: part.partNumber,
        description: part.description,
        quantity: part.quantity || 0,
        minimumQuantity: part.minimumQuantity || 0,
        price: part.price || 0,
      }))
      .slice(0, 10)

    return {
      success: true,
      data: {
        totalAppointments,
        todayAppointments,
        activeRepairOrders,
        closedRepairOrders,
        serviceRevenue,
        avgRepairOrder,
        settledRepairOrders: settledOrders.length,
        partsCommittedQuantity: parts.reduce((sum, part) => sum + (part.committedQuantity || 0), 0),
        appointmentsByStatus,
        repairOrdersByStatus,
        serviceTypeBreakdown,
        lowStockParts,
      },
    }
  } catch {
    console.error('Service metrics failed without logging provider details.')
    return { success: false, error: 'Failed to fetch service metrics' }
  }
}
