'use client'

import { useActionState, type ReactNode } from 'react'

import type { AccountState } from '../../actions/account'

export function ProfileField({
  title,
  action,
  children,
}: {
  title: string
  action: (state: AccountState, data: FormData) => Promise<AccountState>
  children: ReactNode
}) {
  const [state, formAction, pending] = useActionState(action, { error: null })

  return (
    <form action={formAction} className="sf-card p-[var(--sf-space-md)]">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex-1 max-w-xl space-y-3">
          <p className="font-semibold">{title}</p>
          {children}
          {state.error && <p role="alert" className="text-[var(--sf-text-sm)]">{state.error}</p>}
          {!state.error && state.success && !pending && <p role="status" className="text-[var(--sf-text-sm)]">{state.success}</p>}
        </div>
        <button type="submit" disabled={pending} className="sf-btn sf-btn-ghost min-h-11">
          {pending ? 'Saving…' : 'Save'}
        </button>
      </div>
    </form>
  )
}
