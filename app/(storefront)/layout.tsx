import Link from 'next/link'
import { ComparisonBar } from './components/ComparisonBar'
import { Header } from './components/Header'

export default function StorefrontLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <Header />

      {/* Main Content */}
      <main className="flex-1 pb-20">
        {children}
      </main>

      {/* Comparison Bar */}
      <ComparisonBar />

      {/* Footer */}
      <footer className="bg-slate-800 text-white py-12">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <h3 className="font-bold text-lg mb-4">Openfront Dealership</h3>
              <p className="text-slate-400">
                Your trusted source for quality new and pre-owned vehicles.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Quick Links</h4>
              <ul className="space-y-2 text-slate-400">
                <li><Link href="/inventory" className="hover:text-white">Browse Inventory</Link></li>
                <li><Link href="/financing" className="hover:text-white">Apply for Financing</Link></li>
                <li><Link href="/trade-in" className="hover:text-white">Value Your Trade</Link></li>
                <li><Link href="/test-drive" className="hover:text-white">Schedule Test Drive</Link></li>
                <li><Link href="/service" className="hover:text-white">Service Center</Link></li>
                <li><Link href="/contact" className="hover:text-white">Contact Us</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Hours</h4>
              <ul className="space-y-1 text-slate-400">
                <li>Mon-Fri: 9AM - 8PM</li>
                <li>Saturday: 9AM - 6PM</li>
                <li>Sunday: 11AM - 5PM</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Contact</h4>
              <ul className="space-y-1 text-slate-400">
                <li>123 Auto Drive</li>
                <li>Anytown, USA 12345</li>
                <li>(555) 123-4567</li>
                <li>sales@openfrontdealership.com</li>
              </ul>
            </div>
          </div>
          <div className="border-t border-slate-700 mt-8 pt-8 text-center text-slate-400">
            <p>&copy; {new Date().getFullYear()} Openfront Dealership. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
