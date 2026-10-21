import { list } from '@keystone-6/core'
import { relationship, text, select, timestamp } from '@keystone-6/core/fields'

import { permissions, rules } from '../access'
import { rooftopField, validateRooftopRecord } from '../tenantRecords'
import { trackingFields } from './trackingFields'

export const DealApproval = list({
  access: {
    operation: {
      query: permissions.canAccessDeals,
      create: () => false,
      update: () => false,
      delete: () => false,
    },
    filter: {
      query: rules.canReadDealApprovals,
    },
  },
  hooks: {
    validate: (args: any) => validateRooftopRecord(args, [
      { field: 'deal', listKey: 'Deal' },
      { field: 'approver', listKey: 'User', kind: 'user' },
    ]),
  },
  ui: {
    hideCreate: true,
    hideDelete: true,
    listView: {
      initialColumns: ['deal', 'approver', 'decision', 'approvalDate'],
    },
  },
  fields: {
    ...trackingFields,
    rooftop: rooftopField(),
    // Deal relationship
    deal: relationship({
      ref: 'Deal.approvals',
      ui: {
        displayMode: 'select',
      },
      label: 'Deal',
    }),

    // Approver
    approver: relationship({
      ref: 'User.dealApprovals',
      ui: {
        displayMode: 'select',
        labelField: 'name',
      },
      label: 'Approver',
    }),

    // Approval Decision
    decision: select({
      type: 'string',
      options: [
        { label: 'Pending', value: 'pending' },
        { label: 'Approved', value: 'approved' },
        { label: 'Rejected', value: 'rejected' },
        { label: 'Changes Requested', value: 'changes-requested' },
      ],
      defaultValue: 'pending',
      label: 'Decision',
    }),

    // Feedback
    notes: text({
      ui: {
        displayMode: 'textarea',
        description: 'Approval notes or requested changes',
      },
      label: 'Notes',
    }),

    // Timestamps
    approvalDate: timestamp({
      defaultValue: { kind: 'now' },
      label: 'Approval Date',
    }),
  },
})
