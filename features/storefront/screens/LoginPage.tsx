'use client'

import { useActionState, useState } from 'react'
import Link from 'next/link'

import { signInCustomer, signUpCustomer, type AccountState } from '../actions/account'

const INITIAL: AccountState = { error: null }

export function LoginPage() {
  const [view, setView] = useState<'signin' | 'signup'>('signin')
  const [signinState, signinAction, signinPending] = useActionState(signInCustomer, INITIAL)
  const [signupState, signupAction, signupPending] = useActionState(signUpCustomer, INITIAL)

  return (
    <section className="w-full max-w-sm">
      <p className="sf-eyebrow text-center">Account</p>
      <h1 className="sf-display mt-3 text-center text-[length:var(--sf-text-2xl)]">
        {view === 'signin' ? 'Sign in' : 'Create account'}
      </h1>

      <div role="group" aria-label="Account access" className="sf-track sf-track-block mt-6">
        <button type="button" onClick={() => setView('signin')} aria-pressed={view === 'signin'} className="sf-pill min-h-11">
          Sign in
        </button>
        <button type="button" onClick={() => setView('signup')} aria-pressed={view === 'signup'} className="sf-pill min-h-11">
          Create account
        </button>
      </div>

      <div
        className="mt-5 rounded-[var(--sf-radius-lg)] border p-5 sm:p-6"
        style={{ borderColor: 'var(--sf-rule)', background: 'var(--sf-paper)', boxShadow: 'var(--sf-shadow-float)' }}
      >
        {view === 'signin' ? (
          <form action={signinAction} className="space-y-4">
            <div>
              <label htmlFor="signin-email" className="sf-label">Email</label>
              <input id="signin-email" name="email" type="email" autoComplete="email" required className="sf-input" />
            </div>
            <div>
              <div className="flex items-baseline justify-between gap-3">
                <label htmlFor="signin-password" className="sf-label">Password</label>
                <Link href="/account/reset" className="sf-link -my-3 inline-flex min-h-11 items-center text-[var(--sf-text-xs)]">
                  Forgot password?
                </Link>
              </div>
              <input id="signin-password" name="password" type="password" autoComplete="current-password" required className="sf-input" />
            </div>
            {signinState.error && <div role="alert" className="sf-notice" data-tone="bad">{signinState.error}</div>}
            <button type="submit" disabled={signinPending} className="sf-btn sf-btn-primary w-full">
              {signinPending ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        ) : (
          <form action={signupAction} className="space-y-4">
            <div>
              <label htmlFor="signup-name" className="sf-label">Full name</label>
              <input id="signup-name" name="name" autoComplete="name" required maxLength={200} className="sf-input" />
            </div>
            <div>
              <label htmlFor="signup-email" className="sf-label">Email</label>
              <input id="signup-email" name="email" type="email" autoComplete="email" required className="sf-input" />
            </div>
            <div>
              <label htmlFor="signup-password" className="sf-label">Password</label>
              <input id="signup-password" name="password" type="password" autoComplete="new-password" required minLength={8} className="sf-input" />
            </div>
            {signupState.error && <div role="alert" className="sf-notice" data-tone="bad">{signupState.error}</div>}
            <button type="submit" disabled={signupPending} className="sf-btn sf-btn-primary w-full">
              {signupPending ? 'Creating account…' : 'Create account'}
            </button>
          </form>
        )}
      </div>
    </section>
  )
}
