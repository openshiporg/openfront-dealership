import { list } from '@keystone-6/core'
import { denyAll } from '@keystone-6/core/access'
import { integer, json, relationship, select, text, timestamp } from '@keystone-6/core/fields'

import { permissions } from '../access'
import { rooftopField, validateRooftopRecord, withRooftopScope } from '../tenantRecords'
import { trackingFields } from './trackingFields'

const restricted = { read: permissions.canManageFinancing, create: () => false, update: () => false }

export const LenderDecision = list({
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
    validate: (args: any) => validateRooftopRecord(args, [
      { field: 'application', listKey: 'FinancingApplication' },
      { field: 'submission', listKey: 'LenderSubmission' },
      { field: 'recordedBy', listKey: 'User', kind: 'user' },
    ]),
  },
  ui: {
    hideCreate: true,
    hideDelete: true,
    listView: { initialColumns: ['application', 'providerKey', 'decision', 'approvedAmountCents', 'decidedAt'] },
  },
  fields: {
    ...trackingFields,
    rooftop: rooftopField(),
    application: relationship({ ref: 'FinancingApplication.decisions' }),
    submission: relationship({ ref: 'LenderSubmission' }),
    idempotencyKey: text({
      validation: { isRequired: true },
      isIndexed: 'unique',
      access: { read: denyAll, create: () => false, update: () => false },
      ui: { itemView: { fieldMode: 'hidden' }, listView: { fieldMode: 'hidden' } },
    }),
    providerKey: text({ validation: { isRequired: true } }),
    externalReference: text({ db: { isNullable: true } }),
    decision: select({
      type: 'string',
      options: [
        { label: 'Approved', value: 'approved' },
        { label: 'Declined', value: 'declined' },
        { label: 'Conditional', value: 'conditional' },
        { label: 'Expired', value: 'expired' },
        { label: 'Cancelled', value: 'cancelled' },
      ],
      validation: { isRequired: true },
    }),
    approvedAmountCents: integer({ validation: { min: 0 } }),
    aprBasisPoints: integer({ validation: { min: 0 } }),
    termMonths: integer({ validation: { min: 0 } }),
    monthlyPaymentCents: integer({ validation: { min: 0 } }),
    reasonCodes: json({ access: restricted, defaultValue: [] }),
    immutableSnapshot: json({ access: restricted, defaultValue: {}, ui: { itemView: { fieldMode: 'read' } } }),
    decidedAt: timestamp({ validation: { isRequired: true } }),
    recordedBy: relationship({ ref: 'User' }),
    selectedForDeals: relationship({ ref: 'Deal.selectedLenderDecision', many: true, access: restricted }),
  },
})
