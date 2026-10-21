import { list } from '@keystone-6/core'
import { integer, json, relationship, select, text, timestamp } from '@keystone-6/core/fields'
import { permissions } from '../access'
import { rooftopField, validateRooftopRecord, withRooftopScope } from '../tenantRecords'
import { prismaModelDirectives, requiredRelationshipDb } from './prismaSchema'
import { trackingFields } from './trackingFields'

export const FinanceMenuVersion = list({
  db: prismaModelDirectives('@@unique([dealId, version], map: "FinanceMenuVersion_deal_version_key")'),
  access: { operation: { query: permissions.canManageFinancing, create: () => false, update: () => false, delete: () => false }, filter: { query: ({ session }) => withRooftopScope(true, session as any, 'canManageFinancing') } },
  hooks: { validate: (args:any) => validateRooftopRecord(args,[{field:'deal',listKey:'Deal'}]) },
  ui: { hideCreate:true, hideDelete:true, listView:{initialColumns:['deal','version','status','presentedAt','decidedAt']} },
  fields: {
    ...trackingFields, rooftop: rooftopField(), deal: relationship({ ref:'Deal.financeMenuVersions', db: requiredRelationshipDb('deal') }), version: integer({ validation:{isRequired:true,min:1} }),
    status: select({type:'string',options:['presented','accepted','declined','superseded'].map(value=>({label:value,value})),validation:{isRequired:true}}),
    optionsSnapshot: json({defaultValue:[]}), selectedProductCodes: json({defaultValue:[]}), declinedProductCodes: json({defaultValue:[]}), disclosureAcknowledgment: text(),
    presentedAt: timestamp({validation:{isRequired:true}}), decidedAt: timestamp(), cancellations: relationship({ ref: 'FinanceProductCancellation.menu', many: true }), idempotencyKey: text({validation:{isRequired:true},isIndexed:'unique'}),
  },
})
