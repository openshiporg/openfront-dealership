'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'

export default function TestDrivePage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const vehicleId = searchParams.get('vehicleId')

  const [formData, setFormData] = useState({
    customerName: '',
    customerEmail: '',
    customerPhone: '',
    preferredDate: '',
    preferredTime: '',
    vehicleId: vehicleId || '',
    message: ''
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
      const response = await fetch('/api/test-drive', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      })

      if (!response.ok) {
        throw new Error('Failed to submit test drive request')
      }

      setSubmitStatus('success')
      setFormData({
        customerName: '',
        customerEmail: '',
        customerPhone: '',
        preferredDate: '',
        preferredTime: '',
        vehicleId: '',
        message: ''
      })

      setTimeout(() => {
        router.push('/inventory')
      }, 2000)
    } catch (error) {
      console.error('Error submitting test drive request:', error)
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
          <h1 className="text-4xl font-bold mb-4">Schedule a Test Drive</h1>
          <p className="text-xl text-slate-300 max-w-2xl">
            Experience your next vehicle firsthand. Schedule a test drive at your convenience.
          </p>
        </div>
      </section>

      {/* Form Section */}
      <section className="py-16">
        <div className="container mx-auto px-4 max-w-2xl">
          {submitStatus === 'success' ? (
            <div className="bg-green-50 border border-green-200 rounded-lg p-8 text-center">
              <div className="text-green-600 mb-4">
                <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-green-900 mb-2">Test Drive Scheduled!</h2>
              <p className="text-green-700 mb-4">
                Thank you for scheduling a test drive. We'll contact you shortly to confirm your appointment.
              </p>
              <Link
                href="/inventory"
                className="inline-block bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-semibold transition-colors"
              >
                Back to Inventory
              </Link>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow-md p-8">
              <h2 className="text-2xl font-bold mb-6">Test Drive Request Form</h2>

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
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="preferredDate" className="block text-sm font-medium text-slate-700 mb-1">
                        Preferred Date *
                      </label>
                      <input
                        type="date"
                        id="preferredDate"
                        name="preferredDate"
                        value={formData.preferredDate}
                        onChange={handleChange}
                        min={minDate}
                        required
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>

                    <div>
                      <label htmlFor="preferredTime" className="block text-sm font-medium text-slate-700 mb-1">
                        Preferred Time *
                      </label>
                      <select
                        id="preferredTime"
                        name="preferredTime"
                        value={formData.preferredTime}
                        onChange={handleChange}
                        required
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="">Select a time</option>
                        <option value="9:00 AM">9:00 AM</option>
                        <option value="10:00 AM">10:00 AM</option>
                        <option value="11:00 AM">11:00 AM</option>
                        <option value="12:00 PM">12:00 PM</option>
                        <option value="1:00 PM">1:00 PM</option>
                        <option value="2:00 PM">2:00 PM</option>
                        <option value="3:00 PM">3:00 PM</option>
                        <option value="4:00 PM">4:00 PM</option>
                        <option value="5:00 PM">5:00 PM</option>
                        <option value="6:00 PM">6:00 PM</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Vehicle ID (if pre-selected) */}
                {vehicleId && (
                  <input type="hidden" name="vehicleId" value={formData.vehicleId} />
                )}

                {/* Additional Information */}
                <div>
                  <label htmlFor="message" className="block text-sm font-medium text-slate-700 mb-1">
                    Additional Comments
                  </label>
                  <textarea
                    id="message"
                    name="message"
                    value={formData.message}
                    onChange={handleChange}
                    rows={4}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Any specific requests or questions?"
                  />
                </div>

                {submitStatus === 'error' && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <p className="text-red-800">
                      There was an error submitting your request. Please try again or contact us directly.
                    </p>
                  </div>
                )}

                <div className="flex gap-4">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
                  >
                    {isSubmitting ? 'Submitting...' : 'Schedule Test Drive'}
                  </button>
                  <Link
                    href="/inventory"
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

      {/* Information Section */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-12">What to Expect</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            <div className="text-center">
              <div className="bg-blue-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-2">1. Submit Your Request</h3>
              <p className="text-slate-600">
                Fill out the form with your preferred date and time for the test drive.
              </p>
            </div>

            <div className="text-center">
              <div className="bg-blue-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-2">2. We Confirm</h3>
              <p className="text-slate-600">
                Our team will contact you to confirm your appointment within 24 hours.
              </p>
            </div>

            <div className="text-center">
              <div className="bg-blue-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-2">3. Enjoy Your Drive</h3>
              <p className="text-slate-600">
                Experience the vehicle firsthand and ask any questions you may have.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Requirements Section */}
      <section className="py-16 bg-slate-50">
        <div className="container mx-auto px-4 max-w-3xl">
          <h2 className="text-3xl font-bold text-center mb-8">Test Drive Requirements</h2>
          <div className="bg-white rounded-lg shadow-md p-8">
            <ul className="space-y-4">
              <li className="flex items-start">
                <svg className="w-6 h-6 text-green-600 mr-3 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <strong>Valid Driver's License:</strong> You must have a valid driver's license to test drive any vehicle.
                </div>
              </li>
              <li className="flex items-start">
                <svg className="w-6 h-6 text-green-600 mr-3 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <strong>Age Requirement:</strong> Drivers must be at least 18 years old.
                </div>
              </li>
              <li className="flex items-start">
                <svg className="w-6 h-6 text-green-600 mr-3 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <strong>Insurance:</strong> Proof of current auto insurance is required.
                </div>
              </li>
              <li className="flex items-start">
                <svg className="w-6 h-6 text-green-600 mr-3 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <strong>Appointment Required:</strong> Please schedule your test drive in advance to ensure vehicle availability.
                </div>
              </li>
            </ul>
          </div>
        </div>
      </section>
    </div>
  )
}
