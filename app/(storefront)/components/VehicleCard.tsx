'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Vehicle } from '../lib/types'
import { addToComparison, removeFromComparison, isInComparison } from '../lib/comparison'

interface VehicleCardProps {
  vehicle: Vehicle
  showCompareButton?: boolean
}

export function VehicleCard({ vehicle, showCompareButton = true }: VehicleCardProps) {
  const [isComparing, setIsComparing] = useState(false)

  useEffect(() => {
    setIsComparing(isInComparison(vehicle.id))

    const handleComparisonUpdate = () => {
      setIsComparing(isInComparison(vehicle.id))
    }

    window.addEventListener('comparison-updated', handleComparisonUpdate)
    return () => window.removeEventListener('comparison-updated', handleComparisonUpdate)
  }, [vehicle.id])

  const handleCompareToggle = () => {
    if (isComparing) {
      removeFromComparison(vehicle.id)
    } else {
      const added = addToComparison(vehicle.id)
      if (!added) {
        alert('You can only compare up to 4 vehicles at a time.')
      }
    }
  }
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(price)
  }

  const formatMileage = (mileage: number) => {
    return new Intl.NumberFormat('en-US').format(mileage)
  }

  // Get the primary image or first image
  const primaryImage = vehicle.images?.find(img => img.isPrimary)
  const imageUrl = primaryImage?.image?.url || vehicle.images?.[0]?.image?.url || '/placeholder-car.jpg'

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-xl transition-shadow duration-300">
      <Link href={`/inventory/${vehicle.id}`} className="block">
        <div className="relative h-56 bg-gray-200">
          {imageUrl !== '/placeholder-car.jpg' ? (
            <Image
              src={imageUrl}
              alt={`${vehicle.year} ${vehicle.make} ${vehicle.model}`}
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-400">
              <svg className="w-20 h-20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
              </svg>
            </div>
          )}
          {vehicle.condition === 'certified' && (
            <div className="absolute top-3 left-3 bg-blue-600 text-white px-3 py-1 rounded-md text-sm font-semibold">
              CERTIFIED
            </div>
          )}
          {vehicle.condition === 'new' && (
            <div className="absolute top-3 right-3 bg-green-600 text-white px-3 py-1 rounded-md text-sm font-semibold">
              NEW
            </div>
          )}
        </div>
      </Link>

      <div className="p-5">
        <Link href={`/inventory/${vehicle.id}`}>
          <h3 className="text-xl font-bold text-gray-900 hover:text-blue-600 transition-colors mb-2">
            {vehicle.year} {vehicle.make} {vehicle.model}
          </h3>
          {vehicle.trim && (
            <p className="text-gray-600 text-sm mb-3">{vehicle.trim}</p>
          )}
        </Link>

        <div className="mb-4">
          <div className="text-3xl font-bold text-blue-600 mb-1">
            {formatPrice(vehicle.price)}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-4 text-sm">
          <div className="flex items-center text-gray-600">
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            {formatMileage(vehicle.mileage)} mi
          </div>
          <div className="flex items-center text-gray-600">
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
            </svg>
            {vehicle.condition}
          </div>
          <div className="flex items-center text-gray-600 col-span-2">
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
            </svg>
            {vehicle.color}
          </div>
        </div>

        <div className="flex gap-2">
          <Link
            href={`/inventory/${vehicle.id}`}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-center py-2 px-4 rounded-md font-semibold transition-colors"
          >
            View Details
          </Link>
          {showCompareButton && (
            <button
              onClick={handleCompareToggle}
              className={`border-2 py-2 px-4 rounded-md font-semibold transition-colors ${
                isComparing
                  ? 'border-blue-600 bg-blue-50 text-blue-600'
                  : 'border-gray-300 hover:border-blue-600 text-gray-700 hover:text-blue-600'
              }`}
              title={isComparing ? 'Remove from comparison' : 'Add to comparison'}
            >
              {isComparing ? (
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
