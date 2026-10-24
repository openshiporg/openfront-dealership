'use client'

import { useEffect, useState } from 'react'

import { getCustomer } from '../actions/account'

export type CustomerPrefill = { name: string; firstName: string; lastName: string; email: string; phone: string }

/** The signed-in customer's contact details for request forms; null for guests or until loaded. */
export function useCustomerPrefill(): CustomerPrefill | null {
  const [prefill, setPrefill] = useState<CustomerPrefill | null>(null)

  useEffect(() => {
    let active = true
    void getCustomer()
      .then((customer) => {
        if (!active || !customer) return
        const name = String(customer.name || '').trim().replace(/\s+/g, ' ')
        const [firstName = '', ...rest] = name ? name.split(' ') : []
        setPrefill({
          name,
          firstName,
          lastName: rest.join(' '),
          email: String(customer.email || '').trim(),
          phone: String(customer.phone || '').trim(),
        })
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [])

  return prefill
}

/** Fills only the fields the customer has not typed into yet. */
export function fillBlankFields<T extends Record<string, unknown>>(current: T, values: Partial<Record<keyof T, string>>): T {
  let next = current
  for (const [key, value] of Object.entries(values) as [keyof T, string | undefined][]) {
    if (value && current[key] === '') {
      if (next === current) next = { ...current }
      next[key] = value as T[keyof T]
    }
  }
  return next
}
