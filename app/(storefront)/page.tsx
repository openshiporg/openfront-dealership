import Link from 'next/link'
import { fetchGraphQL } from './lib/graphql-client'
import { GET_VEHICLES, GET_MAKES } from './lib/queries'
import { Vehicle, Make } from './lib/types'
import { VehicleCard } from './components/VehicleCard'
import { HeroSearch } from './components/HeroSearch'

async function getFeaturedVehicles(): Promise<Vehicle[]> {
  try {
    const data = await fetchGraphQL<{ vehicles: Vehicle[] }>(GET_VEHICLES, {
      where: { status: { equals: 'available' } },
      orderBy: [{ year: 'desc' }],
      take: 6
    })
    return data.vehicles || []
  } catch (error) {
    console.error('Error fetching featured vehicles:', error)
    return []
  }
}

async function getMakes(): Promise<Make[]> {
  try {
    const data = await fetchGraphQL<{ makes: Make[] }>(GET_MAKES, {})
    return data.makes || []
  } catch (error) {
    console.error('Error fetching makes:', error)
    return []
  }
}

export default async function HomePage() {
  const featuredVehicles = await getFeaturedVehicles()
  const makes = await getMakes()
  const currentYear = new Date().getFullYear()
  const years = Array.from({ length: 30 }, (_, i) => currentYear - i)

  return (
    <div>
      {/* Hero Section with Search */}
      <section className="relative bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white py-24 overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0" style={{
            backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)',
            backgroundSize: '40px 40px'
          }} />
        </div>

        <div className="container mx-auto px-4 relative z-10">
          <div className="text-center mb-12">
            <h1 className="text-6xl font-bold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-white to-blue-200">
              Find Your Perfect Vehicle
            </h1>
            <p className="text-xl text-slate-300 max-w-2xl mx-auto">
              Search our extensive inventory of quality new and pre-owned vehicles
            </p>
          </div>

          {/* Hero Search Component */}
          <HeroSearch makes={makes} years={years} />

          <div className="flex justify-center gap-4 mt-8">
            <Link
              href="/inventory"
              className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-lg font-semibold transition-colors shadow-lg hover:shadow-xl"
            >
              Browse All Inventory
            </Link>
            <Link
              href="/contact"
              className="bg-white/10 backdrop-blur-sm hover:bg-white/20 border border-white/20 text-white px-8 py-3 rounded-lg font-semibold transition-colors"
            >
              Contact Sales
            </Link>
          </div>
        </div>
      </section>

      {/* Quick Actions */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-12">How Can We Help?</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <Link href="/inventory" className="group p-6 border rounded-lg hover:shadow-lg transition-shadow">
              <div className="text-5xl mb-4 text-center">
                <svg className="w-16 h-16 mx-auto text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-2 group-hover:text-blue-600 text-center">Search Inventory</h3>
              <p className="text-slate-600 text-center">
                Find your next vehicle from our selection of new and pre-owned cars, trucks, and SUVs.
              </p>
            </Link>
            <Link href="/financing" className="group p-6 border rounded-lg hover:shadow-lg transition-shadow">
              <div className="text-5xl mb-4 text-center">
                <svg className="w-16 h-16 mx-auto text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-2 group-hover:text-blue-600 text-center">Apply for Financing</h3>
              <p className="text-slate-600 text-center">
                Get pre-approved for financing in minutes. We work with all credit situations.
              </p>
            </Link>
            <Link href="/trade-in" className="group p-6 border rounded-lg hover:shadow-lg transition-shadow">
              <div className="text-5xl mb-4 text-center">
                <svg className="w-16 h-16 mx-auto text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-2 group-hover:text-blue-600 text-center">Value Your Trade</h3>
              <p className="text-slate-600 text-center">
                Get an instant estimate on your current vehicle's trade-in value.
              </p>
            </Link>
          </div>
        </div>
      </section>

      {/* Current Promotions */}
      <section className="py-16 bg-gradient-to-r from-blue-600 to-blue-700 text-white">
        <div className="container mx-auto px-4">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold mb-4">Current Promotions</h2>
            <p className="text-blue-100 text-lg">Limited time offers on select vehicles</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-6 border border-white/20">
              <div className="text-4xl font-bold mb-2">0% APR</div>
              <div className="text-xl mb-2">for 60 months</div>
              <p className="text-blue-100">On select new vehicles. Subject to credit approval.</p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-6 border border-white/20">
              <div className="text-4xl font-bold mb-2">$5,000</div>
              <div className="text-xl mb-2">Trade-In Bonus</div>
              <p className="text-blue-100">Extra value on your trade-in when you buy from us.</p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-6 border border-white/20">
              <div className="text-4xl font-bold mb-2">Free</div>
              <div className="text-xl mb-2">Service Package</div>
              <p className="text-blue-100">First 3 oil changes free with vehicle purchase.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Inventory */}
      <section className="py-16 bg-slate-50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Featured Vehicles</h2>
            <p className="text-slate-600 text-lg">Handpicked selection from our inventory</p>
          </div>
          {featuredVehicles.length > 0 ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {featuredVehicles.map((vehicle) => (
                  <VehicleCard key={vehicle.id} vehicle={vehicle} />
                ))}
              </div>
              <div className="text-center mt-8">
                <Link
                  href="/inventory"
                  className="inline-flex items-center text-blue-600 hover:text-blue-800 font-semibold text-lg"
                >
                  View All Inventory
                  <svg className="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              </div>
            </>
          ) : (
            <div className="text-center py-12">
              <p className="text-slate-500 text-lg">No vehicles available at this time. Please check back soon!</p>
              <Link
                href="/contact"
                className="inline-block mt-4 text-blue-600 hover:text-blue-800 font-semibold"
              >
                Contact us for more information
              </Link>
            </div>
          )}
        </div>
      </section>

      {/* Financing Calculator Preview */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="grid md:grid-cols-2 gap-12 items-center">
              <div>
                <h2 className="text-3xl font-bold mb-4">Easy Financing Options</h2>
                <p className="text-slate-600 mb-6 text-lg">
                  Calculate your monthly payment and get pre-approved in minutes. We work with all credit situations.
                </p>
                <ul className="space-y-3 mb-8">
                  <li className="flex items-start">
                    <svg className="w-6 h-6 text-green-600 mr-3 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-slate-700">Quick online pre-approval</span>
                  </li>
                  <li className="flex items-start">
                    <svg className="w-6 h-6 text-green-600 mr-3 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-slate-700">Competitive interest rates</span>
                  </li>
                  <li className="flex items-start">
                    <svg className="w-6 h-6 text-green-600 mr-3 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-slate-700">Flexible payment terms up to 72 months</span>
                  </li>
                </ul>
                <Link
                  href="/financing"
                  className="inline-block bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-lg font-semibold transition-colors"
                >
                  Calculate Payment
                </Link>
              </div>
              <div className="bg-slate-50 rounded-lg p-8">
                <div className="text-center mb-6">
                  <div className="text-5xl font-bold text-blue-600 mb-2">$450</div>
                  <div className="text-slate-600">Estimated Monthly Payment</div>
                </div>
                <div className="space-y-4 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-600">Vehicle Price:</span>
                    <span className="font-semibold">$30,000</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Down Payment:</span>
                    <span className="font-semibold">$5,000</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Interest Rate:</span>
                    <span className="font-semibold">4.9% APR</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Term:</span>
                    <span className="font-semibold">60 months</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Trade-In CTA */}
      <section className="py-16 bg-slate-900 text-white">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-3xl font-bold mb-4">What's Your Trade Worth?</h2>
            <p className="text-slate-300 text-lg mb-8">
              Get an instant estimate on your vehicle's trade-in value. Quick, easy, and no obligation.
            </p>
            <Link
              href="/trade-in"
              className="inline-block bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-lg font-semibold transition-colors"
            >
              Value Your Trade
            </Link>
          </div>
        </div>
      </section>

      {/* Customer Testimonials */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-12">What Our Customers Say</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-slate-50 rounded-lg p-6">
              <div className="flex items-center mb-4">
                {[...Array(5)].map((_, i) => (
                  <svg key={i} className="w-5 h-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                ))}
              </div>
              <p className="text-slate-700 mb-4">
                "Outstanding service from start to finish. The team helped me find the perfect vehicle within my budget."
              </p>
              <p className="font-semibold">- Sarah Johnson</p>
            </div>
            <div className="bg-slate-50 rounded-lg p-6">
              <div className="flex items-center mb-4">
                {[...Array(5)].map((_, i) => (
                  <svg key={i} className="w-5 h-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                ))}
              </div>
              <p className="text-slate-700 mb-4">
                "Best dealership experience I've ever had. No pressure, just honest advice and great prices."
              </p>
              <p className="font-semibold">- Michael Chen</p>
            </div>
            <div className="bg-slate-50 rounded-lg p-6">
              <div className="flex items-center mb-4">
                {[...Array(5)].map((_, i) => (
                  <svg key={i} className="w-5 h-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                ))}
              </div>
              <p className="text-slate-700 mb-4">
                "The financing team worked with my credit situation and got me approved. I love my new car!"
              </p>
              <p className="font-semibold">- David Martinez</p>
            </div>
          </div>
        </div>
      </section>

      {/* Awards & Recognition */}
      <section className="py-16 bg-slate-50">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-12">Awards & Recognition</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 max-w-4xl mx-auto">
            <div className="text-center">
              <div className="bg-white rounded-lg p-6 shadow-sm mb-3">
                <svg className="w-16 h-16 mx-auto text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
              </div>
              <p className="font-semibold text-sm">Top Rated Dealer 2024</p>
            </div>
            <div className="text-center">
              <div className="bg-white rounded-lg p-6 shadow-sm mb-3">
                <svg className="w-16 h-16 mx-auto text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              </div>
              <p className="font-semibold text-sm">Certified Excellence</p>
            </div>
            <div className="text-center">
              <div className="bg-white rounded-lg p-6 shadow-sm mb-3">
                <svg className="w-16 h-16 mx-auto text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="font-semibold text-sm">Best Value Award</p>
            </div>
            <div className="text-center">
              <div className="bg-white rounded-lg p-6 shadow-sm mb-3">
                <svg className="w-16 h-16 mx-auto text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
                </svg>
              </div>
              <p className="font-semibold text-sm">Customer Choice</p>
            </div>
          </div>
        </div>
      </section>

      {/* Call to Action */}
      <section className="py-16 bg-blue-600 text-white">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold mb-4">Ready to Get Started?</h2>
          <p className="text-xl mb-8 opacity-90">
            Our team is here to help you find the perfect vehicle.
          </p>
          <div className="flex justify-center gap-4">
            <Link
              href="/contact"
              className="bg-white hover:bg-slate-100 text-blue-600 px-8 py-3 rounded-lg font-semibold transition-colors"
            >
              Contact Us
            </Link>
            <a
              href="tel:5551234567"
              className="border-2 border-white hover:bg-white hover:text-blue-600 px-8 py-3 rounded-lg font-semibold transition-colors"
            >
              Call (555) 123-4567
            </a>
          </div>
        </div>
      </section>
    </div>
  )
}
