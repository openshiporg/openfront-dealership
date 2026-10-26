'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'

import { confirmCustomerEmail } from '../../actions/customerRecords'
import { Notice } from '../forms/RequestForm'

export function VerifyEmailConfirm({ token }: { token: string }) {
  const [pending, startTransition] = useTransition()
  const [state, setState] = useState<{ tone: 'ok' | 'bad'; text: string } | null>(null)

  const confirm = () => {
    setState(null)
    startTransition(async () => {
      const result = await confirmCustomerEmail(token)
      if (!result.ok) {
        setState({ tone: 'bad', text: result.error })
        return
      }
      const added = Number(result.link.newlyLinkedCount || 0)
      setState({ tone: 'ok', text: `${result.link.email} verified. ${added === 1 ? '1 customer record' : `${added} customer records`} linked.` })
    })
  }

  return (
    <div className="space-y-4">
      {state && <Notice tone={state.tone}>{state.text}</Notice>}
      {state?.tone === 'ok' ? (
        <Link href="/account" className="sf-btn sf-btn-primary">View requests</Link>
      ) : (
        <button type="button" onClick={confirm} disabled={pending} className="sf-btn sf-btn-primary">
          {pending ? 'Confirming' : 'Confirm email'}
        </button>
      )}
    </div>
  )
}
