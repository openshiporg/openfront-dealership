import { list } from '@keystone-6/core'
import { integer, json, relationship, text, timestamp } from '@keystone-6/core/fields'

import { permissions } from '../access'
import { rooftopField, withRooftopScope } from '../tenantRecords'
import { trackingFields } from './trackingFields'

export const InventoryStockEvent = list({
  access: {
    operation: { query: permissions.canManageInventory, create: () => false, update: () => false, delete: () => false },
    filter: { query: ({ session }) => withRooftopScope(true, session as any, ['canViewInventory', 'canManageInventory']) },
  },
  ui: { hideCreate: true, hideDelete: true, listView: { initialColumns: ['occurredAt', 'stock', 'eventType', 'reason', 'actor'] } },
  fields: {
    ...trackingFields,
    rooftop: rooftopField(),
    stock: relationship({ ref: 'InventoryStock.events', db: { extendPrismaSchema: field => field.replace(/stock InventoryStock\?/g, 'stock InventoryStock').replace(/stockId String\?/g, 'stockId String') } }),
    eventKey: text({ validation: { isRequired: true }, isIndexed: 'unique' }),
    eventType: text({ validation: { isRequired: true }, isIndexed: true }),
    reason: text({ validation: { isRequired: true, length: { max: 500 } } }),
    amountCents: integer({ validation: { min: 0 }, access: { read: permissions.canViewDealerCost } }),
    evidence: json({ defaultValue: {} }),
    actor: relationship({ ref: 'User' }),
    occurredAt: timestamp({ validation: { isRequired: true }, defaultValue: { kind: 'now' }, isIndexed: true }),
  },
})
