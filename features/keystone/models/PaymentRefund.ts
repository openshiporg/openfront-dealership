import { list } from '@keystone-6/core'
import { integer, relationship, select, text } from '@keystone-6/core/fields'
import { permissions } from '../access'
import { rooftopField, validateRooftopRecord, withRooftopScope } from '../tenantRecords'
import { requiredRelationshipDb } from './prismaSchema'
import { trackingFields } from './trackingFields'

export const PaymentRefund = list({
  access: {
    operation: { query: ({ session }) => permissions.canViewReports({ session }) || permissions.canReadPayments({ session }) || permissions.canManagePayments({ session }), create: () => false, update: () => false, delete: () => false },
    filter: { query: ({ session }) => withRooftopScope(true, session as any, ['canViewReports', 'canReadPayments', 'canManagePayments']) },
  },
  hooks: { validate: (args: any) => validateRooftopRecord(args, [{ field: 'transaction', listKey: 'PaymentTransaction' }]) },
  ui: { hideCreate: true, hideDelete: true },
  fields: {
    ...trackingFields,
    rooftop: rooftopField(),
    transaction: relationship({ ref: 'PaymentTransaction', db: requiredRelationshipDb('transaction') }),
    amountCents: integer({ validation: { isRequired: true, min: 1 } }),
    reason: text({ validation: { isRequired: true } }),
    status: select({ type: 'string', options: ['creating', 'pending', 'succeeded', 'failed', 'canceled'].map(value => ({ label: value, value })), validation: { isRequired: true } }),
    providerRefundId: text(),
    failureCode: text(),
    idempotencyKey: text({ validation: { isRequired: true }, isIndexed: 'unique' }),
  },
})
