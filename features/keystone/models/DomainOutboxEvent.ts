import { list } from '@keystone-6/core'
import { integer, json, select, text, timestamp } from '@keystone-6/core/fields'

import { permissions } from '../access'
import { rooftopField, withRooftopScope } from '../tenantRecords'
import { trackingFields } from './trackingFields'

export const DomainOutboxEvent = list({
  access: {
    operation: {
      query: permissions.canViewReports,
      create: () => false,
      update: () => false,
      delete: () => false,
    },
    filter: { query: ({ session }) => withRooftopScope(true, session as any, 'canViewReports') },
  },
  ui: {
    hideCreate: true,
    hideDelete: true,
    listView: { initialColumns: ['topic', 'aggregateType', 'aggregateId', 'status', 'availableAt', 'attemptCount'] },
  },
  fields: {
    ...trackingFields,
    rooftop: rooftopField(),
    deliveryKey: text({ validation: { isRequired: true }, isIndexed: 'unique' }),
    topic: text({ validation: { isRequired: true }, isIndexed: true }),
    aggregateType: text({ validation: { isRequired: true }, isIndexed: true }),
    aggregateId: text({ validation: { isRequired: true } }),
    payload: json({ defaultValue: {} }),
    status: select({
      type: 'string',
      options: [
        { label: 'Pending', value: 'pending' },
        { label: 'Processing', value: 'processing' },
        { label: 'Delivered', value: 'delivered' },
        { label: 'Failed', value: 'failed' },
      ],
      defaultValue: 'pending',
      validation: { isRequired: true },
      isIndexed: true,
    }),
    attemptCount: integer({ defaultValue: 0, validation: { isRequired: true, min: 0 } }),
    availableAt: timestamp({ validation: { isRequired: true }, defaultValue: { kind: 'now' }, isIndexed: true }),
    processedAt: timestamp(),
    lastError: text({ db: { isNullable: true } }),
  },
})
