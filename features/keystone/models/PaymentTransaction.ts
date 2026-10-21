import { list } from '@keystone-6/core'
import { integer, relationship, select, text, timestamp } from '@keystone-6/core/fields'
import { permissions } from '../access'
import { rooftopField, validateRooftopRecord, withRooftopScope } from '../tenantRecords'
import { trackingFields } from './trackingFields'

export const PaymentTransaction = list({
  access: {
    operation: { query: ({ session }) => permissions.canViewReports({ session }) || permissions.canReadPayments({ session }) || permissions.canManagePayments({ session }), create: () => false, update: () => false, delete: () => false },
    filter: { query: ({ session }) => withRooftopScope(true, session as any, ['canViewReports', 'canReadPayments', 'canManagePayments']) },
  },
  hooks: {
    validate: (args: any) => validateRooftopRecord(args, [
      { field: 'deal', listKey: 'Deal' },
      { field: 'serviceOrder', listKey: 'ServiceOrder' },
    ]),
  },
  ui: { hideCreate: true, hideDelete: true, listView: { initialColumns: ['sourceType', 'amountCents', 'status', 'providerKey', 'updatedAt'] } },
  fields: {
    ...trackingFields,
    rooftop: rooftopField(),
    deal: relationship({ ref: 'Deal.paymentTransactions' }),
    serviceOrder: relationship({ ref: 'ServiceOrder.paymentTransactions' }),
    sourceType: select({ type: 'string', options: ['deal', 'service'].map(value => ({ label: value, value })), validation: { isRequired: true } }),
    amountCents: integer({ validation: { isRequired: true, min: 1 } }),
    currency: text({ validation: { isRequired: true }, defaultValue: 'usd' }),
    providerKey: text({ validation: { isRequired: true } }),
    paymentProvider: relationship({ ref: 'PaymentProvider.transactions' }),
    providerTransactionId: text(),
    providerSessionId: text(),
    checkoutUrl: text(),
    status: select({ type: 'string', options: ['creating', 'pending', 'authorized', 'captured', 'failed', 'canceled', 'partially-refunded', 'refunded'].map(value => ({ label: value, value })), validation: { isRequired: true } }),
    capturedCents: integer({ validation: { isRequired: true, min: 0 }, defaultValue: 0 }),
    refundedCents: integer({ validation: { isRequired: true, min: 0 }, defaultValue: 0 }),
    failureCode: text(),
    reconciliationReference: text(),
    reconciledAt: timestamp(),
    version: integer({ validation: { isRequired: true, min: 1 }, defaultValue: 1 }),
    idempotencyKey: text({ validation: { isRequired: true }, isIndexed: 'unique' }),
  },
})
