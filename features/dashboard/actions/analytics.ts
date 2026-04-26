'use server'

import { keystoneClient } from '@/features/dashboard/lib/keystoneClient'

export type SalesMetrics = {
  totalSales: number
  totalRevenue: number
  avgDealProfit: number
  salesByStatus: { status: string; count: number }[]
  salesByMonth: { month: string; count: number; revenue: number }[]
  salesByRep: { name: string; count: number; revenue: number }[]
  vehiclesSold: { make: string; count: number }[]
  topVehicles: { year: number; make: string; model: string; count: number }[]
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

export async function getSalesMetrics(): Promise<{ success: boolean; data?: SalesMetrics; error?: string }> {
  try {
    const query = `
      query GetDealsForMetrics {
        deals(where: { status: { in: ["delivered", "financed", "approved"] } }) {
          id
          vehiclePrice
          status
          saleDate
          createdAt
          salesperson { id name }
          vehicle { id make model year purchasePrice }
        }
      }
    `

    const response = await keystoneClient<{ deals: any[] }>(query)

    if (!response.success || !response.data) {
      return { success: false, error: response.error || 'Failed to fetch deals' }
    }

    const deals = response.data.deals || []

    const totalSales = deals.length
    const totalRevenue = deals.reduce((sum, d) => sum + (d.vehiclePrice || 0), 0)
    
    const profits = deals.map(d => {
      const salePrice = d.vehiclePrice || 0
      const cost = d.vehicle?.purchasePrice || 0
      return salePrice - cost
    }).filter(p => p > 0)
    const avgDealProfit = profits.length > 0 ? profits.reduce((s, p) => s + p, 0) / profits.length : 0

    const statusCounts: Record<string, number> = {}
    deals.forEach(d => {
      statusCounts[d.status] = (statusCounts[d.status] || 0) + 1
    })
    const salesByStatus = Object.entries(statusCounts).map(([status, count]) => ({ status, count }))

    const monthCounts: Record<string, { count: number; revenue: number }> = {}
    deals.forEach(d => {
      const date = d.saleDate || d.createdAt
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

    const vehicleCombos: Record<string, { year: number; make: string; model: string; count: number }> = {}
    deals.forEach(d => {
      if (d.vehicle) {
        const key = `${d.vehicle.year}-${d.vehicle.make}-${d.vehicle.model}`
        if (!vehicleCombos[key]) {
          vehicleCombos[key] = { year: d.vehicle.year, make: d.vehicle.make, model: d.vehicle.model, count: 0 }
        }
        vehicleCombos[key].count++
      }
    })
    const topVehicles = Object.values(vehicleCombos)
      .sort((a, b) => b.count - a.count)
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
  } catch (error) {
    console.error('Error fetching sales metrics:', error)
    return { success: false, error: 'Failed to fetch sales metrics' }
  }
}

export async function getInventoryMetrics(): Promise<{ success: boolean; data?: InventoryMetrics; error?: string }> {
  try {
    const query = `
      query GetVehiclesForMetrics {
        vehicles {
          id
          stockNumber
          make
          model
          year
          price
          purchasePrice
          status
          condition
          dateAcquired
          createdAt
        }
      }
    `

    const response = await keystoneClient<{ vehicles: any[] }>(query)

    if (!response.success || !response.data) {
      return { success: false, error: response.error || 'Failed to fetch vehicles' }
    }

    const vehicles = response.data.vehicles || []

    const now = new Date()
    const totalVehicles = vehicles.length
    const totalValue = vehicles.reduce((sum, v) => sum + (v.price || 0), 0)
    
    const daysInStockList = vehicles.map(v => {
      const acquiredDate = v.dateAcquired || v.createdAt
      if (!acquiredDate) return 0
      return Math.floor((now.getTime() - new Date(acquiredDate).getTime()) / (1000 * 60 * 60 * 24))
    })
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
        const acquiredDate = v.dateAcquired || v.createdAt
        if (!acquiredDate) return
        const days = Math.floor((now.getTime() - new Date(acquiredDate).getTime()) / (1000 * 60 * 60 * 24))
        if (days <= 30) agingBuckets['0-30']++
        else if (days <= 60) agingBuckets['31-60']++
        else if (days <= 90) agingBuckets['61-90']++
        else agingBuckets['90+']++
      })
    const agingBreakdown = Object.entries(agingBuckets).map(([range, count]) => ({ range, count }))

    const slowMoving = vehicles
      .filter(v => v.status === 'available')
      .map(v => {
        const acquiredDate = v.dateAcquired || v.createdAt
        const daysInStock = acquiredDate 
          ? Math.floor((now.getTime() - new Date(acquiredDate).getTime()) / (1000 * 60 * 60 * 24))
          : 0
        return {
          id: v.id,
          stockNumber: v.stockNumber,
          make: v.make,
          model: v.model,
          year: v.year,
          daysInStock,
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
  } catch (error) {
    console.error('Error fetching inventory metrics:', error)
    return { success: false, error: 'Failed to fetch inventory metrics' }
  }
}
