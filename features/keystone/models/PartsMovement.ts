import { list } from '@keystone-6/core';
import { integer, json, relationship, select, text, timestamp } from '@keystone-6/core/fields';
import { permissions } from '../access';
import { rooftopField, validateRooftopRecord, withRooftopScope } from '../tenantRecords';
import { requiredRelationshipDb } from './prismaSchema';
import { trackingFields } from './trackingFields';

export const PartsMovement = list({
  access: {
    operation: {
      query: permissions.canManageService,
      create: () => false,
      update: () => false,
      delete: () => false
    },
    filter: { query: ({ session }) => withRooftopScope(true, session as any, 'canManageService') }
  },
  hooks: { validate: (args: any) => validateRooftopRecord(args, [{
        field: 'part',
        listKey: 'PartsInventory'
      }, {
        field: 'serviceOrder',
        listKey: 'ServiceOrder'
      }]) },
  ui: {
    hideCreate: true,
    hideDelete: true
  },
  fields: {
    ...trackingFields,
    rooftop: rooftopField(),
    part: relationship({
      ref: 'PartsInventory.movements',
      db: requiredRelationshipDb('part')
    }),
    serviceOrder: relationship({ ref: 'ServiceOrder.partsMovements' }),
    movementType: select({
      type: 'string',
      options: ['receipt', 'issue', 'return', 'adjustment', 'count', 'commit', 'release', 'po-order', 'po-cancel'].map(value => ({
        label: value,
        value
      })),
      validation: { isRequired: true }
    }),
    quantityDelta: integer({ validation: { isRequired: true } }),
    onHandAfter: integer({ validation: { min: 0 } }),
    committedAfter: integer({ validation: { min: 0 } }),
    onOrderAfter: integer({ validation: { min: 0 } }),
    reference: text({ validation: { isRequired: true } }),
    reason: text({ validation: { isRequired: true } }),
    evidence: json({ defaultValue: {} }),
    occurredAt: timestamp({ validation: { isRequired: true } }),
    idempotencyKey: text({
      validation: { isRequired: true },
      isIndexed: 'unique'
    })
  }
});
