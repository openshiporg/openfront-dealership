'use client'

import { useState } from 'react'
import { fetchGraphQL } from '../lib/graphql-client'

const MAKES = ['Acura', 'Audi', 'BMW', 'Chevrolet', 'Ford', 'Honda', 'Hyundai', 'Kia', 'Lexus', 'Mazda', 'Mercedes-Benz', 'Nissan', 'Subaru', 'Tesla', 'Toyota', 'Volkswagen']
const currentYear = new Date().getFullYear()
const YEARS = Array.from({ length: 20 }, (_, i) => currentYear - i)

const CREATE_TRADE_IN = `
  mutation CreateTradeIn($data: TradeInCreateInput!) {
    createTradeIn(data: $data) {
      id
      year
      make
      model
      mileage
      condition
    }
  }
`

export default function TradeInPage() {
  const [step, setStep] = useState(1)
  const [formData, setFormData] = useState({
    // Vehicle Info
    year: '',
    make: '',
    model: '',
    trim: '',
    mileage: '',
    vin: '',
    condition: 'good',

    // Owner Info
    ownership: 'own',
    payoffAmount: '',

    // Contact Info
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
  })
  const [submitted, setSubmitted] = useState(false)
  const [estimatedValue, setEstimatedValue] = useState<{ min: number; max: number } | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      // Calculate estimated value based on year, mileage, and condition
      const baseValue = calculateEstimatedValue(
        parseInt(formData.year),
        parseInt(formData.mileage),
        formData.condition
      )

      // Create TradeIn record via GraphQL
      await fetchGraphQL(CREATE_TRADE_IN, {
        data: {
          vin: formData.vin || undefined,
          year: formData.year,
          make: formData.make,
          model: formData.model,
          trim: formData.trim || undefined,
          mileage: parseInt(formData.mileage) || 0,
          condition: formData.condition,
          exteriorCondition: `Contact: ${formData.firstName} ${formData.lastName}, ${formData.email}, ${formData.phone}`,
          interiorCondition: `Ownership: ${formData.ownership}${formData.payoffAmount ? `, Payoff: $${formData.payoffAmount}` : ''}`,
          kbbValue: baseValue.max,
          offerAmount: baseValue.min,
        },
      })

      setEstimatedValue(baseValue)
      setSubmitted(true)
    } catch (error) {
      console.error('Error creating trade-in:', error)
      alert('There was an error submitting your trade-in request. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const calculateEstimatedValue = (year: number, mileage: number, condition: string) => {
    // Simple estimation logic - in production this would use real valuation APIs
    const currentYear = new Date().getFullYear()
    const age = currentYear - year

    // Base value starts at $30k for new car
    let baseValue = 30000

    // Depreciate by age (15% per year)
    baseValue -= age * 4500

    // Adjust for mileage (typical is 12k miles/year)
    const expectedMileage = age * 12000
    const mileageDiff = mileage - expectedMileage
    baseValue -= mileageDiff * 0.10

    // Adjust for condition
    const conditionMultiplier = {
      excellent: 1.1,
      good: 1.0,
      fair: 0.85,
      poor: 0.70,
    }[condition] || 1.0

    baseValue *= conditionMultiplier

    // Ensure minimum value
    baseValue = Math.max(baseValue, 2000)

    return {
      min: Math.round(baseValue * 0.9),
      max: Math.round(baseValue * 1.1),
    }
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-slate-50 py-12">
        <div className="container mx-auto px-4">
          <div className="max-w-xl mx-auto bg-white rounded-lg shadow p-8">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold mb-2">Thank You!</h2>
              <p className="text-slate-600 mb-6">
                We&apos;ve received your trade-in request for your {formData.year} {formData.make} {formData.model}.
              </p>
            </div>

            {estimatedValue && (
              <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-6 mb-6">
                <h3 className="text-lg font-bold mb-3 text-center">Estimated Trade-In Value</h3>
                <div className="text-center">
                  <div className="text-3xl font-bold text-blue-600">
                    ${estimatedValue.min.toLocaleString()} - ${estimatedValue.max.toLocaleString()}
                  </div>
                  <p className="text-sm text-slate-600 mt-2">
                    This is an estimate based on the information provided. Our team will provide a detailed appraisal.
                  </p>
                </div>
              </div>
            )}

            <div className="bg-slate-50 rounded-lg p-4 mb-6">
              <h3 className="font-semibold mb-2">What happens next?</h3>
              <ol className="space-y-2 text-sm text-slate-600">
                <li className="flex gap-2">
                  <span className="font-semibold text-blue-600">1.</span>
                  <span>One of our appraisal specialists will review your submission</span>
                </li>
                <li className="flex gap-2">
                  <span className="font-semibold text-blue-600">2.</span>
                  <span>We&apos;ll contact you within 24 hours to schedule an in-person appraisal</span>
                </li>
                <li className="flex gap-2">
                  <span className="font-semibold text-blue-600">3.</span>
                  <span>After inspection, we&apos;ll provide a final trade-in offer</span>
                </li>
              </ol>
            </div>

            <div className="flex gap-3">
              <a
                href="/inventory"
                className="flex-1 text-center bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-semibold transition-colors"
              >
                Browse Our Inventory
              </a>
              <button
                onClick={() => {
                  setSubmitted(false)
                  setStep(1)
                  setFormData({
                    year: '',
                    make: '',
                    model: '',
                    trim: '',
                    mileage: '',
                    vin: '',
                    condition: 'good',
                    ownership: 'own',
                    payoffAmount: '',
                    firstName: '',
                    lastName: '',
                    email: '',
                    phone: '',
                  })
                }}
                className="flex-1 text-center border-2 border-slate-300 hover:border-slate-400 py-3 rounded-lg font-semibold transition-colors"
              >
                Value Another Vehicle
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 py-12">
      <div className="container mx-auto px-4">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold mb-2">Value Your Trade-In</h1>
            <p className="text-slate-600">
              Get a fair market estimate for your current vehicle in just a few steps.
            </p>
          </div>

          {/* Progress Steps */}
          <div className="flex justify-between mb-8">
            {[1, 2, 3].map(i => (
              <div key={i} className="flex items-center">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
                  step >= i ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-500'
                }`}>
                  {i}
                </div>
                <span className={`ml-2 text-sm ${step >= i ? 'text-blue-600 font-medium' : 'text-slate-500'}`}>
                  {i === 1 ? 'Vehicle Info' : i === 2 ? 'Condition' : 'Contact'}
                </span>
              </div>
            ))}
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <form onSubmit={handleSubmit}>
              {/* Step 1: Vehicle Information */}
              {step === 1 && (
                <div className="space-y-4">
                  <h2 className="text-xl font-bold mb-4">Vehicle Information</h2>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">Year *</label>
                      <select
                        required
                        value={formData.year}
                        onChange={(e) => setFormData(prev => ({ ...prev, year: e.target.value }))}
                        className="w-full border rounded-md p-2"
                      >
                        <option value="">Select Year</option>
                        {YEARS.map(year => (
                          <option key={year} value={year}>{year}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Make *</label>
                      <select
                        required
                        value={formData.make}
                        onChange={(e) => setFormData(prev => ({ ...prev, make: e.target.value }))}
                        className="w-full border rounded-md p-2"
                      >
                        <option value="">Select Make</option>
                        {MAKES.map(make => (
                          <option key={make} value={make}>{make}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">Model *</label>
                      <input
                        type="text"
                        required
                        value={formData.model}
                        onChange={(e) => setFormData(prev => ({ ...prev, model: e.target.value }))}
                        className="w-full border rounded-md p-2"
                        placeholder="e.g., Accord"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Trim</label>
                      <input
                        type="text"
                        value={formData.trim}
                        onChange={(e) => setFormData(prev => ({ ...prev, trim: e.target.value }))}
                        className="w-full border rounded-md p-2"
                        placeholder="e.g., Sport"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">Mileage *</label>
                      <input
                        type="number"
                        required
                        value={formData.mileage}
                        onChange={(e) => setFormData(prev => ({ ...prev, mileage: e.target.value }))}
                        className="w-full border rounded-md p-2"
                        placeholder="e.g., 45000"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">VIN (Optional)</label>
                      <input
                        type="text"
                        value={formData.vin}
                        onChange={(e) => setFormData(prev => ({ ...prev, vin: e.target.value }))}
                        className="w-full border rounded-md p-2"
                        placeholder="17 characters"
                        maxLength={17}
                      />
                    </div>
                  </div>
                  <div className="pt-4">
                    <button
                      type="button"
                      onClick={() => setStep(2)}
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-md font-semibold transition-colors"
                    >
                      Continue
                    </button>
                  </div>
                </div>
              )}

              {/* Step 2: Condition & Ownership */}
              {step === 2 && (
                <div className="space-y-4">
                  <h2 className="text-xl font-bold mb-4">Vehicle Condition</h2>
                  <div>
                    <label className="block text-sm font-medium mb-2">Overall Condition *</label>
                    <div className="space-y-2">
                      {[
                        { value: 'excellent', label: 'Excellent', desc: 'Like new, no issues' },
                        { value: 'good', label: 'Good', desc: 'Normal wear, well maintained' },
                        { value: 'fair', label: 'Fair', desc: 'Some cosmetic or mechanical issues' },
                        { value: 'poor', label: 'Poor', desc: 'Significant issues or damage' },
                      ].map(option => (
                        <label key={option.value} className="flex items-start gap-3 p-3 border rounded-md cursor-pointer hover:bg-slate-50">
                          <input
                            type="radio"
                            name="condition"
                            value={option.value}
                            checked={formData.condition === option.value}
                            onChange={(e) => setFormData(prev => ({ ...prev, condition: e.target.value }))}
                            className="mt-1"
                          />
                          <div>
                            <div className="font-medium">{option.label}</div>
                            <div className="text-sm text-slate-500">{option.desc}</div>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Ownership Status *</label>
                    <div className="space-y-2">
                      <label className="flex items-center gap-3 p-3 border rounded-md cursor-pointer hover:bg-slate-50">
                        <input
                          type="radio"
                          name="ownership"
                          value="own"
                          checked={formData.ownership === 'own'}
                          onChange={(e) => setFormData(prev => ({ ...prev, ownership: e.target.value }))}
                        />
                        <span>I own it outright</span>
                      </label>
                      <label className="flex items-center gap-3 p-3 border rounded-md cursor-pointer hover:bg-slate-50">
                        <input
                          type="radio"
                          name="ownership"
                          value="financing"
                          checked={formData.ownership === 'financing'}
                          onChange={(e) => setFormData(prev => ({ ...prev, ownership: e.target.value }))}
                        />
                        <span>I&apos;m still financing</span>
                      </label>
                      <label className="flex items-center gap-3 p-3 border rounded-md cursor-pointer hover:bg-slate-50">
                        <input
                          type="radio"
                          name="ownership"
                          value="lease"
                          checked={formData.ownership === 'lease'}
                          onChange={(e) => setFormData(prev => ({ ...prev, ownership: e.target.value }))}
                        />
                        <span>It&apos;s a lease</span>
                      </label>
                    </div>
                  </div>
                  {formData.ownership === 'financing' && (
                    <div>
                      <label className="block text-sm font-medium mb-1">Estimated Payoff Amount</label>
                      <input
                        type="number"
                        value={formData.payoffAmount}
                        onChange={(e) => setFormData(prev => ({ ...prev, payoffAmount: e.target.value }))}
                        className="w-full border rounded-md p-2"
                        placeholder="$"
                      />
                    </div>
                  )}
                  <div className="flex gap-4 pt-4">
                    <button
                      type="button"
                      onClick={() => setStep(1)}
                      className="flex-1 border-2 border-slate-300 hover:border-slate-400 py-3 rounded-md font-semibold transition-colors"
                    >
                      Back
                    </button>
                    <button
                      type="button"
                      onClick={() => setStep(3)}
                      className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-md font-semibold transition-colors"
                    >
                      Continue
                    </button>
                  </div>
                </div>
              )}

              {/* Step 3: Contact Information */}
              {step === 3 && (
                <div className="space-y-4">
                  <h2 className="text-xl font-bold mb-4">Contact Information</h2>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">First Name *</label>
                      <input
                        type="text"
                        required
                        value={formData.firstName}
                        onChange={(e) => setFormData(prev => ({ ...prev, firstName: e.target.value }))}
                        className="w-full border rounded-md p-2"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Last Name *</label>
                      <input
                        type="text"
                        required
                        value={formData.lastName}
                        onChange={(e) => setFormData(prev => ({ ...prev, lastName: e.target.value }))}
                        className="w-full border rounded-md p-2"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Email *</label>
                    <input
                      type="email"
                      required
                      value={formData.email}
                      onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                      className="w-full border rounded-md p-2"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Phone *</label>
                    <input
                      type="tel"
                      required
                      value={formData.phone}
                      onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                      className="w-full border rounded-md p-2"
                    />
                  </div>
                  <div className="flex gap-4 pt-4">
                    <button
                      type="button"
                      onClick={() => setStep(2)}
                      className="flex-1 border-2 border-slate-300 hover:border-slate-400 py-3 rounded-md font-semibold transition-colors"
                    >
                      Back
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="flex-1 bg-green-600 hover:bg-green-700 text-white py-3 rounded-md font-semibold transition-colors disabled:bg-green-400 disabled:cursor-not-allowed"
                    >
                      {isSubmitting ? 'Submitting...' : 'Get My Trade-In Value'}
                    </button>
                  </div>
                </div>
              )}
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}
