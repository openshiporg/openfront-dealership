import { list } from '@keystone-6/core';
import { json, relationship, select, text, timestamp } from '@keystone-6/core/fields';
import { permissions } from '../access';
import { rooftopField, validateRooftopRecord, withRooftopScope } from '../tenantRecords';
import { prismaModelDirectives, requiredRelationshipDb } from './prismaSchema';
import { trackingFields } from './trackingFields';

export const FinanceContractPackage = list({
  db: prismaModelDirectives('@@unique([dealId], map: "FinanceContractPackage_deal_key")'),
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
    listView: { initialColumns: ['deal', 'status', 'providerKey', 'envelopeReference', 'updatedAt'] }
  },
  fields: {
    ...trackingFields,
    rooftop: rooftopField(),
    deal: relationship({
      ref: 'Deal.financeContractPackages',
      db: requiredRelationshipDb('deal')
    }),
    status: select({
      type: 'string',
      options: ['preparing', 'ready', 'awaiting-external-handoff', 'sent', 'viewed', 'signed', 'declined', 'void'].map(value => ({
        label: value,
        value
      })),
      validation: { isRequired: true }
    }),
    providerKey: text({ validation: { isRequired: true } }),
    envelopeReference: text(),
    requiredDocuments: json({ defaultValue: [] }),
    documentChecklist: json({ defaultValue: [] }),
    immutableStatusEvidence: json({ defaultValue: {} }),
    sentAt: timestamp(),
    signedAt: timestamp(),
    lastWebhookAt: timestamp(),
    idempotencyKey: text({
      validation: { isRequired: true },
      isIndexed: 'unique'
    })
  }
});
