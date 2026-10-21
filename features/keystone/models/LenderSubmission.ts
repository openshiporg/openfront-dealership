import { list } from '@keystone-6/core'
import { denyAll } from '@keystone-6/core/access'
import { json, relationship, select, text, timestamp } from '@keystone-6/core/fields'

import { permissions } from '../access'
import { rooftopField, validateRooftopRecord, withRooftopScope } from '../tenantRecords'
import { trackingFields } from './trackingFields'

const restricted = { read: permissions.canManageFinancing, create: () => false, update: () => false }

export const LenderSubmission = list({
  access: {
    operation: {
      query: permissions.canManageFinancing,
      create: () => false,
      update: () => false,
      delete: () => false,
    },
    filter: { query: ({ session }) => withRooftopScope(true, session as any, 'canManageFinancing') },
  },
  hooks: {
    validate: (args: any) => validateRooftopRecord(args, [{ field: 'application', listKey: 'FinancingApplication' }]),
  },
  ui: {
    hideCreate: true,
    hideDelete: true,
    listView: { initialColumns: ['application', 'providerKey', 'status', 'queuedAt', 'submittedAt'] },
  },
  fields: {
    ...trackingFields,
    rooftop: rooftopField(),
    application: relationship({ ref: 'FinancingApplication.submissions' }),
    providerKey: text({ validation: { isRequired: true } }),
    idempotencyKey: text({
      validation: { isRequired: true },
      isIndexed: 'unique',
      access: { read: denyAll, create: () => false, update: () => false },
      ui: { itemView: { fieldMode: 'hidden' }, listView: { fieldMode: 'hidden' } },
    }),
    status: select({
      type: 'string',
      options: [
        { label: 'Queued', value: 'queued' },
        { label: 'Submitted', value: 'submitted' },
        { label: 'Failed', value: 'failed' },
      ],
      defaultValue: 'queued',
      validation: { isRequired: true },
    }),
    externalReference: text({ db: { isNullable: true } }),
    requestSnapshot: json({ access: restricted, defaultValue: {}, ui: { itemView: { fieldMode: 'read' } } }),
    responseSummary: json({ access: restricted, defaultValue: {}, ui: { itemView: { fieldMode: 'read' } } }),
    errorCode: text({ db: { isNullable: true } }),
    queuedAt: timestamp({ validation: { isRequired: true } }),
    submittedAt: timestamp(),
  },
})
