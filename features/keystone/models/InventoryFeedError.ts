import { list } from '@keystone-6/core'
import { json, relationship, text } from '@keystone-6/core/fields'

import { permissions } from '../access'
import { rooftopField, withRooftopScope } from '../tenantRecords'
import { trackingFields } from './trackingFields'

export const InventoryFeedError = list({
  access: {
    operation: { query: permissions.canManageInventory, create: () => false, update: () => false, delete: () => false },
    filter: { query: ({ session }) => withRooftopScope(true, session as any, 'canManageInventory') },
  },
  ui: { hideCreate: true, hideDelete: true, listView: { initialColumns: ['run', 'errorCode', 'rowReference', 'message'] } },
  fields: {
    ...trackingFields,
    rooftop: rooftopField(),
    run: relationship({ ref: 'InventoryFeedRun.errors', db: { extendPrismaSchema: field => field.replace(/run InventoryFeedRun\?/g, 'run InventoryFeedRun').replace(/runId String\?/g, 'runId String') } }),
    stock: relationship({ ref: 'InventoryStock' }),
    errorCode: text({ validation: { isRequired: true } }),
    message: text({ validation: { isRequired: true, length: { max: 1000 } } }),
    rowReference: text({ validation: { length: { max: 200 } } }),
    evidence: json({ defaultValue: {} }),
  },
})
