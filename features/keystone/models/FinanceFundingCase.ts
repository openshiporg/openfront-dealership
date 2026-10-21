import { list } from '@keystone-6/core';
import { json, relationship, select, text, timestamp } from '@keystone-6/core/fields';
import { permissions } from '../access';
import { rooftopField, validateRooftopRecord, withRooftopScope } from '../tenantRecords';
import { prismaModelDirectives, requiredRelationshipDb } from './prismaSchema';
import { trackingFields } from './trackingFields';

export const FinanceFundingCase = list({
  db: prismaModelDirectives('@@unique([dealId], map: "FinanceFundingCase_deal_key")'),
  access: {
    operation: {
      query: permissions.canManageFinancing,
      create: () => false,
      update: () => false,
      delete: () => false
    },
    filter: { query: ({ session }) => withRooftopScope(true, session as any, 'canManageFinancing') }
  },
  hooks: { validate: (args: any) => validateRooftopRecord(args, [{
        field: 'deal',
        listKey: 'Deal'
      }]) },
  ui: {
    hideCreate: true,
    hideDelete: true,
    listView: { initialColumns: ['deal', 'status', 'fundingReference', 'fundedAt', 'updatedAt'] }
  },
  fields: {
    ...trackingFields,
    rooftop: rooftopField(),
    deal: relationship({
      ref: 'Deal.financeFundingCases',
      db: requiredRelationshipDb('deal')
    }),
    status: select({
      type: 'string',
      options: ['pending', 'exception', 'clear-to-fund', 'funded', 'cancelled'].map(value => ({
        label: value,
        value
      })),
      validation: { isRequired: true }
    }),
    checklist: json({ defaultValue: [] }),
    exceptions: json({ defaultValue: [] }),
    fundingReference: text(),
    fundedAt: timestamp(),
    immutableEvidence: json({ defaultValue: {} }),
    idempotencyKey: text({
      validation: { isRequired: true },
      isIndexed: 'unique'
    })
  }
});
