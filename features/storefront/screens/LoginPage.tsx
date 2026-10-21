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
    <section className="sf-card w-full max-w-md p-[var(--sf-space-lg)]">
      <p className="sf-eyebrow mb-3">Your account</p>
      <h1 className="sf-display text-[length:var(--sf-text-2xl)] mb-6">
        {view === 'signin' ? 'Welcome back.' : 'Create your account.'}
      </h1>

      {view === 'signin' ? (
        <form action={signinAction} className="space-y-5">
          <div>
            <label htmlFor="signin-email" className="sf-eyebrow block mb-2">Email</label>
            <input id="signin-email" name="email" type="email" autoComplete="email" required className="sf-input min-h-11" />
          </div>
          <div>
            <label htmlFor="signin-password" className="sf-eyebrow block mb-2">Password</label>
            <input id="signin-password" name="password" type="password" autoComplete="current-password" required className="sf-input min-h-11" />
          </div>
          {signinState.error && <p role="alert" className="text-[var(--sf-text-sm)]">{signinState.error}</p>}
          <button type="submit" disabled={signinPending} className="sf-btn sf-btn-primary w-full min-h-11">
            {signinPending ? 'Signing in…' : 'Sign in'}
          </button>
          <Link href="/account/reset" className="inline-flex min-h-11 items-center text-[var(--sf-text-sm)] underline underline-offset-2">
            Forgot password?
          </Link>
        </form>
      ) : (
        <form action={signupAction} className="space-y-5">
          <div>
            <label htmlFor="signup-name" className="sf-eyebrow block mb-2">Full name</label>
            <input id="signup-name" name="name" autoComplete="name" required maxLength={200} className="sf-input min-h-11" />
          </div>
          <div>
            <label htmlFor="signup-email" className="sf-eyebrow block mb-2">Email</label>
            <input id="signup-email" name="email" type="email" autoComplete="email" required className="sf-input min-h-11" />
          </div>
          <div>
            <label htmlFor="signup-password" className="sf-eyebrow block mb-2">Password</label>
            <input id="signup-password" name="password" type="password" autoComplete="new-password" required minLength={8} className="sf-input min-h-11" />
          </div>
          {signupState.error && <p role="alert" className="text-[var(--sf-text-sm)]">{signupState.error}</p>}
          <button type="submit" disabled={signupPending} className="sf-btn sf-btn-primary w-full min-h-11">
            {signupPending ? 'Creating account…' : 'Create account'}
          </button>
        </form>
      )}

      <p className="mt-8 border-t pt-6 text-[var(--sf-text-sm)]" style={{ borderColor: 'var(--sf-rule)', color: 'var(--sf-ink-2)' }}>
        {view === 'signin' ? (
          <>Don&apos;t have an account?{' '}
            <button type="button" onClick={() => setView('signup')} className="font-semibold underline underline-offset-2">Create one</button>
          </>
        ) : (
          <>Already have an account?{' '}
            <button type="button" onClick={() => setView('signin')} className="font-semibold underline underline-offset-2">Sign in</button>
          </>
        )}
      </p>
    </section>
  )
}
