import { list } from '@keystone-6/core'
import { relationship, text, select, timestamp } from '@keystone-6/core/fields'

import { isSignedIn } from '../access'

export const DealApproval = list({
  access: {
    operation: {
      query: isSignedIn,
      create: isSignedIn,
      update: isSignedIn,
      delete: isSignedIn,
    },
  },
  ui: {
    listView: {
      initialColumns: ['deal', 'approver', 'decision', 'approvalDate'],
    },
  },
  fields: {
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
