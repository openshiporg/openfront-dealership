import { list } from '@keystone-6/core'
import { checkbox, integer, relationship, select, text } from '@keystone-6/core/fields'
import { permissions } from '../access'
import { canCreateRooftopRecord, rooftopField, validateRooftopRecord, withRooftopScope } from '../tenantRecords'
import { prismaModelDirectives } from './prismaSchema'
import { trackingFields } from './trackingFields'

export const FinanceProduct = list({
  db: prismaModelDirectives('@@unique([rooftopId, code], map: "FinanceProduct_rooftop_code_key")'),
  access: {
    operation: {
      query: permissions.canManageFinancing,
      create: permissions.canManageFinancing,
      update: permissions.canManageFinancing,
      delete: permissions.canManageFinancing,
    },
    filter: {
      query: ({ session }) => withRooftopScope(true, session as any, 'canManageFinancing'),
      update: ({ session }) => withRooftopScope(true, session as any, 'canManageFinancing'),
      delete: ({ session }) => withRooftopScope(true, session as any, 'canManageFinancing'),
    },
    item: { create: canCreateRooftopRecord('canManageFinancing') },
  },
  hooks: { validate: (args: any) => validateRooftopRecord(args) },
  ui: { listView: { initialColumns: ['code','name','category','providerKey','active'] } },
  fields: {
    ...trackingFields, rooftop: rooftopField(),
    code: text({ validation: { isRequired: true } }), name: text({ validation: { isRequired: true } }),
    category: select({ type: 'string', options: ['service-contract','gap','maintenance','appearance','tire-wheel','other'].map(value => ({ label: value, value })), validation: { isRequired: true } }),
    providerKey: text({ validation: { isRequired: true } }), active: checkbox({ defaultValue: true }),
    quotes: relationship({ ref: 'FinanceProductQuote.product', many: true }),
    retailPriceCents: integer({ validation: { isRequired: true, min: 0 } }), costCents: integer({ validation: { isRequired: true, min: 0 }, access: { read: permissions.canViewDealerCost, create: permissions.canManageFinancing, update: permissions.canManageFinancing } }),
  },
})
