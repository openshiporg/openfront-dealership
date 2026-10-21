import { list } from '@keystone-6/core';
import { json, relationship, select, text, timestamp } from '@keystone-6/core/fields';
import { permissions } from '../access';
import { rooftopField, validateRooftopRecord, withRooftopScope } from '../tenantRecords';
import { prismaModelDirectives, requiredRelationshipDb } from './prismaSchema';
import { trackingFields } from './trackingFields';

export const DeliveryCase = list({
  db: prismaModelDirectives('@@unique([dealId], map: "DeliveryCase_deal_key")'),
  access: {
    operation: {
      query: permissions.canAccessDeals,
      create: () => false,
      update: () => false,
      delete: () => false
    },
    filter: { query: ({ session }) => withRooftopScope(true, session as any, ['canManageDeals', 'canApproveDeals', 'canManageFinancing']) }
  },
  hooks: { validate: (args: any) => validateRooftopRecord(args, [{
        field: 'deal',
        listKey: 'Deal'
      }]) },
  ui: {
    hideCreate: true,
    hideDelete: true
  },
  fields: {
    ...trackingFields,
    rooftop: rooftopField(),
    deal: relationship({
      ref: 'Deal.deliveryCases',
      db: requiredRelationshipDb('deal')
    }),
    status: select({
      type: 'string',
      options: ['scheduled', 'arrived', 'ready', 'delivered', 'cancelled'].map(value => ({
        label: value,
        value
      })),
      validation: { isRequired: true }
    }),
    appointmentAt: timestamp(),
    arrivedAt: timestamp(),
    checklist: json({ defaultValue: [] }),
    customerAcknowledgment: text(),
    acknowledgedAt: timestamp(),
    deliverySnapshot: json({ defaultValue: {} }),
    idempotencyKey: text({
      validation: { isRequired: true },
      isIndexed: 'unique'
    }),
    weOweItems: relationship({
      ref: 'WeOweItem.deliveryCase',
      many: true
    })
  }
});
