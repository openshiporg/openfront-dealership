import { list } from '@keystone-6/core'
import { checkbox, integer, relationship, select, text } from '@keystone-6/core/fields'

import { permissions, rules } from '../access'
import { canCreateRooftopRecord, rooftopField, validateRooftopRecord } from '../tenantRecords'
import { trackingFields } from './trackingFields'

export const LeadRoutingRule = list({
  access: {
    operation: {
      query: permissions.canManageLeads,
      create: permissions.canManageLeads,
      update: permissions.canManageLeads,
      delete: permissions.canManageLeads,
    },
    filter: {
      query: rules.canReadLeadOperations,
      update: rules.canReadLeadOperations,
      delete: rules.canReadLeadOperations,
    },
    item: { create: canCreateRooftopRecord('canManageLeads') },
  },
  hooks: {
    resolveInput: async ({ operation, resolvedData, item }: any) => {
      // Same key shape as configureLeadRoutingRule: one rule per rooftop, source and name.
      const rooftopId = resolvedData.rooftop?.connect?.id ?? item?.rooftopId
      const source = resolvedData.source ?? item?.source ?? 'any'
      const name = resolvedData.name ?? item?.name
      if (operation === 'create' || resolvedData.source !== undefined || resolvedData.name !== undefined) {
        if (rooftopId && name) {
          const slug = String(name).trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
          return { ...resolvedData, routeKey: `${rooftopId}:${source}:${slug}` }
        }
      }
      return resolvedData
    },
    validate: (args: any) => validateRooftopRecord(args, [{ field: 'assignee', listKey: 'User', kind: 'user' }]),
  },
  fields: {
    ...trackingFields,
    rooftop: rooftopField(),
    name: text({ validation: { isRequired: true } }),
    routeKey: text({
      validation: { isRequired: true },
      isIndexed: 'unique',
      access: { create: () => false, update: () => false },
      ui: { createView: { fieldMode: 'hidden' }, itemView: { fieldMode: 'read' } },
    }),
    active: checkbox({ defaultValue: true }),
    priority: integer({ defaultValue: 100, validation: { isRequired: true, min: 0, max: 10000 } }),
    source: select({
      type: 'string',
      options: [
        { label: 'Any source', value: 'any' },
        { label: 'Walk-In', value: 'walk-in' },
        { label: 'Website', value: 'website' },
        { label: 'Phone', value: 'phone' },
        { label: 'Referral', value: 'referral' },
        { label: 'Advertisement', value: 'ad' },
        { label: 'Social Media', value: 'social' },
        { label: 'Third Party', value: 'third-party' },
      ],
      defaultValue: 'any',
      validation: { isRequired: true },
    }),
    assignee: relationship({ ref: 'User.leadRoutingRules', db: { extendPrismaSchema: field => field.replace(/assignee User\?/g, 'assignee User').replace(/assigneeId String\?/g, 'assigneeId String') } }),
    firstResponseMinutes: integer({ defaultValue: 30, validation: { isRequired: true, min: 1, max: 10080 } }),
  },
})
