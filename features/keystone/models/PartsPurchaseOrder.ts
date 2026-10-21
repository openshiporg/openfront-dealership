import { list } from '@keystone-6/core';
import { json, select, text, timestamp } from '@keystone-6/core/fields';
import { permissions } from '../access';
import { rooftopField, withRooftopScope } from '../tenantRecords';
import { prismaModelDirectives } from './prismaSchema';
import { trackingFields } from './trackingFields';

export const PartsPurchaseOrder = list({
  db: prismaModelDirectives('@@unique([rooftopId, reference], map: "PartsPurchaseOrder_rooftop_reference_key")'),
  access: {
    operation: {
      query: permissions.canManageService,
      create: () => false,
      update: () => false,
      delete: () => false
    },
    filter: { query: ({ session }) => withRooftopScope(true, session as any, 'canManageService') }
  },
  ui: {
    hideCreate: true,
    hideDelete: true
  },
  fields: {
    ...trackingFields,
    rooftop: rooftopField(),
    reference: text({ validation: { isRequired: true } }),
    supplier: text({ validation: { isRequired: true } }),
    status: select({
      type: 'string',
      options: ['draft', 'ordered', 'partially-received', 'received', 'cancelled'].map(value => ({
        label: value,
        value
      })),
      validation: { isRequired: true }
    }),
    lines: json({ defaultValue: [] }),
    orderedAt: timestamp(),
    receivedAt: timestamp(),
    idempotencyKey: text({
      validation: { isRequired: true },
      isIndexed: 'unique'
    })
  }
});
