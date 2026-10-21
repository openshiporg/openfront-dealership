import { list } from '@keystone-6/core'
import { denyAll } from '@keystone-6/core/access'
import { integer, relationship, select, text, timestamp } from '@keystone-6/core/fields'

import { permissions } from '../access'
import { rooftopField, withRooftopScope } from '../tenantRecords'
import { trackingFields } from './trackingFields'

export const InventoryStock = list({
  access: {
    operation: { query: permissions.canViewInventory, create: () => false, update: () => false, delete: () => false },
    filter: { query: ({ session }) => withRooftopScope(true, session as any, ['canViewInventory', 'canManageInventory']) },
  },
  ui: { hideCreate: true, hideDelete: true, labelField: 'stockNumber', listView: { initialColumns: ['stockNumber', 'vehicle', 'locationCode', 'reconStatus', 'merchandisingStatus', 'stockedAt'] } },
  fields: {
    ...trackingFields,
    rooftop: rooftopField(),
    vehicle: relationship({
      ref: 'Vehicle.inventoryStock',
      access: { update: denyAll },
      db: { extendPrismaSchema: field => field.replace(/vehicle Vehicle\?/g, 'vehicle Vehicle').replace(/vehicleId String\?/g, 'vehicleId String') },
    }),
    acquisition: relationship({ ref: 'InventoryAcquisition.stock', access: { update: denyAll } }),
    stockNumber: text({ validation: { isRequired: true } }),
    stockKey: text({ validation: { isRequired: true }, isIndexed: 'unique', access: { read: denyAll, create: denyAll, update: denyAll }, ui: { itemView: { fieldMode: 'hidden' } } }),
    locationCode: text({ validation: { isRequired: true } }),
    locationLabel: text(),
    stockedAt: timestamp({ validation: { isRequired: true } }),
    frontlineAt: timestamp(),
    purchaseCostCents: integer({ validation: { min: 0 }, access: { read: permissions.canViewDealerCost } }),
    reconCostCents: integer({ validation: { min: 0 }, defaultValue: 0, access: { read: permissions.canViewDealerCost } }),
    otherCostCents: integer({ validation: { min: 0 }, defaultValue: 0, access: { read: permissions.canViewDealerCost } }),
    totalCostCents: integer({ validation: { min: 0 }, defaultValue: 0, access: { read: permissions.canViewDealerCost } }),
    reconStatus: select({ type: 'string', options: ['not-started', 'in-progress', 'completed'].map(value => ({ label: value, value })), defaultValue: 'not-started' }),
    merchandisingStatus: select({ type: 'string', options: ['draft', 'submitted', 'approved', 'rejected'].map(value => ({ label: value, value })), defaultValue: 'draft' }),
    approvedRevisionHash: text({ defaultValue: '', access: { create: denyAll, update: denyAll, read: permissions.canViewInventory }, label: 'Approved marketing revision', ui: { itemView: { fieldMode: 'read' } } }),
    feedStatus: select({ type: 'string', options: ['not-published', 'succeeded', 'partial', 'failed'].map(value => ({ label: value, value })), defaultValue: 'not-published' }),
    events: relationship({ ref: 'InventoryStockEvent.stock', many: true }),
    reconWorkItems: relationship({ ref: 'InventoryReconWorkItem.stock', many: true }),
    merchandisingVersions: relationship({ ref: 'InventoryMerchandisingVersion.stock', many: true }),
  },
})
