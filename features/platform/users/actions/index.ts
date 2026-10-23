'use server';

import { keystoneClient } from '../../../dashboard/lib/keystoneClient';

export interface StaffUser {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  employeeId?: string | null;
  isSalesperson?: boolean | null;
  isServiceAdvisor?: boolean | null;
  isFinanceManager?: boolean | null;
  role?: {
    id: string;
    name: string;
  } | null;
  assignedLeadsCount?: number;
  dealsCount?: number;
  createdAt?: string | null;
  [key: string]: unknown;
}

const USER_FIELDS = `
  id
  name
  email
  phone
  isSalesperson
  isServiceAdvisor
  isFinanceManager
  role {
    id
    name
  }
  assignedLeadsCount
  dealsCount
  createdAt
`;

// Storefront shoppers are Users without a role or dealership membership; the staff desk leaves them out.
const STAFF_WHERE = {
  OR: [
    { NOT: [{ role: null }] },
    { dealerGroupMemberships: { some: {} } },
    { rooftopMemberships: { some: {} } },
  ],
};

/**
 * Get list of staff users
 */
export async function getUsers(
  where: Record<string, unknown> = {},
  take: number = 10,
  skip: number = 0,
  orderBy: Array<Record<string, string>> = [{ createdAt: 'desc' }],
  selectedFields: string = USER_FIELDS
) {
  const query = `
    query GetUsers($where: UserWhereInput, $take: Int!, $skip: Int!, $orderBy: [UserOrderByInput!]) {
      items: users(where: $where, take: $take, skip: $skip, orderBy: $orderBy) {
        ${selectedFields}
      }
      count: usersCount(where: $where)
    }
  `;

  const response = await keystoneClient(query, {
    where: { AND: [STAFF_WHERE, where] },
    take,
    skip,
    orderBy,
  });

  if (response.success) {
    return {
      success: true,
      data: {
        items: response.data.items || [],
        count: response.data.count || 0,
      },
    };
  } else {
    console.error('Error fetching users:', response.error);
    return {
      success: false,
      error: response.error || 'Failed to fetch users',
      data: { items: [], count: 0 },
    };
  }
}

/**
 * Get user role counts for StatusTabs
 */
export async function getUserStatusCounts() {
  const query = `
    query GetUserStatusCounts($staff: UserWhereInput!) {
      sales: usersCount(where: { AND: [$staff, { isSalesperson: { equals: true } }] })
      service: usersCount(where: { AND: [$staff, { isServiceAdvisor: { equals: true } }] })
      finance: usersCount(where: { AND: [$staff, { isFinanceManager: { equals: true } }] })
      all: usersCount(where: $staff)
    }
  `;

  const response = await keystoneClient(query, { staff: STAFF_WHERE });

  if (response.success) {
    return {
      success: true,
      data: {
        all: response.data.all || 0,
        sales: response.data.sales || 0,
        service: response.data.service || 0,
        finance: response.data.finance || 0,
      },
    };
  } else {
    console.error('Error fetching user status counts:', response.error);
    return {
      success: false,
      error: response.error || 'Failed to fetch user status counts',
      data: { all: 0, sales: 0, service: 0, finance: 0 },
    };
  }
}
