'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { getComparisonVehicles } from '../lib/comparison'

export function Header() {
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState('')
  const [savedCount, setSavedCount] = useState(0)
  const [showMobileMenu, setShowMobileMenu] = useState(false)
  const [hasPromotions] = useState(true) // This could be fetched from API

  useEffect(() => {
    // Update saved vehicles count
    const updateSavedCount = () => {
      const vehicles = getComparisonVehicles()
      setSavedCount(vehicles.length)
    }

    updateSavedCount()
    window.addEventListener('comparison-updated', updateSavedCount)
    return () => window.removeEventListener('comparison-updated', updateSavedCount)
  }, [])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchQuery.trim()) {
      router.push(`/inventory?search=${encodeURIComponent(searchQuery.trim())}`)
      setSearchQuery('')
    }
  }

  return (
    <header className="bg-slate-900 text-white sticky top-0 z-50 shadow-lg">
      {/* Top Bar */}
      <div className="bg-slate-800 border-b border-slate-700">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between py-2 text-sm">
            <div className="flex items-center gap-4">
              <a href="tel:5551234567" className="flex items-center gap-2 hover:text-blue-400 transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
                <span className="font-semibold">(555) 123-4567</span>
              </a>
              <span className="text-slate-400 hidden sm:inline">Mon-Fri: 9AM-8PM | Sat: 9AM-6PM</span>
            </div>
            <div className="flex items-center gap-4">
              {hasPromotions && (
                <Link href="/#promotions" className="flex items-center gap-1 bg-blue-600 px-3 py-1 rounded-full text-xs font-semibold hover:bg-blue-700 transition-colors">
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                  Current Specials
                </Link>
              )}
              <Link href="/contact" className="hover:text-blue-400 transition-colors text-xs">
                Contact Us
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Main Header */}
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between py-4">
          {/* Logo */}
          <Link href="/" className="text-2xl font-bold flex items-center gap-2 hover:text-blue-400 transition-colors">
            <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20">
              <path d="M8 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM15 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" />
              <path d="M3 4a1 1 0 00-1 1v10a1 1 0 001 1h1.05a2.5 2.5 0 014.9 0H10a1 1 0 001-1V5a1 1 0 00-1-1H3zM14 7a1 1 0 00-1 1v6.05A2.5 2.5 0 0115.95 16H17a1 1 0 001-1v-5a1 1 0 00-.293-.707l-2-2A1 1 0 0015 7h-1z" />
            </svg>
            <span className="hidden sm:inline">Openfront Dealership</span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-6">
            <Link href="/inventory" className="hover:text-blue-400 transition-colors font-medium">
              Inventory
            </Link>
            <Link href="/financing" className="hover:text-blue-400 transition-colors font-medium">
              Financing
            </Link>
            <Link href="/trade-in" className="hover:text-blue-400 transition-colors font-medium">
              Trade-In
            </Link>
            <Link href="/service" className="hover:text-blue-400 transition-colors font-medium">
              Service
            </Link>
          </nav>

          {/* Search and Actions */}
          <div className="flex items-center gap-4">
            {/* Search Bar - Desktop */}
            <form onSubmit={handleSearch} className="hidden lg:flex items-center">
              <div className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search inventory..."
                  className="bg-slate-800 border border-slate-700 rounded-lg pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent w-64 text-white placeholder-slate-400"
                />
                <svg className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
            </form>

            {/* Saved Vehicles */}
            <Link
              href="/compare"
              className="relative p-2 hover:bg-slate-800 rounded-lg transition-colors"
              title="Saved Vehicles"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
              {savedCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-blue-600 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                  {savedCount}
                </span>
              )}
            </Link>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setShowMobileMenu(!showMobileMenu)}
              className="md:hidden p-2 hover:bg-slate-800 rounded-lg transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {showMobileMenu ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile Search */}
        <div className="lg:hidden pb-4">
          <form onSubmit={handleSearch} className="w-full">
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search inventory..."
                className="bg-slate-800 border border-slate-700 rounded-lg pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent w-full text-white placeholder-slate-400"
              />
              <svg className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </form>
        </div>

        {/* Mobile Menu */}
        {showMobileMenu && (
          <div className="md:hidden pb-4 border-t border-slate-700 pt-4">
            <nav className="flex flex-col gap-3">
              <Link
                href="/inventory"
                className="hover:bg-slate-800 px-3 py-2 rounded-lg transition-colors font-medium"
                onClick={() => setShowMobileMenu(false)}
              >
                Inventory
              </Link>
              <Link
                href="/financing"
                className="hover:bg-slate-800 px-3 py-2 rounded-lg transition-colors font-medium"
                onClick={() => setShowMobileMenu(false)}
              >
                Financing
              </Link>
              <Link
                href="/trade-in"
                className="hover:bg-slate-800 px-3 py-2 rounded-lg transition-colors font-medium"
                onClick={() => setShowMobileMenu(false)}
              >
                Trade-In
              </Link>
              <Link
                href="/service"
                className="hover:bg-slate-800 px-3 py-2 rounded-lg transition-colors font-medium"
                onClick={() => setShowMobileMenu(false)}
              >
                Service
              </Link>
              <Link
                href="/contact"
                className="hover:bg-slate-800 px-3 py-2 rounded-lg transition-colors font-medium"
                onClick={() => setShowMobileMenu(false)}
              >
                Contact
              </Link>
            </nav>
          </div>
        )}
      </div>
    </header>
  )
}
