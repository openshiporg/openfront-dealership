'use client'

import { useState, useTransition } from 'react'
import { MailCheck } from 'lucide-react'

import { sendCustomerEmailVerification } from '../../actions/customerRecords'
import type { CustomerEmailLink } from '../../lib/accountRecords'
import { Notice, PILL_TARGET } from '../forms/RequestForm'

export function EmailLinkPanel({ link }: { link: CustomerEmailLink | null }) {
  const [pending, startTransition] = useTransition()
  const [result, setResult] = useState<{ tone: 'ok' | 'bad'; text: string } | null>(null)

  if (!link) return null

  const send = () => {
    setResult(null)
    startTransition(async () => {
      const response = await sendCustomerEmailVerification()
      setResult(response.ok ? { tone: 'ok', text: response.message || 'Verification email sent.' } : { tone: 'bad', text: response.error })
    })
  }

  return (
    <section className="sf-well mt-[var(--sf-space-lg)] space-y-3 p-4 sm:p-5" aria-labelledby="email-link-title">
      <h2 id="email-link-title" className="sf-title-line">
        <span className="sf-dot" data-tone={link.verified ? 'ok' : 'warn'} aria-hidden="true" />
        <span className="sf-heading text-[length:var(--sf-text-md)]">
          {link.verified ? 'Email verified' : 'Email not verified'}
        </span>
      </h2>
      <p className="sf-muted break-all pl-4 text-[length:var(--sf-text-sm)]">
        {link.verified
          ? `Requests made with ${link.email} are linked to this account.`
          : `Verify ${link.email} to link requests made with it before you signed in.`}
      </p>
      {result && <Notice tone={result.tone}>{result.text}</Notice>}
      <div className="sf-track">
        <button type="button" onClick={send} disabled={pending} className={`sf-pill ${link.verified ? '' : 'sf-pill-raised'} ${PILL_TARGET} px-4`}>
          <MailCheck className="size-4" aria-hidden="true" />
          {pending ? 'Sending' : link.verified ? 'Link new requests' : 'Send verification email'}
        </button>
      </div>
    </section>
  )
}
