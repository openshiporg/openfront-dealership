'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { fetchGraphQL } from '../../lib/graphql-client'
import { GET_VEHICLE_BY_ID } from '../../lib/queries'
import { Vehicle } from '../../lib/types'

const CREATE_LEAD = `
  mutation CreateLead($data: LeadCreateInput!) {
    createLead(data: $data) {
      id
      firstName
      lastName
      email
      phone
    }
  }
`

const CREATE_TEST_DRIVE = `
  mutation CreateTestDrive($data: TestDriveCreateInput!) {
    createTestDrive(data: $data) {
      id
      scheduledTime
      vehicle {
        id
        year
        make
        model
      }
    }
  }
`

export default function VehicleDetailPage({ params }: { params: { id: string } }) {
  const [vehicle, setVehicle] = useState<Vehicle | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeImageIndex, setActiveImageIndex] = useState(0)
  const [activeTab, setActiveTab] = useState<'overview' | 'features'>('overview')
  const [showContactModal, setShowContactModal] = useState(false)
  const [contactType, setContactType] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    message: '',
    preferredDate: '',
    preferredTime: '',
  })

  useEffect(() => {
    loadVehicle()
  }, [params.id])

  const loadVehicle = async () => {
    try {
      const data = await fetchGraphQL<{ vehicle: Vehicle }>(GET_VEHICLE_BY_ID, {
        id: params.id
      })
      setVehicle(data.vehicle)
    } catch (error) {
      console.error('Error loading vehicle:', error)
    } finally {
      setLoading(false)
    }
  }

  const openContactModal = (type: string) => {
    setContactType(type)
    setShowContactModal(true)
    setFormData({
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      message: '',
      preferredDate: '',
      preferredTime: '',
    })
  }

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!vehicle) return

    setIsSubmitting(true)

    try {
      if (contactType === 'test-drive') {
        // Create a Lead first
        const leadResponse = await fetchGraphQL<{ createLead: any }>(CREATE_LEAD, {
          data: {
            firstName: formData.firstName,
            lastName: formData.lastName,
            email: formData.email,
            phone: formData.phone,
            source: 'website',
            status: 'test-drive-scheduled',
            notes: formData.message || 'Test drive request from vehicle detail page',
            interestedVehicle: { connect: { id: vehicle.id } },
          },
        })

        // Create TestDrive with the scheduled time
        const scheduledTime = new Date(`${formData.preferredDate}T${formData.preferredTime}:00`)
        await fetchGraphQL(CREATE_TEST_DRIVE, {
          data: {
            lead: { connect: { id: leadResponse.createLead.id } },
            vehicle: { connect: { id: vehicle.id } },
            scheduledTime: scheduledTime.toISOString(),
            completed: false,
            driverLicenseVerified: false,
          },
        })

        alert('Test drive scheduled successfully! We will send you a confirmation email shortly.')
      } else {
        // Create a general lead
        await fetchGraphQL(CREATE_LEAD, {
          data: {
            firstName: formData.firstName,
            lastName: formData.lastName,
            email: formData.email,
            phone: formData.phone,
            source: 'website',
            status: 'new',
            notes: `${contactType === 'get-quote' ? 'Quote request' : 'General inquiry'}: ${formData.message || ''}`,
            interestedVehicle: { connect: { id: vehicle.id } },
          },
        })

        alert('Your request has been submitted! We will contact you shortly.')
      }

      setShowContactModal(false)
      setFormData({
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        message: '',
        preferredDate: '',
        preferredTime: '',
      })
    } catch (error) {
      console.error('Error submitting form:', error)
      alert('There was an error submitting your request. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="text-slate-600 mt-4">Loading vehicle details...</p>
        </div>
      </div>
    )
  }

  if (!vehicle) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Vehicle Not Found</h1>
          <Link href="/inventory" className="text-blue-600 hover:text-blue-800">
            Back to Inventory
          </Link>
        </div>
      </div>
    )
  }

  const primaryImage = vehicle.images?.find(img => img.isPrimary)
  const displayImages = vehicle.images || []
  const currentImage = displayImages[activeImageIndex]

  const features = typeof vehicle.features === 'string'
    ? JSON.parse(vehicle.features || '[]')
    : (vehicle.features || [])

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Breadcrumb */}
      <div className="bg-white border-b">
        <div className="container mx-auto px-4 py-3">
          <nav className="text-sm text-slate-600">
            <Link href="/inventory" className="hover:text-blue-600">Inventory</Link>
            <span className="mx-2">/</span>
            <span>{vehicle.year} {vehicle.make} {vehicle.model}</span>
          </nav>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Image Gallery - Left 2 columns */}
          <div className="lg:col-span-2">
            {/* Main Image */}
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="aspect-[16/9] bg-gray-200 relative">
                {currentImage?.image?.url ? (
                  <Image
                    src={currentImage.image.url}
                    alt={`${vehicle.year} ${vehicle.make} ${vehicle.model}`}
                    fill
                    className="object-cover"
                    sizes="(max-width: 1200px) 100vw, 66vw"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-400">
                    <svg className="w-32 h-32" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                )}
                {vehicle.condition === 'certified' && (
                  <div className="absolute top-4 left-4 bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-semibold">
                    CERTIFIED PRE-OWNED
                  </div>
                )}
                {vehicle.condition === 'new' && (
                  <div className="absolute top-4 left-4 bg-green-600 text-white px-4 py-2 rounded-md text-sm font-semibold">
                    NEW
                  </div>
                )}
              </div>
            </div>

            {/* Thumbnail Grid */}
            {displayImages.length > 0 && (
              <div className="grid grid-cols-6 gap-2 mt-4">
                {displayImages.map((image, index) => (
                  <button
                    key={image.id}
                    onClick={() => setActiveImageIndex(index)}
                    className={`aspect-square bg-gray-200 rounded overflow-hidden ${
                      index === activeImageIndex ? 'ring-2 ring-blue-600' : ''
                    }`}
                  >
                    {image.image?.url ? (
                      <Image
                        src={image.image.url}
                        alt={`View ${index + 1}`}
                        width={100}
                        height={100}
                        className="object-cover w-full h-full"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-400">
                        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Vehicle Info & Actions - Right column */}
          <div className="space-y-4">
            {/* Price Card */}
            <div className="bg-white rounded-lg shadow p-6">
              <h1 className="text-2xl font-bold">
                {vehicle.year} {vehicle.make} {vehicle.model}
              </h1>
              {vehicle.trim && (
                <p className="text-slate-600 mt-1">{vehicle.trim}</p>
              )}
              <div className="mt-4">
                <div className="text-4xl font-bold text-blue-600">
                  ${vehicle.price.toLocaleString()}
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div className="bg-slate-50 p-3 rounded">
                  <div className="text-slate-500 text-xs">Mileage</div>
                  <div className="font-semibold mt-1">{vehicle.mileage.toLocaleString()} mi</div>
                </div>
                <div className="bg-slate-50 p-3 rounded">
                  <div className="text-slate-500 text-xs">Condition</div>
                  <div className="font-semibold mt-1 capitalize">{vehicle.condition}</div>
                </div>
                <div className="bg-slate-50 p-3 rounded col-span-2">
                  <div className="text-slate-500 text-xs">Color</div>
                  <div className="font-semibold mt-1">{vehicle.color}</div>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="bg-white rounded-lg shadow p-6 space-y-3">
              <button
                onClick={() => openContactModal('contact')}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-semibold transition-colors"
              >
                Contact Us About This Vehicle
              </button>
              <button
                onClick={() => openContactModal('test-drive')}
                className="w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded-lg font-semibold transition-colors"
              >
                Schedule Test Drive
              </button>
              <button
                onClick={() => openContactModal('get-quote')}
                className="w-full border-2 border-blue-600 text-blue-600 hover:bg-blue-50 py-3 rounded-lg font-semibold transition-colors"
              >
                Get Price Quote
              </button>
              <Link
                href="/trade-in"
                className="w-full block text-center border-2 border-slate-300 hover:border-slate-400 py-3 rounded-lg font-semibold transition-colors"
              >
                Value Your Trade
              </Link>
              <Link
                href="/financing"
                className="w-full block text-center border-2 border-slate-300 hover:border-slate-400 py-3 rounded-lg font-semibold transition-colors"
              >
                Apply for Financing
              </Link>
            </div>

            {/* Stock Info */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="font-semibold mb-3 text-sm">Vehicle Information</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-600">Stock #:</span>
                  <span className="font-medium">{vehicle.stockNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">VIN:</span>
                  <span className="font-medium text-xs">{vehicle.vin}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Status:</span>
                  <span className="font-medium capitalize text-green-600">{vehicle.status}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Details Tabs */}
        <div className="mt-8">
          <div className="bg-white rounded-lg shadow">
            {/* Tab Headers */}
            <div className="border-b">
              <nav className="flex">
                <button
                  onClick={() => setActiveTab('overview')}
                  className={`px-6 py-4 font-medium ${
                    activeTab === 'overview'
                      ? 'border-b-2 border-blue-600 text-blue-600'
                      : 'text-slate-600 hover:text-slate-800'
                  }`}
                >
                  Overview
                </button>
                <button
                  onClick={() => setActiveTab('features')}
                  className={`px-6 py-4 font-medium ${
                    activeTab === 'features'
                      ? 'border-b-2 border-blue-600 text-blue-600'
                      : 'text-slate-600 hover:text-slate-800'
                  }`}
                >
                  Features & Specs
                </button>
              </nav>
            </div>

            {/* Tab Content */}
            <div className="p-6">
              {activeTab === 'overview' && (
                <div>
                  <h3 className="text-xl font-bold mb-4">Vehicle Description</h3>
                  {vehicle.description ? (
                    <p className="text-slate-600 leading-relaxed whitespace-pre-line">{vehicle.description}</p>
                  ) : (
                    <p className="text-slate-500 italic">No description available.</p>
                  )}

                  <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <h4 className="font-semibold mb-3 text-slate-800">Vehicle Details</h4>
                      <dl className="space-y-2">
                        <div className="flex justify-between py-2 border-b">
                          <dt className="text-slate-600">Year</dt>
                          <dd className="font-medium">{vehicle.year}</dd>
                        </div>
                        <div className="flex justify-between py-2 border-b">
                          <dt className="text-slate-600">Make</dt>
                          <dd className="font-medium">{vehicle.make}</dd>
                        </div>
                        <div className="flex justify-between py-2 border-b">
                          <dt className="text-slate-600">Model</dt>
                          <dd className="font-medium">{vehicle.model}</dd>
                        </div>
                        {vehicle.trim && (
                          <div className="flex justify-between py-2 border-b">
                            <dt className="text-slate-600">Trim</dt>
                            <dd className="font-medium">{vehicle.trim}</dd>
                          </div>
                        )}
                      </dl>
                    </div>
                    <div>
                      <h4 className="font-semibold mb-3 text-slate-800">Pricing & Availability</h4>
                      <dl className="space-y-2">
                        <div className="flex justify-between py-2 border-b">
                          <dt className="text-slate-600">Price</dt>
                          <dd className="font-bold text-blue-600">${vehicle.price.toLocaleString()}</dd>
                        </div>
                        <div className="flex justify-between py-2 border-b">
                          <dt className="text-slate-600">Mileage</dt>
                          <dd className="font-medium">{vehicle.mileage.toLocaleString()} miles</dd>
                        </div>
                        <div className="flex justify-between py-2 border-b">
                          <dt className="text-slate-600">Condition</dt>
                          <dd className="font-medium capitalize">{vehicle.condition}</dd>
                        </div>
                        <div className="flex justify-between py-2 border-b">
                          <dt className="text-slate-600">Status</dt>
                          <dd className="font-medium capitalize text-green-600">{vehicle.status}</dd>
                        </div>
                      </dl>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'features' && (
                <div>
                  <h3 className="text-xl font-bold mb-4">Features & Equipment</h3>
                  {Array.isArray(features) && features.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {features.map((feature: any, index: number) => {
                        const featureName = typeof feature === 'string' ? feature : feature.name || 'Feature'
                        return (
                          <div key={index} className="flex items-start gap-2">
                            <svg className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            <span className="text-slate-700">{featureName}</span>
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <p className="text-slate-500 italic">No features listed for this vehicle.</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Contact Modal */}
      {showContactModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold">
                {contactType === 'contact' && 'Contact Us'}
                {contactType === 'test-drive' && 'Schedule Test Drive'}
                {contactType === 'get-quote' && 'Get Price Quote'}
              </h3>
              <button
                onClick={() => setShowContactModal(false)}
                className="text-slate-400 hover:text-slate-600 text-2xl leading-none"
              >
                ×
              </button>
            </div>
            <p className="text-slate-600 mb-4">
              Interested in this {vehicle.year} {vehicle.make} {vehicle.model}? Fill out the form below and we'll get back to you shortly.
            </p>
            <form className="space-y-4" onSubmit={handleFormSubmit}>
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="text"
                  placeholder="First Name"
                  value={formData.firstName}
                  onChange={(e) => setFormData(prev => ({ ...prev, firstName: e.target.value }))}
                  className="w-full border rounded-md p-2 text-sm"
                  required
                />
                <input
                  type="text"
                  placeholder="Last Name"
                  value={formData.lastName}
                  onChange={(e) => setFormData(prev => ({ ...prev, lastName: e.target.value }))}
                  className="w-full border rounded-md p-2 text-sm"
                  required
                />
              </div>
              <input
                type="email"
                placeholder="Email"
                value={formData.email}
                onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                className="w-full border rounded-md p-2 text-sm"
                required
              />
              <input
                type="tel"
                placeholder="Phone"
                value={formData.phone}
                onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                className="w-full border rounded-md p-2 text-sm"
                required
              />
              {contactType === 'test-drive' && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-slate-600 mb-1">Preferred Date</label>
                      <input
                        type="date"
                        value={formData.preferredDate}
                        onChange={(e) => setFormData(prev => ({ ...prev, preferredDate: e.target.value }))}
                        className="w-full border rounded-md p-2 text-sm"
                        required
                        min={new Date().toISOString().split('T')[0]}
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-600 mb-1">Preferred Time</label>
                      <input
                        type="time"
                        value={formData.preferredTime}
                        onChange={(e) => setFormData(prev => ({ ...prev, preferredTime: e.target.value }))}
                        className="w-full border rounded-md p-2 text-sm"
                        required
                      />
                    </div>
                  </div>
                </>
              )}
              <textarea
                placeholder="Message (optional)"
                value={formData.message}
                onChange={(e) => setFormData(prev => ({ ...prev, message: e.target.value }))}
                rows={3}
                className="w-full border rounded-md p-2 text-sm"
              />
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-md font-semibold transition-colors disabled:bg-blue-400 disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'Submitting...' : 'Submit Request'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
