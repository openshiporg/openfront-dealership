'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { fetchGraphQL } from '../lib/graphql-client'
import { GET_VEHICLE_BY_ID } from '../lib/queries'
import { Vehicle } from '../lib/types'
import { getComparisonVehicles, removeFromComparison, clearComparison } from '../lib/comparison'

export default function ComparePage() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadComparisonVehicles()

    const handleComparisonUpdate = () => {
      loadComparisonVehicles()
    }

    window.addEventListener('comparison-updated', handleComparisonUpdate)
    return () => window.removeEventListener('comparison-updated', handleComparisonUpdate)
  }, [])

  const loadComparisonVehicles = async () => {
    setLoading(true)
    const vehicleIds = getComparisonVehicles()

    if (vehicleIds.length === 0) {
      setVehicles([])
      setLoading(false)
      return
    }

    try {
      const vehiclePromises = vehicleIds.map(id =>
        fetchGraphQL<{ vehicle: Vehicle }>(GET_VEHICLE_BY_ID, { id })
      )

      const results = await Promise.all(vehiclePromises)
      const loadedVehicles = results.map(result => result.vehicle).filter(v => v !== null)
      setVehicles(loadedVehicles)
    } catch (error) {
      console.error('Error loading comparison vehicles:', error)
      setVehicles([])
    } finally {
      setLoading(false)
    }
  }

  const handleRemove = (vehicleId: string) => {
    removeFromComparison(vehicleId)
  }

  const handleClearAll = () => {
    if (confirm('Are you sure you want to clear all vehicles from comparison?')) {
      clearComparison()
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="text-slate-600 mt-4">Loading comparison...</p>
        </div>
      </div>
    )
  }

  if (vehicles.length === 0) {
    return (
      <div className="min-h-screen bg-slate-50 py-12">
        <div className="container mx-auto px-4">
          <div className="max-w-2xl mx-auto text-center">
            <div className="bg-white rounded-lg shadow p-12">
              <svg className="w-24 h-24 mx-auto text-slate-300 mb-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              <h1 className="text-3xl font-bold mb-4">No Vehicles to Compare</h1>
              <p className="text-slate-600 mb-8">
                You haven't added any vehicles to compare yet. Browse our inventory and click the compare button on vehicles you're interested in.
              </p>
              <Link
                href="/inventory"
                className="inline-block bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-lg font-semibold transition-colors"
              >
                Browse Inventory
              </Link>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const comparisonFields = [
    { label: 'Price', key: 'price', format: (v: Vehicle) => `$${v.price.toLocaleString()}`, highlight: true },
    { label: 'Year', key: 'year', format: (v: Vehicle) => v.year, highlight: false },
    { label: 'Make', key: 'make', format: (v: Vehicle) => v.make, highlight: false },
    { label: 'Model', key: 'model', format: (v: Vehicle) => v.model, highlight: false },
    { label: 'Trim', key: 'trim', format: (v: Vehicle) => v.trim || 'N/A', highlight: false },
    { label: 'Mileage', key: 'mileage', format: (v: Vehicle) => `${v.mileage.toLocaleString()} mi`, highlight: true },
    { label: 'Condition', key: 'condition', format: (v: Vehicle) => v.condition || 'N/A', highlight: false },
    { label: 'Color', key: 'color', format: (v: Vehicle) => v.color || 'N/A', highlight: false },
    { label: 'MPG City', key: 'mpgCity', format: (v: Vehicle) => (v.features?.mpgCity || 'N/A'), highlight: true },
    { label: 'MPG Highway', key: 'mpgHighway', format: (v: Vehicle) => (v.features?.mpgHighway || 'N/A'), highlight: true },
    { label: 'VIN', key: 'vin', format: (v: Vehicle) => v.vin, highlight: false },
    { label: 'Stock #', key: 'stockNumber', format: (v: Vehicle) => v.stockNumber, highlight: false },
  ]

  // Helper function to check if a value is different from others
  const isDifferent = (field: any, vehicles: Vehicle[], currentVehicle: Vehicle) => {
    if (!field.highlight) return false
    const values = vehicles.map(v => field.format(v))
    const uniqueValues = new Set(values)
    return uniqueValues.size > 1
  }

  // Helper to find best/worst values for highlighting
  const getValueClass = (field: any, vehicle: Vehicle, allVehicles: Vehicle[]) => {
    if (!field.highlight) return ''

    const values = allVehicles.map(v => {
      const formatted = field.format(v)
      if (typeof formatted === 'string') {
        const num = parseFloat(formatted.replace(/[^0-9.-]/g, ''))
        return isNaN(num) ? null : num
      }
      return formatted
    }).filter(v => v !== null)

    if (values.length <= 1) return ''

    const currentValue = field.format(vehicle)
    const currentNum = typeof currentValue === 'string'
      ? parseFloat(currentValue.replace(/[^0-9.-]/g, ''))
      : currentValue

    if (isNaN(currentNum)) return ''

    // For price and mileage, lower is better
    if (field.key === 'price' || field.key === 'mileage') {
      const min = Math.min(...values as number[])
      return currentNum === min ? 'bg-green-50 text-green-700 font-bold' : ''
    }

    // For MPG, higher is better
    if (field.key.includes('mpg')) {
      const max = Math.max(...values as number[])
      return currentNum === max ? 'bg-green-50 text-green-700 font-bold' : ''
    }

    return ''
  }

  return (
    <div className="min-h-screen bg-slate-50 py-8">
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="mb-6">
          <div className="flex justify-between items-center mb-4">
            <h1 className="text-3xl font-bold">Compare Vehicles</h1>
            <div className="flex gap-3">
              <button
                onClick={handleClearAll}
                className="border-2 border-red-500 text-red-500 hover:bg-red-50 px-4 py-2 rounded-md font-semibold transition-colors"
              >
                Clear All
              </button>
              <Link
                href="/inventory"
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md font-semibold transition-colors"
              >
                Add More Vehicles
              </Link>
            </div>
          </div>
          <p className="text-slate-600 mb-2">
            Comparing {vehicles.length} vehicle{vehicles.length !== 1 ? 's' : ''}
          </p>
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-blue-600 font-semibold">★</span>
              <span className="text-slate-600">Key comparison metrics</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-green-50 border border-green-200 rounded"></div>
              <span className="text-slate-600">Best value highlighted</span>
            </div>
          </div>
        </div>

        {/* Comparison Table */}
        <div className="bg-white rounded-lg shadow overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="p-4 text-left font-semibold bg-slate-50 sticky left-0 z-10">Feature</th>
                {vehicles.map(vehicle => (
                  <th key={vehicle.id} className="p-4 min-w-[250px]">
                    <div className="relative">
                      {/* Vehicle Image */}
                      <div className="aspect-video bg-slate-200 rounded-lg overflow-hidden mb-3">
                        {vehicle.images?.[0]?.image?.url ? (
                          <Image
                            src={vehicle.images[0].image.url}
                            alt={`${vehicle.year} ${vehicle.make} ${vehicle.model}`}
                            width={300}
                            height={200}
                            className="object-cover w-full h-full"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-slate-400">
                            <svg className="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                            </svg>
                          </div>
                        )}
                      </div>

                      {/* Vehicle Title */}
                      <h3 className="text-lg font-bold mb-1">
                        {vehicle.year} {vehicle.make}
                      </h3>
                      <p className="text-slate-600 text-sm mb-2">{vehicle.model}</p>

                      {/* Remove Button */}
                      <button
                        onClick={() => handleRemove(vehicle.id)}
                        className="text-sm text-red-500 hover:text-red-700 font-medium"
                      >
                        Remove
                      </button>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {comparisonFields.map((field, idx) => (
                <tr key={field.key} className={idx % 2 === 0 ? 'bg-slate-50' : 'bg-white'}>
                  <td className="p-4 font-semibold text-slate-700 sticky left-0 z-10 bg-inherit border-r">
                    {field.label}
                    {field.highlight && (
                      <span className="ml-2 text-xs text-blue-600">★</span>
                    )}
                  </td>
                  {vehicles.map(vehicle => (
                    <td key={vehicle.id} className={`p-4 text-center ${getValueClass(field, vehicle, vehicles)}`}>
                      {field.format(vehicle)}
                    </td>
                  ))}
                </tr>
              ))}

              {/* Description Row */}
              <tr className="bg-white border-t-2">
                <td className="p-4 font-semibold text-slate-700 sticky left-0 z-10 bg-white border-r">
                  Description
                </td>
                {vehicles.map(vehicle => (
                  <td key={vehicle.id} className="p-4 text-sm text-slate-600 align-top">
                    {vehicle.description || 'No description available'}
                  </td>
                ))}
              </tr>

              {/* Action Buttons Row */}
              <tr className="bg-slate-50">
                <td className="p-4 font-semibold text-slate-700 sticky left-0 z-10 bg-slate-50 border-r">
                  Actions
                </td>
                {vehicles.map(vehicle => (
                  <td key={vehicle.id} className="p-4">
                    <div className="flex flex-col gap-2">
                      <Link
                        href={`/inventory/${vehicle.id}`}
                        className="bg-blue-600 hover:bg-blue-700 text-white text-center py-2 px-4 rounded-md font-semibold transition-colors text-sm"
                      >
                        View Details
                      </Link>
                      <Link
                        href={`/test-drive?vehicleId=${vehicle.id}`}
                        className="border-2 border-blue-600 text-blue-600 hover:bg-blue-50 text-center py-2 px-4 rounded-md font-semibold transition-colors text-sm"
                      >
                        Schedule Test Drive
                      </Link>
                    </div>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>

        {/* Bottom CTA */}
        <div className="mt-8 bg-blue-600 text-white rounded-lg p-6 text-center">
          <h2 className="text-2xl font-bold mb-2">Ready to Take the Next Step?</h2>
          <p className="mb-4 opacity-90">
            Schedule a test drive or contact us to learn more about these vehicles.
          </p>
          <div className="flex justify-center gap-4">
            <Link
              href="/contact"
              className="bg-white text-blue-600 px-6 py-3 rounded-md font-semibold hover:bg-slate-100 transition-colors"
            >
              Contact Us
            </Link>
            <a
              href="tel:5551234567"
              className="border-2 border-white hover:bg-white hover:text-blue-600 px-6 py-3 rounded-md font-semibold transition-colors"
            >
              Call (555) 123-4567
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
