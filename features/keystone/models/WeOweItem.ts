import { list } from '@keystone-6/core';
import { integer, relationship, select, text, timestamp } from '@keystone-6/core/fields';
import { permissions } from '../access';
import { rooftopField, validateRooftopRecord, withRooftopScope } from '../tenantRecords';
import { requiredRelationshipDb } from './prismaSchema';
import { trackingFields } from './trackingFields';

export const WeOweItem = list({
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
        field: 'deliveryCase',
        listKey: 'DeliveryCase'
      }, {
        field: 'owner',
        listKey: 'User',
        kind: 'user'
      }]) },
  ui: {
    hideCreate: true,
    hideDelete: true
  },
  fields: {
    ...trackingFields,
    rooftop: rooftopField(),
    deliveryCase: relationship({
      ref: 'DeliveryCase.weOweItems',
      db: requiredRelationshipDb('deliveryCase')
    }),
    description: text({ validation: { isRequired: true } }),
    status: select({
      type: 'string',
      options: ['open', 'fulfilled', 'waived'].map(value => ({
        label: value,
        value
      })),
      validation: { isRequired: true }
    }),
    promisedAt: timestamp({ validation: { isRequired: true } }),
    owner: relationship({
      ref: 'User',
      db: requiredRelationshipDb('owner')
    }),
    estimatedCostCents: integer({
      validation: { min: 0 },
      access: {
        read: permissions.canViewDealerCost,
        create: () => false,
        update: () => false
      }
    }),
    fulfillmentEvidence: text(),
    customerAcknowledgment: text(),
    fulfilledAt: timestamp(),
    idempotencyKey: text({
      validation: { isRequired: true },
      isIndexed: 'unique'
    })
  }
});
