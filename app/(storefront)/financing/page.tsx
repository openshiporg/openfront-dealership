'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'

const LOAN_TERMS = [36, 48, 60, 72, 84]
const DEFAULT_INTEREST_RATE = 7.5
const DEFAULT_DOWN_PAYMENT_PERCENT = 10

function FinancingContent() {
  const searchParams = useSearchParams()
  const vehiclePrice = searchParams?.get('price')

  const [formData, setFormData] = useState({
    vehiclePrice: vehiclePrice || '',
    downPayment: '',
    downPaymentPercent: DEFAULT_DOWN_PAYMENT_PERCENT,
    interestRate: DEFAULT_INTEREST_RATE,
    loanTerm: 60,
    tradeInValue: '',
  })

  const [calculatedResults, setCalculatedResults] = useState({
    monthlyPayment: 0,
    totalInterest: 0,
    totalPayment: 0,
    loanAmount: 0,
  })

  const [showAmortization, setShowAmortization] = useState(false)
  const [amortizationSchedule, setAmortizationSchedule] = useState<any[]>([])

  // Update down payment when percentage changes
  useEffect(() => {
    if (formData.vehiclePrice) {
      const price = parseFloat(formData.vehiclePrice)
      const downPayment = (price * formData.downPaymentPercent / 100).toFixed(2)
      setFormData(prev => ({ ...prev, downPayment }))
    }
  }, [formData.vehiclePrice, formData.downPaymentPercent])

  // Recalculate when any input changes
  useEffect(() => {
    calculatePayment()
  }, [formData])

  const calculatePayment = () => {
    const price = parseFloat(formData.vehiclePrice) || 0
    const downPayment = parseFloat(formData.downPayment) || 0
    const tradeIn = parseFloat(formData.tradeInValue) || 0
    const rate = parseFloat(formData.interestRate.toString()) || 0
    const term = parseInt(formData.loanTerm.toString()) || 60

    if (price <= 0) {
      setCalculatedResults({
        monthlyPayment: 0,
        totalInterest: 0,
        totalPayment: 0,
        loanAmount: 0,
      })
      return
    }

    // Calculate loan amount
    const loanAmount = Math.max(0, price - downPayment - tradeIn)

    if (loanAmount === 0 || rate === 0) {
      setCalculatedResults({
        monthlyPayment: 0,
        totalInterest: 0,
        totalPayment: loanAmount,
        loanAmount,
      })
      return
    }

    // Calculate monthly payment using loan formula
    const monthlyRate = rate / 100 / 12
    const numPayments = term
    const monthlyPayment = loanAmount * (monthlyRate * Math.pow(1 + monthlyRate, numPayments)) / (Math.pow(1 + monthlyRate, numPayments) - 1)

    const totalPayment = monthlyPayment * numPayments
    const totalInterest = totalPayment - loanAmount

    setCalculatedResults({
      monthlyPayment: isNaN(monthlyPayment) ? 0 : monthlyPayment,
      totalInterest: isNaN(totalInterest) ? 0 : totalInterest,
      totalPayment: isNaN(totalPayment) ? 0 : totalPayment,
      loanAmount,
    })

    // Generate amortization schedule
    generateAmortizationSchedule(loanAmount, monthlyRate, numPayments, monthlyPayment)
  }

  const generateAmortizationSchedule = (principal: number, monthlyRate: number, numPayments: number, payment: number) => {
    const schedule = []
    let balance = principal

    for (let i = 1; i <= numPayments; i++) {
      const interestPayment = balance * monthlyRate
      const principalPayment = payment - interestPayment
      balance -= principalPayment

      // Only show first 12 months and last 12 months for brevity
      if (i <= 12 || i > numPayments - 12) {
        schedule.push({
          month: i,
          payment,
          principal: principalPayment,
          interest: interestPayment,
          balance: Math.max(0, balance),
        })
      } else if (i === 13) {
        schedule.push({ separator: true })
      }
    }

    setAmortizationSchedule(schedule)
  }

  const handleDownPaymentChange = (value: string) => {
    const downPayment = parseFloat(value) || 0
    const price = parseFloat(formData.vehiclePrice) || 0
    const percent = price > 0 ? (downPayment / price * 100) : 0
    setFormData(prev => ({ ...prev, downPayment: value, downPaymentPercent: percent }))
  }

  return (
    <div className="min-h-screen bg-slate-50 py-12">
      <div className="container mx-auto px-4">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold mb-3">Financing Calculator</h1>
            <p className="text-slate-600 text-lg">
              Estimate your monthly car payment and see how different loan terms affect your total cost.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Input Form - Left Side */}
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-bold mb-4">Loan Details</h2>

                {/* Vehicle Price */}
                <div className="mb-4">
                  <label className="block text-sm font-medium mb-2">Vehicle Price</label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-slate-500">$</span>
                    <input
                      type="number"
                      value={formData.vehiclePrice}
                      onChange={(e) => setFormData(prev => ({ ...prev, vehiclePrice: e.target.value }))}
                      className="w-full border rounded-md p-2 pl-7"
                      placeholder="35,000"
                      step="100"
                      min="0"
                    />
                  </div>
                </div>

                {/* Down Payment */}
                <div className="mb-4">
                  <div className="flex justify-between mb-2">
                    <label className="block text-sm font-medium">Down Payment</label>
                    <span className="text-sm text-slate-600">{formData.downPaymentPercent.toFixed(1)}%</span>
                  </div>
                  <div className="relative mb-2">
                    <span className="absolute left-3 top-2.5 text-slate-500">$</span>
                    <input
                      type="number"
                      value={formData.downPayment}
                      onChange={(e) => handleDownPaymentChange(e.target.value)}
                      className="w-full border rounded-md p-2 pl-7"
                      placeholder="3,500"
                      step="100"
                      min="0"
                    />
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="50"
                    step="1"
                    value={formData.downPaymentPercent}
                    onChange={(e) => setFormData(prev => ({ ...prev, downPaymentPercent: parseFloat(e.target.value) }))}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-slate-500 mt-1">
                    <span>0%</span>
                    <span>50%</span>
                  </div>
                </div>

                {/* Interest Rate */}
                <div className="mb-4">
                  <label className="block text-sm font-medium mb-2">Interest Rate (APR)</label>
                  <div className="relative">
                    <input
                      type="number"
                      value={formData.interestRate}
                      onChange={(e) => setFormData(prev => ({ ...prev, interestRate: parseFloat(e.target.value) || 0 }))}
                      className="w-full border rounded-md p-2 pr-8"
                      placeholder="7.5"
                      step="0.1"
                      min="0"
                      max="30"
                    />
                    <span className="absolute right-3 top-2.5 text-slate-500">%</span>
                  </div>
                </div>

                {/* Loan Term */}
                <div className="mb-4">
                  <label className="block text-sm font-medium mb-2">Loan Term</label>
                  <div className="grid grid-cols-5 gap-2">
                    {LOAN_TERMS.map(term => (
                      <button
                        key={term}
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, loanTerm: term }))}
                        className={`p-3 rounded-md border-2 font-medium transition-colors ${
                          formData.loanTerm === term
                            ? 'border-blue-600 bg-blue-50 text-blue-600'
                            : 'border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        {term}
                        <div className="text-xs text-slate-500">mos</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Trade-In Value */}
                <div className="mb-4">
                  <label className="block text-sm font-medium mb-2">Trade-In Value (Optional)</label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-slate-500">$</span>
                    <input
                      type="number"
                      value={formData.tradeInValue}
                      onChange={(e) => setFormData(prev => ({ ...prev, tradeInValue: e.target.value }))}
                      className="w-full border rounded-md p-2 pl-7"
                      placeholder="5,000"
                      step="100"
                      min="0"
                    />
                  </div>
                  <Link
                    href="/trade-in"
                    className="text-sm text-blue-600 hover:text-blue-800 mt-1 inline-block"
                  >
                    Get your trade-in value
                  </Link>
                </div>
              </div>

              {/* Amortization Schedule */}
              {calculatedResults.loanAmount > 0 && (
                <div className="bg-white rounded-lg shadow p-6">
                  <button
                    onClick={() => setShowAmortization(!showAmortization)}
                    className="w-full flex justify-between items-center text-left"
                  >
                    <h2 className="text-xl font-bold">Amortization Schedule</h2>
                    <svg
                      className={`w-6 h-6 transition-transform ${showAmortization ? 'rotate-180' : ''}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {showAmortization && (
                    <div className="mt-4 overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-slate-50">
                          <tr>
                            <th className="p-2 text-left">Month</th>
                            <th className="p-2 text-right">Payment</th>
                            <th className="p-2 text-right">Principal</th>
                            <th className="p-2 text-right">Interest</th>
                            <th className="p-2 text-right">Balance</th>
                          </tr>
                        </thead>
                        <tbody>
                          {amortizationSchedule.map((row, idx) => {
                            if (row.separator) {
                              return (
                                <tr key={idx}>
                                  <td colSpan={5} className="p-2 text-center text-slate-400">...</td>
                                </tr>
                              )
                            }
                            return (
                              <tr key={idx} className="border-b">
                                <td className="p-2">{row.month}</td>
                                <td className="p-2 text-right">${row.payment.toFixed(2)}</td>
                                <td className="p-2 text-right">${row.principal.toFixed(2)}</td>
                                <td className="p-2 text-right">${row.interest.toFixed(2)}</td>
                                <td className="p-2 text-right">${row.balance.toFixed(2)}</td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Results - Right Side */}
            <div className="space-y-6">
              {/* Monthly Payment */}
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-sm font-medium text-slate-600 mb-2">Estimated Monthly Payment</h3>
                <div className="text-4xl font-bold text-blue-600 mb-4">
                  ${calculatedResults.monthlyPayment.toFixed(2)}
                </div>
                <div className="text-sm text-slate-500">
                  per month for {formData.loanTerm} months
                </div>
              </div>

              {/* Breakdown */}
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-bold mb-4">Payment Breakdown</h3>
                <div className="space-y-3">
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-slate-600">Vehicle Price</span>
                    <span className="font-semibold">${parseFloat(formData.vehiclePrice || '0').toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-slate-600">Down Payment</span>
                    <span className="font-semibold text-green-600">-${parseFloat(formData.downPayment || '0').toLocaleString()}</span>
                  </div>
                  {formData.tradeInValue && parseFloat(formData.tradeInValue) > 0 && (
                    <div className="flex justify-between py-2 border-b">
                      <span className="text-slate-600">Trade-In Value</span>
                      <span className="font-semibold text-green-600">-${parseFloat(formData.tradeInValue).toLocaleString()}</span>
                    </div>
                  )}
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-slate-600">Loan Amount</span>
                    <span className="font-semibold">${calculatedResults.loanAmount.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-slate-600">Total Interest</span>
                    <span className="font-semibold text-red-600">+${calculatedResults.totalInterest.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between py-3 bg-slate-50 px-3 rounded-md">
                    <span className="font-semibold">Total Payment</span>
                    <span className="font-bold text-lg">${calculatedResults.totalPayment.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* CTA */}
              <div className="bg-blue-600 text-white rounded-lg shadow p-6">
                <h3 className="text-lg font-bold mb-2">Ready to Apply?</h3>
                <p className="text-sm mb-4 opacity-90">
                  Get pre-approved for financing in minutes. No impact to your credit score.
                </p>
                <Link
                  href="/contact"
                  className="block w-full bg-white text-blue-600 text-center py-3 rounded-md font-semibold hover:bg-slate-100 transition-colors"
                >
                  Apply for Financing
                </Link>
              </div>

              {/* Disclaimer */}
              <div className="bg-slate-100 rounded-lg p-4 text-xs text-slate-600">
                <p className="font-semibold mb-1">Disclaimer:</p>
                <p>
                  This calculator provides estimates only. Actual payment amounts may vary based on your credit history,
                  down payment, trade-in value, and other factors. Contact us for personalized financing options.
                </p>
              </div>
            </div>
          </div>

          {/* Bottom Info */}
          <div className="mt-8 bg-white rounded-lg shadow p-6">
            <h2 className="text-2xl font-bold mb-4">Financing Options</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <h3 className="font-semibold text-lg mb-2">Competitive Rates</h3>
                <p className="text-slate-600 text-sm">
                  We work with multiple lenders to find you the best rate for your situation, regardless of credit history.
                </p>
              </div>
              <div>
                <h3 className="font-semibold text-lg mb-2">Quick Approval</h3>
                <p className="text-slate-600 text-sm">
                  Get pre-approved in minutes with our streamlined application process. Same-day decisions available.
                </p>
              </div>
              <div>
                <h3 className="font-semibold text-lg mb-2">Flexible Terms</h3>
                <p className="text-slate-600 text-sm">
                  Choose loan terms from 36 to 84 months to find a monthly payment that fits your budget.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function FinancingPageFallback() {
  return (
    <div className="min-h-screen bg-slate-50 py-12 flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
    </div>
  )
}

export default function FinancingPage() {
  return (
    <Suspense fallback={<FinancingPageFallback />}>
      <FinancingContent />
    </Suspense>
  )
}
