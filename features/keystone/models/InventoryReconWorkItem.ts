import { list } from '@keystone-6/core'
import { integer, relationship, select, text, timestamp } from '@keystone-6/core/fields'

import { permissions } from '../access'
import { rooftopField, withRooftopScope } from '../tenantRecords'
import { trackingFields } from './trackingFields'

export const InventoryReconWorkItem = list({
  access: {
    operation: { query: permissions.canManageInventory, create: () => false, update: () => false, delete: () => false },
    filter: { query: ({ session }) => withRooftopScope(true, session as any, 'canManageInventory') },
  },
  ui: { hideCreate: true, hideDelete: true, listView: { initialColumns: ['title', 'stock', 'status', 'assignedTo', 'dueAt'] } },
  fields: {
    ...trackingFields,
    rooftop: rooftopField(),
    stock: relationship({ ref: 'InventoryStock.reconWorkItems', db: { extendPrismaSchema: field => field.replace(/stock InventoryStock\?/g, 'stock InventoryStock').replace(/stockId String\?/g, 'stockId String') } }),
    title: text({ validation: { isRequired: true, length: { max: 200 } } }),
    category: select({ type: 'string', options: ['mechanical', 'body', 'detail', 'tires', 'inspection', 'other'].map(value => ({ label: value, value })), validation: { isRequired: true } }),
    status: select({ type: 'string', options: ['open', 'in-progress', 'completed', 'cancelled'].map(value => ({ label: value, value })), defaultValue: 'open' }),
    estimatedCostCents: integer({ validation: { min: 0 }, access: { read: permissions.canViewDealerCost } }),
    actualCostCents: integer({ validation: { min: 0 }, access: { read: permissions.canViewDealerCost } }),
    vendorName: text({ validation: { length: { max: 200 } } }),
    assignedTo: relationship({ ref: 'User' }),
    dueAt: timestamp(),
    completedAt: timestamp(),
  },
})
