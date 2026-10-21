import { list } from '@keystone-6/core'
import { integer, json, relationship, select, text, timestamp } from '@keystone-6/core/fields'

import { permissions } from '../access'
import { rooftopField, withRooftopScope } from '../tenantRecords'
import { trackingFields } from './trackingFields'

export const InventoryMerchandisingVersion = list({
  access: {
    operation: { query: permissions.canManageInventory, create: () => false, update: () => false, delete: () => false },
    filter: { query: ({ session }) => withRooftopScope(true, session as any, 'canManageInventory') },
  },
  ui: { hideCreate: true, hideDelete: true, listView: { initialColumns: ['stock', 'version', 'status', 'submittedAt', 'decidedAt'] } },
  fields: {
    ...trackingFields,
    rooftop: rooftopField(),
    stock: relationship({ ref: 'InventoryStock.merchandisingVersions', db: { extendPrismaSchema: field => field.replace(/stock InventoryStock\?/g, 'stock InventoryStock').replace(/stockId String\?/g, 'stockId String') } }),
    version: integer({ validation: { isRequired: true, min: 1 } }),
    versionKey: text({ validation: { isRequired: true }, isIndexed: 'unique' }),
    status: select({ type: 'string', options: ['submitted', 'approved', 'rejected'].map(value => ({ label: value, value })), defaultValue: 'submitted' }),
    snapshot: json({ defaultValue: {} }),
    submittedBy: relationship({ ref: 'User' }),
    submittedAt: timestamp({ validation: { isRequired: true }, defaultValue: { kind: 'now' } }),
    decidedBy: relationship({ ref: 'User' }),
    decidedAt: timestamp(),
    decisionReason: text({ validation: { length: { max: 500 } } }),
  },
})
