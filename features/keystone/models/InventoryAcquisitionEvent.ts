import { list } from '@keystone-6/core'
import { json, relationship, text, timestamp } from '@keystone-6/core/fields'

import { permissions } from '../access'
import { rooftopField, withRooftopScope } from '../tenantRecords'
import { trackingFields } from './trackingFields'

export const InventoryAcquisitionEvent = list({
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
    listView: { initialColumns: ['occurredAt', 'acquisition', 'fromStatus', 'toStatus', 'actor', 'reason'] },
  },
  fields: {
    ...trackingFields,
    rooftop: rooftopField(),
    acquisition: relationship({
      ref: 'InventoryAcquisition.events',
      db: {
        extendPrismaSchema: field => field
          .replace(/acquisition InventoryAcquisition\?/g, 'acquisition InventoryAcquisition')
          .replace(/acquisitionId String\?/g, 'acquisitionId String'),
      },
    }),
    fromStatus: text(),
    toStatus: text({ validation: { isRequired: true } }),
    reason: text({ validation: { isRequired: true, length: { min: 1, max: 500 } } }),
    evidence: json({ defaultValue: {} }),
    actor: relationship({ ref: 'User' }),
    occurredAt: timestamp({ validation: { isRequired: true }, defaultValue: { kind: 'now' } }),
  },
})
