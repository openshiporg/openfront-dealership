import { list } from '@keystone-6/core';
import { float, integer, json, relationship, select, text, timestamp } from '@keystone-6/core/fields';
import { permissions } from '../access';
import { rooftopField, validateRooftopRecord, withRooftopScope } from '../tenantRecords';
import { requiredRelationshipDb } from './prismaSchema';
import { trackingFields } from './trackingFields';

export const ServiceLaborOperation = list({
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
        field: 'serviceOrder',
        listKey: 'ServiceOrder'
      }, {
        field: 'technician',
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
    serviceOrder: relationship({
      ref: 'ServiceOrder.laborOperations',
      db: requiredRelationshipDb('serviceOrder')
    }),
    operationCode: text({ validation: { isRequired: true } }),
    description: text({ validation: { isRequired: true } }),
    status: select({
      type: 'string',
      options: ['open', 'dispatched', 'in-progress', 'paused', 'completed', 'cancelled'].map(value => ({
        label: value,
        value
      })),
      validation: { isRequired: true }
    }),
    technician: relationship({ ref: 'User' }),
    soldHours: float({ validation: { min: 0 } }),
    actualMinutes: integer({ validation: { min: 0 } }),
    timePunches: json({ defaultValue: [] }),
    startedAt: timestamp(),
    completedAt: timestamp(),
    idempotencyKey: text({
      validation: { isRequired: true },
      isIndexed: 'unique'
    })
  }
});
