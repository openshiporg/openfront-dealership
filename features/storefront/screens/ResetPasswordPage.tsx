'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'

import { resetCustomerPassword, type AccountState } from '../actions/account'

export function ResetPasswordPage() {
  const params = useSearchParams()
  const token = params?.get('token') || ''
  const [state, formAction, pending] = useActionState<AccountState, FormData>(resetCustomerPassword, { error: null })
  const title = token ? 'Set a new password' : 'Forgot password'

  return (
    <section className="sf-card w-full max-w-md p-[var(--sf-space-lg)]">
      <h1 className="sf-display text-[length:var(--sf-text-2xl)] mb-6">{title}</h1>
      <form action={formAction} className="space-y-5">
        <div>
          <label htmlFor="reset-email" className="sf-eyebrow block mb-2">Email</label>
          <input id="reset-email" name="email" type="email" autoComplete="email" required defaultValue={params?.get('email') || ''} className="sf-input min-h-11" />
        </div>
        {token && (
          <div>
            <label htmlFor="reset-password" className="sf-eyebrow block mb-2">New password</label>
            <input id="reset-password" name="password" type="password" autoComplete="new-password" required minLength={8} className="sf-input min-h-11" />
            <input type="hidden" name="token" value={token} />
          </div>
        )}
        {state.error && <p role="alert" className="text-[var(--sf-text-sm)]">{state.error}</p>}
        {state.success && <p role="status" className="text-[var(--sf-text-sm)]">{state.success}</p>}
        <button type="submit" disabled={pending} className="sf-btn sf-btn-primary w-full min-h-11">
          {pending ? (token ? 'Saving…' : 'Sending…') : token ? 'Set password' : 'Send reset link'}
        </button>
      </form>
      <Link href="/account" className="mt-6 inline-flex min-h-11 items-center text-[var(--sf-text-sm)] underline underline-offset-2">
        Back to account
      </Link>
    </section>
  )
}
