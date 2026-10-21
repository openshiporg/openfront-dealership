import { list } from '@keystone-6/core'
import { select, text } from '@keystone-6/core/fields'

import { permissions } from '../access'
import { canCreateRooftopRecord, rooftopField, validateRooftopRecord, withRooftopScope } from '../tenantRecords'
import { prismaModelDirectives } from './prismaSchema'
import { trackingFields } from './trackingFields'

const canManageAccounting = (args: Parameters<typeof permissions.canViewReports>[0]) =>
  permissions.canManageDealerships(args) && permissions.canViewReports(args)

export const AccountingMapping = list({
  db: prismaModelDirectives('@@unique([rooftopId, sourceType, sourceCode, providerKey], map: "AccountingMapping_rooftop_source_provider_key")'),
  access: {
    operation: {
      query: permissions.canViewReports,
      create: canManageAccounting,
      update: canManageAccounting,
      delete: canManageAccounting,
    },
    filter: {
      query: ({ session }) => withRooftopScope(true, session as any, 'canViewReports'),
      update: ({ session }) => withRooftopScope(true, session as any, ['canViewReports']),
      delete: ({ session }) => withRooftopScope(true, session as any, ['canViewReports']),
    },
    item: { create: canCreateRooftopRecord('canViewReports') },
  },
  hooks: {
    validate: async (args: any) => {
      const providerKey = args.resolvedData?.providerKey ?? args.item?.providerKey
      if (providerKey !== 'operator-recorded') args.addValidationError('Provider must be operator-recorded')
      await validateRooftopRecord(args)
    },
  },
  fields: {
    ...trackingFields,
    rooftop: rooftopField(),
    sourceType: select({
      type: 'string',
      options: ['deal', 'service', 'parts', 'payment'].map(value => ({ label: value, value })),
      validation: { isRequired: true },
    }),
    sourceCode: text({ validation: { isRequired: true } }),
    debitAccount: text({ validation: { isRequired: true } }),
    creditAccount: text({ validation: { isRequired: true } }),
    providerKey: text({ validation: { isRequired: true }, defaultValue: 'operator-recorded' }),
  },
})
