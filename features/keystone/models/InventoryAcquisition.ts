import { list } from '@keystone-6/core'
import { denyAll } from '@keystone-6/core/access'
import { integer, json, relationship, select, text, timestamp } from '@keystone-6/core/fields'

import { permissions } from '../access'
import { rooftopField, withRooftopScope } from '../tenantRecords'
import { trackingFields } from './trackingFields'

export const InventoryAcquisition = list({
  access: {
    operation: {
      query: permissions.canManageInventory,
      create: () => false,
      update: () => false,
      delete: () => false,
    },
    filter: { query: ({ session }) => withRooftopScope(true, session as any, 'canManageInventory') },
  },
  ui: {
    hideCreate: true,
    hideDelete: true,
    labelField: 'reference',
    listView: { initialColumns: ['reference', 'status', 'vin', 'vehicle', 'acquisitionSource', 'updatedAt'] },
  },
  fields: {
    ...trackingFields,
    rooftop: rooftopField(),
    reference: text({ validation: { isRequired: true }, isIndexed: 'unique' }),
    idempotencyKey: text({
      validation: { isRequired: true },
      isIndexed: 'unique',
      access: { read: denyAll, create: () => false, update: () => false },
      ui: { itemView: { fieldMode: 'hidden' }, listView: { fieldMode: 'hidden' } },
    }),
    status: select({
      type: 'string',
      options: [
        { label: 'Appraised', value: 'appraised' },
        { label: 'Approved', value: 'approved' },
        { label: 'Purchased', value: 'purchased' },
        { label: 'Arrived', value: 'arrived' },
        { label: 'Reconditioning', value: 'reconditioning' },
        { label: 'Frontline Ready', value: 'frontline' },
        { label: 'Cancelled', value: 'cancelled' },
      ],
      defaultValue: 'appraised',
      validation: { isRequired: true },
    }),
    acquisitionSource: select({
      type: 'string',
      options: [
        { label: 'Trade-in', value: 'trade-in' },
        { label: 'Auction', value: 'auction' },
        { label: 'Wholesale', value: 'wholesale' },
        { label: 'Consumer Purchase', value: 'consumer-purchase' },
        { label: 'OEM / Distributor', value: 'oem-distributor' },
        { label: 'Dealer Transfer', value: 'dealer-transfer' },
      ],
      validation: { isRequired: true },
    }),
    sourceReference: text({ validation: { length: { max: 200 } } }),
    vin: text({ validation: { isRequired: true, length: { min: 17, max: 17 } } }),
    year: integer({ validation: { isRequired: true, min: 1900, max: 2200 } }),
    make: text({ validation: { isRequired: true } }),
    model: text({ validation: { isRequired: true } }),
    odometer: integer({ validation: { min: 0 } }),
    appraisalCents: integer({ validation: { isRequired: true, min: 0 } }),
    purchaseCents: integer({ validation: { min: 0 } }),
    reconEstimateCents: integer({ validation: { min: 0 } }),
    vehicle: relationship({ ref: 'Vehicle.acquisition', access: { update: denyAll } }),
    immutablePurchaseSnapshot: json({ defaultValue: null, access: { create: () => false, update: () => false } }),
    purchasedAt: timestamp(),
    arrivedAt: timestamp(),
    frontlineAt: timestamp(),
    requestedBy: relationship({ ref: 'User' }),
    lastTransitionedBy: relationship({ ref: 'User' }),
    stock: relationship({ ref: 'InventoryStock.acquisition', access: { update: denyAll } }),
    events: relationship({ ref: 'InventoryAcquisitionEvent.acquisition', many: true }),
  },
})
