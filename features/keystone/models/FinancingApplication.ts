import { list } from '@keystone-6/core'
import { denyAll } from '@keystone-6/core/access'
import { integer, json, relationship, select, text, timestamp } from '@keystone-6/core/fields'

import { permissions } from '../access'
import { rooftopField, validateRooftopRecord, withRooftopScope } from '../tenantRecords'
import { trackingFields } from './trackingFields'

const privateRead = { read: permissions.canManageFinancing, create: () => false, update: () => false }

export const FinancingApplication = list({
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
      { field: 'lead', listKey: 'Lead' },
      { field: 'vehicle', listKey: 'Vehicle' },
    ]),
  },
  ui: {
    hideCreate: true,
    hideDelete: true,
    listView: { initialColumns: ['reference', 'status', 'lead', 'vehicle', 'requestedAmountCents', 'submittedAt'] },
    labelField: 'reference',
  },
  fields: {
    ...trackingFields,
    rooftop: rooftopField(),
    reference: text({ validation: { isRequired: true }, isIndexed: 'unique' }),
    idempotencyKey: text({
      validation: { isRequired: true },
      isIndexed: 'unique',
      access: { read: denyAll, create: () => false, update: () => false },
      ui: { itemView: { fieldMode: 'hidden' }, listView: { fieldMode: 'hidden' } },
    }),
    status: select({
      type: 'string',
      options: [
        { label: 'Submitted', value: 'submitted' },
        { label: 'Under Review', value: 'under-review' },
        { label: 'Approved', value: 'approved' },
        { label: 'Declined', value: 'declined' },
        { label: 'Expired', value: 'expired' },
        { label: 'Cancelled', value: 'cancelled' },
      ],
      defaultValue: 'submitted',
      validation: { isRequired: true },
    }),
    lead: relationship({ ref: 'Lead.financingApplications' }),
    vehicle: relationship({ ref: 'Vehicle.financingApplications' }),
    applicantName: text({ access: privateRead, validation: { isRequired: true } }),
    applicantEmail: text({ access: privateRead, validation: { isRequired: true } }),
    applicantPhone: text({ access: privateRead, validation: { isRequired: true } }),
    employmentStatus: text({ access: privateRead, validation: { isRequired: true } }),
    annualIncomeCents: integer({ access: privateRead, validation: { isRequired: true, min: 1 } }),
    selfReportedCreditTier: text({ access: privateRead, validation: { isRequired: true } }),
    requestedAmountCents: integer({ validation: { min: 0 } }),
    plannedMonthlyPaymentCents: integer({ validation: { min: 0 } }),
    plannedDownPaymentCents: integer({ validation: { min: 0 } }),
    tradeInValueCents: integer({ validation: { min: 0 } }),
    aprBasisPoints: integer({ validation: { min: 0 } }),
    loanTermMonths: integer({ validation: { min: 0 } }),
    consentAt: timestamp({ validation: { isRequired: true } }),
    submittedAt: timestamp({ validation: { isRequired: true } }),
    lockedAt: timestamp({ validation: { isRequired: true } }),
    immutableSnapshot: json({
      access: privateRead,
      defaultValue: {},
      ui: { itemView: { fieldMode: 'read' } },
    }),
    submissions: relationship({ ref: 'LenderSubmission.application', many: true }),
    decisions: relationship({ ref: 'LenderDecision.application', many: true }),
  },
})
