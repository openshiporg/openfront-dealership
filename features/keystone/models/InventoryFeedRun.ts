import { list } from '@keystone-6/core'
import { integer, json, relationship, select, text, timestamp } from '@keystone-6/core/fields'

import { permissions } from '../access'
import { rooftopField, withRooftopScope } from '../tenantRecords'
import { trackingFields } from './trackingFields'

export const InventoryFeedRun = list({
  access: {
    operation: { query: permissions.canManageInventory, create: () => false, update: () => false, delete: () => false },
    filter: { query: ({ session }) => withRooftopScope(true, session as any, 'canManageInventory') },
  },
  ui: { hideCreate: true, hideDelete: true, listView: { initialColumns: ['channelKey', 'status', 'attemptedCount', 'succeededCount', 'failedCount', 'completedAt'] } },
  fields: {
    ...trackingFields,
    rooftop: rooftopField(),
    runKey: text({ validation: { isRequired: true }, isIndexed: 'unique' }),
    channelKey: text({ validation: { isRequired: true }, isIndexed: true }),
    status: select({ type: 'string', options: ['succeeded', 'partial', 'failed'].map(value => ({ label: value, value })), validation: { isRequired: true } }),
    attemptedCount: integer({ validation: { isRequired: true, min: 0 } }),
    succeededCount: integer({ validation: { isRequired: true, min: 0 } }),
    failedCount: integer({ validation: { isRequired: true, min: 0 } }),
    requestSnapshot: json({ defaultValue: {} }),
    responseSummary: json({ defaultValue: {} }),
    startedAt: timestamp({ validation: { isRequired: true } }),
    completedAt: timestamp({ validation: { isRequired: true } }),
    recordedBy: relationship({ ref: 'User' }),
    errors: relationship({ ref: 'InventoryFeedError.run', many: true }),
  },
})
