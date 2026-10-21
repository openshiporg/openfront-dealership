// Unused: nothing reads or writes this list. It is kept so existing rows and
// migrations stay intact; do not add new consumers.
import { list } from '@keystone-6/core'
import { integer, text, timestamp } from '@keystone-6/core/fields'
import { trackingFields } from './trackingFields'

export const AuthenticationThrottle = list({
  access: { operation: { query: () => false, create: () => false, update: () => false, delete: () => false } },
  graphql: { omit: true },
  ui: { isHidden: true },
  fields: {
    ...trackingFields,
    keyHash: text({ validation: { isRequired: true }, isIndexed: 'unique' }),
    purpose: text({ validation: { isRequired: true } }),
    failureCount: integer({ validation: { isRequired: true, min: 0 }, defaultValue: 0 }),
    windowStartedAt: timestamp({ validation: { isRequired: true } }),
    blockedUntil: timestamp({ isIndexed: true }),
    updatedAt: timestamp({
      access: { create: () => false, update: () => false },
      defaultValue: { kind: 'now' },
      db: { isNullable: false, updatedAt: true },
      isIndexed: true,
      ui: { createView: { fieldMode: 'hidden' }, itemView: { fieldMode: 'read' } },
    }),
  },
})
