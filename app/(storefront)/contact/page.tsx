'use client'

import { useState } from 'react'
import { fetchGraphQL } from '../lib/graphql-client'

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

export default function ContactPage() {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    preferredContact: 'email',
    message: '',
  })
  const [submitted, setSubmitted] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      await fetchGraphQL(CREATE_LEAD, {
        data: {
          firstName: formData.firstName,
          lastName: formData.lastName,
          email: formData.email,
          phone: formData.phone || undefined,
          source: 'website',
          status: 'new',
          notes: `Contact form submission - Preferred contact: ${formData.preferredContact}\n\n${formData.message}`,
        },
      })

      setSubmitted(true)
    } catch (error) {
      console.error('Error submitting contact form:', error)
      alert('There was an error submitting your message. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-slate-50 py-12">
        <div className="container mx-auto px-4">
          <div className="max-w-xl mx-auto bg-white rounded-lg shadow p-8 text-center">
            <div className="text-5xl mb-4">✓</div>
            <h2 className="text-2xl font-bold mb-2">Thank You!</h2>
            <p className="text-slate-600 mb-6">
              We&apos;ve received your message and will get back to you shortly.
            </p>
            <a href="/" className="text-blue-600 hover:text-blue-800 font-medium">
              Return to Home
            </a>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 py-12">
      <div className="container mx-auto px-4">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold mb-2">Contact Us</h1>
            <p className="text-slate-600">
              Have questions? We&apos;re here to help. Fill out the form below and we&apos;ll get back to you as soon as possible.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Contact Form */}
            <div className="md:col-span-2">
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-bold mb-4">Send Us a Message</h2>
                <form onSubmit={handleSubmit} className="space-y-4">
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
                    <label className="block text-sm font-medium mb-1">Phone</label>
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                      className="w-full border rounded-md p-2"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Preferred Contact Method</label>
                    <select
                      value={formData.preferredContact}
                      onChange={(e) => setFormData(prev => ({ ...prev, preferredContact: e.target.value }))}
                      className="w-full border rounded-md p-2"
                    >
                      <option value="email">Email</option>
                      <option value="phone">Phone</option>
                      <option value="text">Text Message</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Message *</label>
                    <textarea
                      required
                      rows={5}
                      value={formData.message}
                      onChange={(e) => setFormData(prev => ({ ...prev, message: e.target.value }))}
                      className="w-full border rounded-md p-2"
                      placeholder="How can we help you?"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-md font-semibold transition-colors disabled:bg-blue-400 disabled:cursor-not-allowed"
                  >
                    {isSubmitting ? 'Sending...' : 'Send Message'}
                  </button>
                </form>
              </div>
            </div>

            {/* Contact Info */}
            <div className="space-y-4">
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="font-bold mb-4">Dealership Info</h3>
                <div className="space-y-3 text-sm">
                  <div>
                    <div className="font-medium">Address</div>
                    <div className="text-slate-600">
                      123 Auto Drive<br />
                      Anytown, USA 12345
                    </div>
                  </div>
                  <div>
                    <div className="font-medium">Main Phone</div>
                    <a href="tel:5551234567" className="text-blue-600 hover:text-blue-800">
                      (555) 123-4567
                    </a>
                  </div>
                  <div>
                    <div className="font-medium">Email</div>
                    <a href="mailto:info@openfrontdealership.com" className="text-blue-600 hover:text-blue-800">
                      info@openfrontdealership.com
                    </a>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="font-bold mb-4">Department Contacts</h3>
                <div className="space-y-4 text-sm">
                  <div>
                    <div className="font-semibold text-blue-600 mb-1">Sales Department</div>
                    <div className="space-y-1 text-slate-600">
                      <div>Phone: <a href="tel:5551234501" className="text-blue-600 hover:text-blue-800">(555) 123-4501</a></div>
                      <div>Email: <a href="mailto:sales@openfrontdealership.com" className="text-blue-600 hover:text-blue-800">sales@</a></div>
                    </div>
                  </div>
                  <div>
                    <div className="font-semibold text-blue-600 mb-1">Service Department</div>
                    <div className="space-y-1 text-slate-600">
                      <div>Phone: <a href="tel:5551234502" className="text-blue-600 hover:text-blue-800">(555) 123-4502</a></div>
                      <div>Email: <a href="mailto:service@openfrontdealership.com" className="text-blue-600 hover:text-blue-800">service@</a></div>
                    </div>
                  </div>
                  <div>
                    <div className="font-semibold text-blue-600 mb-1">Parts Department</div>
                    <div className="space-y-1 text-slate-600">
                      <div>Phone: <a href="tel:5551234503" className="text-blue-600 hover:text-blue-800">(555) 123-4503</a></div>
                      <div>Email: <a href="mailto:parts@openfrontdealership.com" className="text-blue-600 hover:text-blue-800">parts@</a></div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="font-bold mb-4">Department Hours</h3>
                <div className="space-y-3 text-sm">
                  <div>
                    <div className="font-semibold mb-2">Sales</div>
                    <div className="space-y-1 text-slate-600">
                      <div className="flex justify-between">
                        <span>Mon-Fri</span>
                        <span>9AM - 8PM</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Saturday</span>
                        <span>9AM - 6PM</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Sunday</span>
                        <span>11AM - 5PM</span>
                      </div>
                    </div>
                  </div>
                  <div className="border-t pt-3">
                    <div className="font-semibold mb-2">Service</div>
                    <div className="space-y-1 text-slate-600">
                      <div className="flex justify-between">
                        <span>Mon-Fri</span>
                        <span>7AM - 6PM</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Saturday</span>
                        <span>8AM - 4PM</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Sunday</span>
                        <span>Closed</span>
                      </div>
                    </div>
                  </div>
                  <div className="border-t pt-3">
                    <div className="font-semibold mb-2">Parts</div>
                    <div className="space-y-1 text-slate-600">
                      <div className="flex justify-between">
                        <span>Mon-Fri</span>
                        <span>7AM - 6PM</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Saturday</span>
                        <span>8AM - 3PM</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Sunday</span>
                        <span>Closed</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Map Section */}
          <div className="mt-8">
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="p-6 border-b">
                <h2 className="text-xl font-bold">Find Us</h2>
              </div>
              <div className="relative h-96">
                <iframe
                  src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3024.2219901290355!2d-74.00369368400567!3d40.71277937933185!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x89c25a316c4f16d3%3A0x5e8c6b4c8f0a1f3e!2sNew%20York%2C%20NY!5e0!3m2!1sen!2sus!4v1234567890123!5m2!1sen!2sus"
                  width="100%"
                  height="100%"
                  style={{ border: 0 }}
                  allowFullScreen
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  title="Dealership Location"
                />
              </div>
            </div>
          </div>

          {/* Directions and Parking */}
          <div className="mt-8 grid md:grid-cols-2 gap-6">
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-bold mb-4 flex items-center">
                <svg className="w-5 h-5 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                </svg>
                Directions
              </h3>
              <div className="space-y-3 text-sm text-slate-600">
                <div>
                  <div className="font-semibold mb-1">From Downtown:</div>
                  <p>Take I-95 North to Exit 12. Turn right onto Auto Drive. We&apos;re 0.5 miles on the left.</p>
                </div>
                <div>
                  <div className="font-semibold mb-1">From Airport:</div>
                  <p>Take Airport Parkway to Highway 101 South. Exit at Auto Mile, turn left. We&apos;re 1 mile ahead on the right.</p>
                </div>
                <div>
                  <div className="font-semibold mb-1">Public Transit:</div>
                  <p>Bus routes 12 and 45 stop directly in front of our dealership. Metro station is 0.3 miles away.</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-bold mb-4 flex items-center">
                <svg className="w-5 h-5 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                </svg>
                Parking Information
              </h3>
              <div className="space-y-3 text-sm text-slate-600">
                <div className="flex items-start">
                  <svg className="w-5 h-5 mr-2 text-green-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <div>
                    <span className="font-semibold">Free Parking:</span> Ample parking available in our main lot with over 100 spaces.
                  </div>
                </div>
                <div className="flex items-start">
                  <svg className="w-5 h-5 mr-2 text-green-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <div>
                    <span className="font-semibold">ADA Accessible:</span> Designated handicap parking spaces near all entrances.
                  </div>
                </div>
                <div className="flex items-start">
                  <svg className="w-5 h-5 mr-2 text-green-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <div>
                    <span className="font-semibold">EV Charging:</span> Electric vehicle charging stations available for customers.
                  </div>
                </div>
                <div className="flex items-start">
                  <svg className="w-5 h-5 mr-2 text-green-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <div>
                    <span className="font-semibold">Service Lane:</span> Separate service drive-through entrance on the east side.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
