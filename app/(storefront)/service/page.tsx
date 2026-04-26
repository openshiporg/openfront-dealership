'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function ServicePage() {
  const router = useRouter()

  const [formData, setFormData] = useState({
    customerName: '',
    customerEmail: '',
    customerPhone: '',
    appointmentDate: '',
    appointmentTime: '',
    serviceType: '',
    vehicleYear: '',
    vehicleMake: '',
    vehicleModel: '',
    vehicleVin: '',
    description: ''
  })

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle')

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setSubmitStatus('idle')

    try {
      const response = await fetch('/api/service-appointment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          vehicleYear: formData.vehicleYear ? parseInt(formData.vehicleYear) : undefined
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to submit service appointment')
      }

      setSubmitStatus('success')
      setFormData({
        customerName: '',
        customerEmail: '',
        customerPhone: '',
        appointmentDate: '',
        appointmentTime: '',
        serviceType: '',
        vehicleYear: '',
        vehicleMake: '',
        vehicleModel: '',
        vehicleVin: '',
        description: ''
      })

      setTimeout(() => {
        router.push('/')
      }, 3000)
    } catch (error) {
      console.error('Error submitting service appointment:', error)
      setSubmitStatus('error')
    } finally {
      setIsSubmitting(false)
    }
  }

  const minDate = new Date().toISOString().split('T')[0]

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Hero Section */}
      <section className="bg-gradient-to-r from-slate-900 to-slate-800 text-white py-16">
        <div className="container mx-auto px-4">
          <h1 className="text-4xl font-bold mb-4">Service Department</h1>
          <p className="text-xl text-slate-300 max-w-2xl">
            Expert service and maintenance for all makes and models. Schedule your appointment today.
          </p>
        </div>
      </section>

      {/* Service Specials */}
      <section className="py-12 bg-blue-50 border-y border-blue-100">
        <div className="container mx-auto px-4">
          <h2 className="text-2xl font-bold text-center mb-8">Current Service Specials</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            <div className="bg-white rounded-lg p-6 shadow-md border-2 border-blue-200">
              <div className="text-center mb-4">
                <div className="text-4xl font-bold text-blue-600">$29.95</div>
                <div className="text-sm text-slate-600">Regular $49.95</div>
              </div>
              <h3 className="font-bold text-lg mb-2">Oil Change Special</h3>
              <p className="text-sm text-slate-600 mb-4">
                Includes up to 5 quarts of conventional oil, filter, and multi-point inspection.
              </p>
              <div className="text-xs text-slate-500 border-t pt-3">
                Valid through: End of month
              </div>
            </div>

            <div className="bg-white rounded-lg p-6 shadow-md border-2 border-blue-200">
              <div className="text-center mb-4">
                <div className="text-4xl font-bold text-blue-600">$89.95</div>
                <div className="text-sm text-slate-600">Save $40</div>
              </div>
              <h3 className="font-bold text-lg mb-2">Brake Inspection</h3>
              <p className="text-sm text-slate-600 mb-4">
                Complete brake system inspection with complimentary rotor measurement.
              </p>
              <div className="text-xs text-slate-500 border-t pt-3">
                Valid through: End of month
              </div>
            </div>

            <div className="bg-white rounded-lg p-6 shadow-md border-2 border-blue-200">
              <div className="text-center mb-4">
                <div className="text-4xl font-bold text-blue-600">$59.95</div>
                <div className="text-sm text-slate-600">Save $30</div>
              </div>
              <h3 className="font-bold text-lg mb-2">Tire Rotation</h3>
              <p className="text-sm text-slate-600 mb-4">
                Professional tire rotation and balance with free tire pressure check.
              </p>
              <div className="text-xs text-slate-500 border-t pt-3">
                Valid through: End of month
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Services Overview */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-12">Our Services</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <div className="bg-slate-50 p-6 rounded-lg">
              <div className="text-blue-600 mb-4">
                <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-2">Oil Changes</h3>
              <p className="text-slate-600">
                Quick and professional oil changes using high-quality synthetic or conventional oil.
              </p>
            </div>

            <div className="bg-slate-50 p-6 rounded-lg">
              <div className="text-blue-600 mb-4">
                <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-2">Brake Service</h3>
              <p className="text-slate-600">
                Complete brake inspections, pad replacements, and rotor resurfacing.
              </p>
            </div>

            <div className="bg-slate-50 p-6 rounded-lg">
              <div className="text-blue-600 mb-4">
                <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-2">Battery Service</h3>
              <p className="text-slate-600">
                Battery testing, charging, and replacement with premium batteries.
              </p>
            </div>

            <div className="bg-slate-50 p-6 rounded-lg">
              <div className="text-blue-600 mb-4">
                <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-2">Diagnostics</h3>
              <p className="text-slate-600">
                Advanced computer diagnostics to identify and resolve any issues.
              </p>
            </div>

            <div className="bg-slate-50 p-6 rounded-lg">
              <div className="text-blue-600 mb-4">
                <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-2">Tire Service</h3>
              <p className="text-slate-600">
                Tire rotation, balancing, alignment, and new tire installation.
              </p>
            </div>

            <div className="bg-slate-50 p-6 rounded-lg">
              <div className="text-blue-600 mb-4">
                <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-2">State Inspections</h3>
              <p className="text-slate-600">
                Complete state safety and emissions inspections.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Appointment Form */}
      <section className="py-16 bg-slate-50">
        <div className="container mx-auto px-4 max-w-2xl">
          {submitStatus === 'success' ? (
            <div className="bg-green-50 border border-green-200 rounded-lg p-8 text-center">
              <div className="text-green-600 mb-4">
                <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-green-900 mb-2">Appointment Scheduled!</h2>
              <p className="text-green-700 mb-4">
                Thank you for scheduling a service appointment. We'll contact you shortly to confirm.
              </p>
              <Link
                href="/"
                className="inline-block bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-semibold transition-colors"
              >
                Back to Home
              </Link>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow-md p-8">
              <h2 className="text-2xl font-bold mb-6">Schedule Service Appointment</h2>

              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Contact Information */}
                <div>
                  <h3 className="text-lg font-semibold mb-4 text-slate-900">Contact Information</h3>
                  <div className="grid grid-cols-1 gap-4">
                    <div>
                      <label htmlFor="customerName" className="block text-sm font-medium text-slate-700 mb-1">
                        Full Name *
                      </label>
                      <input
                        type="text"
                        id="customerName"
                        name="customerName"
                        value={formData.customerName}
                        onChange={handleChange}
                        required
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="John Doe"
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label htmlFor="customerEmail" className="block text-sm font-medium text-slate-700 mb-1">
                          Email *
                        </label>
                        <input
                          type="email"
                          id="customerEmail"
                          name="customerEmail"
                          value={formData.customerEmail}
                          onChange={handleChange}
                          required
                          className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="john@example.com"
                        />
                      </div>

                      <div>
                        <label htmlFor="customerPhone" className="block text-sm font-medium text-slate-700 mb-1">
                          Phone *
                        </label>
                        <input
                          type="tel"
                          id="customerPhone"
                          name="customerPhone"
                          value={formData.customerPhone}
                          onChange={handleChange}
                          required
                          className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="(555) 123-4567"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Appointment Details */}
                <div>
                  <h3 className="text-lg font-semibold mb-4 text-slate-900">Appointment Details</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
                      <label htmlFor="appointmentDate" className="block text-sm font-medium text-slate-700 mb-1">
                        Preferred Date *
                      </label>
                      <input
                        type="date"
                        id="appointmentDate"
                        name="appointmentDate"
                        value={formData.appointmentDate}
                        onChange={handleChange}
                        min={minDate}
                        required
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>

                    <div>
                      <label htmlFor="appointmentTime" className="block text-sm font-medium text-slate-700 mb-1">
                        Preferred Time *
                      </label>
                      <select
                        id="appointmentTime"
                        name="appointmentTime"
                        value={formData.appointmentTime}
                        onChange={handleChange}
                        required
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="">Select a time</option>
                        <option value="8:00 AM">8:00 AM</option>
                        <option value="9:00 AM">9:00 AM</option>
                        <option value="10:00 AM">10:00 AM</option>
                        <option value="11:00 AM">11:00 AM</option>
                        <option value="12:00 PM">12:00 PM</option>
                        <option value="1:00 PM">1:00 PM</option>
                        <option value="2:00 PM">2:00 PM</option>
                        <option value="3:00 PM">3:00 PM</option>
                        <option value="4:00 PM">4:00 PM</option>
                        <option value="5:00 PM">5:00 PM</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label htmlFor="serviceType" className="block text-sm font-medium text-slate-700 mb-1">
                      Service Type *
                    </label>
                    <select
                      id="serviceType"
                      name="serviceType"
                      value={formData.serviceType}
                      onChange={handleChange}
                      required
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="">Select service type</option>
                      <option value="oil_change">Oil Change</option>
                      <option value="brake_service">Brake Service</option>
                      <option value="battery_service">Battery Service</option>
                      <option value="diagnostics">Diagnostics</option>
                      <option value="tire_service">Tire Service</option>
                      <option value="state_inspection">State Inspection</option>
                      <option value="scheduled_maintenance">Scheduled Maintenance</option>
                      <option value="repair">Repair</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                </div>

                {/* Vehicle Information */}
                <div>
                  <h3 className="text-lg font-semibold mb-4 text-slate-900">Vehicle Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="vehicleYear" className="block text-sm font-medium text-slate-700 mb-1">
                        Year
                      </label>
                      <input
                        type="number"
                        id="vehicleYear"
                        name="vehicleYear"
                        value={formData.vehicleYear}
                        onChange={handleChange}
                        min="1900"
                        max={new Date().getFullYear() + 1}
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="2020"
                      />
                    </div>

                    <div>
                      <label htmlFor="vehicleMake" className="block text-sm font-medium text-slate-700 mb-1">
                        Make
                      </label>
                      <input
                        type="text"
                        id="vehicleMake"
                        name="vehicleMake"
                        value={formData.vehicleMake}
                        onChange={handleChange}
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Toyota"
                      />
                    </div>

                    <div>
                      <label htmlFor="vehicleModel" className="block text-sm font-medium text-slate-700 mb-1">
                        Model
                      </label>
                      <input
                        type="text"
                        id="vehicleModel"
                        name="vehicleModel"
                        value={formData.vehicleModel}
                        onChange={handleChange}
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Camry"
                      />
                    </div>

                    <div>
                      <label htmlFor="vehicleVin" className="block text-sm font-medium text-slate-700 mb-1">
                        VIN (Optional)
                      </label>
                      <input
                        type="text"
                        id="vehicleVin"
                        name="vehicleVin"
                        value={formData.vehicleVin}
                        onChange={handleChange}
                        maxLength={17}
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="1HGBH41JXMN109186"
                      />
                    </div>
                  </div>
                </div>

                {/* Service Description */}
                <div>
                  <label htmlFor="description" className="block text-sm font-medium text-slate-700 mb-1">
                    Describe Your Service Needs
                  </label>
                  <textarea
                    id="description"
                    name="description"
                    value={formData.description}
                    onChange={handleChange}
                    rows={4}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Please describe what service you need or any issues you're experiencing..."
                  />
                </div>

                {submitStatus === 'error' && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <p className="text-red-800">
                      There was an error submitting your appointment. Please try again or contact us directly.
                    </p>
                  </div>
                )}

                <div className="flex gap-4">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
                  >
                    {isSubmitting ? 'Submitting...' : 'Schedule Appointment'}
                  </button>
                  <Link
                    href="/"
                    className="px-6 py-3 border border-slate-300 rounded-lg font-semibold hover:bg-slate-50 transition-colors"
                  >
                    Cancel
                  </Link>
                </div>
              </form>
            </div>
          )}
        </div>
      </section>

      {/* Why Choose Us */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-12">Why Choose Our Service Department</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 max-w-6xl mx-auto">
            <div className="text-center">
              <div className="bg-blue-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-2">Certified Technicians</h3>
              <p className="text-slate-600">
                ASE-certified professionals with years of experience.
              </p>
            </div>

            <div className="text-center">
              <div className="bg-blue-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-2">Quick Turnaround</h3>
              <p className="text-slate-600">
                Efficient service to get you back on the road fast.
              </p>
            </div>

            <div className="text-center">
              <div className="bg-blue-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-2">Quality Parts</h3>
              <p className="text-slate-600">
                OEM and premium aftermarket parts only.
              </p>
            </div>

            <div className="text-center">
              <div className="bg-blue-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-2">Competitive Pricing</h3>
              <p className="text-slate-600">
                Fair and transparent pricing with no hidden fees.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section className="py-16 bg-blue-600 text-white">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold mb-4">Have Questions?</h2>
          <p className="text-xl mb-8 opacity-90 max-w-2xl mx-auto">
            Our service team is here to help. Call us or visit our service center.
          </p>
          <div className="flex justify-center gap-4">
            <a
              href="tel:5551234567"
              className="bg-white hover:bg-slate-100 text-blue-600 px-8 py-3 rounded-lg font-semibold transition-colors"
            >
              Call Service Center
            </a>
            <Link
              href="/contact"
              className="border-2 border-white hover:bg-white hover:text-blue-600 px-8 py-3 rounded-lg font-semibold transition-colors"
            >
              Get Directions
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
