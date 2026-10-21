import { list } from '@keystone-6/core'
import { relationship, text, timestamp } from '@keystone-6/core/fields'
import { permissions } from '../access'
import { rooftopField, validateRooftopRecord, withRooftopScope } from '../tenantRecords'
import { requiredRelationshipDb } from './prismaSchema'
import { trackingFields } from './trackingFields'

export const PaymentProviderEvent = list({
  access: {
    operation: { query: ({ session }) => permissions.canViewReports({ session }) || permissions.canReadPayments({ session }) || permissions.canManagePayments({ session }), create: () => false, update: () => false, delete: () => false },
    filter: { query: ({ session }) => withRooftopScope(true, session as any, ['canViewReports', 'canReadPayments', 'canManagePayments']) },
  },
  hooks: { validate: (args: any) => validateRooftopRecord(args, [{ field: 'transaction', listKey: 'PaymentTransaction' }, { field: 'refund', listKey: 'PaymentRefund' }]) },
  ui: { hideCreate: true, hideDelete: true },
  fields: {
    ...trackingFields,
    rooftop: rooftopField(),
    transaction: relationship({ ref: 'PaymentTransaction', db: requiredRelationshipDb('transaction') }),
    refund: relationship({ ref: 'PaymentRefund' }),
    providerKey: text({ validation: { isRequired: true } }),
    providerEventId: text({ validation: { isRequired: true }, isIndexed: 'unique' }),
    eventType: text({ validation: { isRequired: true } }),
    payloadDigest: text({ validation: { isRequired: true } }),
    signatureTimestamp: timestamp({ validation: { isRequired: true } }),
    receivedAt: timestamp({ validation: { isRequired: true } }),
  },
})
