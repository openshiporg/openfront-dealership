import { Vehicle } from './types'

const COMPARISON_KEY = 'vehicle-comparison'
const MAX_COMPARE = 4

export const getComparisonVehicles = (): string[] => {
  if (typeof window === 'undefined') return []
  const stored = localStorage.getItem(COMPARISON_KEY)
  return stored ? JSON.parse(stored) : []
}

export const addToComparison = (vehicleId: string): boolean => {
  const current = getComparisonVehicles()

  if (current.includes(vehicleId)) {
    return false // Already in comparison
  }

  if (current.length >= MAX_COMPARE) {
    return false // Max limit reached
  }

  const updated = [...current, vehicleId]
  localStorage.setItem(COMPARISON_KEY, JSON.stringify(updated))

  // Dispatch custom event to notify other components
  window.dispatchEvent(new Event('comparison-updated'))

  return true
}

export const removeFromComparison = (vehicleId: string): void => {
  const current = getComparisonVehicles()
  const updated = current.filter(id => id !== vehicleId)
  localStorage.setItem(COMPARISON_KEY, JSON.stringify(updated))

  // Dispatch custom event to notify other components
  window.dispatchEvent(new Event('comparison-updated'))
}

export const clearComparison = (): void => {
  localStorage.removeItem(COMPARISON_KEY)
  window.dispatchEvent(new Event('comparison-updated'))
}

export const isInComparison = (vehicleId: string): boolean => {
  return getComparisonVehicles().includes(vehicleId)
}

export const getComparisonCount = (): number => {
  return getComparisonVehicles().length
}

export const canAddToComparison = (): boolean => {
  return getComparisonCount() < MAX_COMPARE
}
