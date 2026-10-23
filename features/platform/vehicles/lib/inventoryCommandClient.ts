import { ClientError, GraphQLClient } from 'graphql-request'

import { getAuthHeaders } from '@/features/dashboard/lib/cookies'
import { getGraphQLEndpoint } from '@/features/dashboard/lib/getBaseUrl'
import { PUBLIC_REQUEST_ERROR, safeErrorSummary } from '@/features/dashboard/lib/security'

/** Matches `INVENTORY_COMMAND_REJECTED` in features/keystone/mutations/inventoryCommandErrors.ts. */
const INVENTORY_COMMAND_REJECTED = 'INVENTORY_COMMAND_REJECTED'

/**
 * `rejected` means the server refused the command with a staff-facing reason, so nothing was applied
 * and the message can be shown as-is. Any other failure keeps the generic message and is unconfirmed.
 */
export type InventoryCommandResponse<T> =
  | { success: true; data: T; error?: never; rejected?: never }
  | { success: false; error: string; rejected: boolean; data?: never }

function rejectionMessage(error: unknown) {
  if (!(error instanceof ClientError)) return null
  const errors = Array.isArray(error.response?.errors) ? error.response.errors : []
  const rejected = errors.find(entry => entry?.extensions?.code === INVENTORY_COMMAND_REJECTED)
  return rejected && typeof rejected.message === 'string' && rejected.message.trim() ? rejected.message.trim() : null
}

export async function inventoryCommandRequest<T>(query: string, variables: Record<string, unknown>): Promise<InventoryCommandResponse<T>> {
  try {
    const client = new GraphQLClient(await getGraphQLEndpoint(), {
      credentials: 'include',
      redirect: 'error',
      headers: (await getAuthHeaders()) || {},
    })
    return { success: true, data: await client.request<T>(query, variables) }
  } catch (error) {
    const message = rejectionMessage(error)
    if (message) return { success: false, error: message, rejected: true }
    console.error('Inventory command failed:', safeErrorSummary(error))
    return { success: false, error: PUBLIC_REQUEST_ERROR, rejected: false }
  }
}
