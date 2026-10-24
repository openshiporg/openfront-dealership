'use server'

import { randomBytes } from 'node:crypto'
import { isIP } from 'node:net'
import { revalidatePath } from 'next/cache'

import { deskRequest, type DeskResult } from '@/features/platform/organization/lib/deskRequest'
import { API_KEY_SCOPES, type ApiKey, type ApiKeyStatus, type ApiKeysData } from '../lib/scopes'

const API_KEYS_PATH = '/dashboard/platform/api-keys'
const KEY_FIELDS = 'id name tokenPreview scopes status expiresAt lastUsedAt usageCount restrictedToIPs createdAt updatedAt'
const SCOPE_PERMISSIONS = [...new Set(API_KEY_SCOPES.flatMap(scope => scope.permissions))]
const ROLE_FLAGS = SCOPE_PERMISSIONS.join(' ')

type RoleFlags = Record<string, boolean> | null

/** Own keys only: ApiKey's access filter limits every read and write to the signed-in owner. */
export async function getApiKeys(): Promise<ApiKeysData> {
  const response = await deskRequest<{
    apiKeys: ApiKey[]
    authenticatedItem: {
      role: RoleFlags
      dealerGroupMemberships: Array<{ role: RoleFlags }>
      rooftopMemberships: Array<{ role: RoleFlags }>
    } | null
  }>(`
    query ApiKeysDesk {
      apiKeys(orderBy: [{ createdAt: desc }], take: 200) { ${KEY_FIELDS} }
      authenticatedItem {
        ... on User {
          role { id ${ROLE_FLAGS} }
          dealerGroupMemberships(where: { status: { equals: "active" } }) { role { id ${ROLE_FLAGS} } }
          rooftopMemberships(where: { status: { equals: "active" } }) { role { id ${ROLE_FLAGS} } }
        }
      }
    }
  `)
  if (!response.success) return { keys: [], grantableScopes: [], error: response.error }
  const owner = response.data.authenticatedItem
  const roles = [owner?.role, ...(owner?.dealerGroupMemberships || []).map(row => row.role), ...(owner?.rooftopMemberships || []).map(row => row.role)].filter(Boolean) as Array<Record<string, boolean>>
  const held = new Set(SCOPE_PERMISSIONS.filter(permission => roles.some(role => role[permission] === true)))
  return {
    keys: response.data.apiKeys,
    grantableScopes: API_KEY_SCOPES.filter(scope => scope.permissions.every(permission => held.has(permission))).map(scope => scope.value),
    error: null,
  }
}

type KeyInput = { name: string; scopes: string[]; expiresAt: string | null; restrictedToIPs: string[] }

function validate(input: KeyInput): Record<string, string> {
  const errors: Record<string, string> = {}
  const name = input.name.trim()
  if (!name) errors.name = 'Name is required'
  else if (name.length > 200) errors.name = '200 characters or fewer'
  if (!input.scopes.length) errors.scopes = 'Choose at least one scope'
  else if (input.scopes.some(scope => !API_KEY_SCOPES.some(known => known.value === scope))) errors.scopes = 'Unknown scope'
  if (input.expiresAt) {
    const at = Date.parse(input.expiresAt)
    if (!Number.isFinite(at)) errors.expiresAt = 'Enter a valid date'
    else if (at <= Date.now()) errors.expiresAt = 'Must be in the future'
  }
  const invalid = input.restrictedToIPs.filter(ip => !isIP(ip) || ip.includes('%'))
  if (invalid.length) errors.restrictedToIPs = `Not an IP address: ${invalid.join(', ')}`
  else if (input.restrictedToIPs.length > 50) errors.restrictedToIPs = '50 addresses or fewer'
  return errors
}

function invalid<T>(fieldErrors: Record<string, string>): DeskResult<T> {
  return { success: false, error: 'Check the highlighted fields', fieldErrors }
}

/**
 * Generates the secret on the server and returns it once. Only the hash (password field) and a
 * preview are stored, so the token cannot be shown again.
 */
export async function createApiKey(input: KeyInput): Promise<DeskResult<{ key: ApiKey; token: string }>> {
  const fieldErrors = validate(input)
  if (Object.keys(fieldErrors).length) return invalid(fieldErrors)
  const token = `of_${randomBytes(32).toString('base64url')}`
  const response = await deskRequest<{ createApiKey: ApiKey | null }>(`
    mutation CreateApiKey($data: ApiKeyCreateInput!) { createApiKey(data: $data) { ${KEY_FIELDS} } }
  `, {
    data: {
      name: input.name.trim(),
      scopes: input.scopes,
      expiresAt: input.expiresAt || null,
      restrictedToIPs: input.restrictedToIPs,
      tokenSecret: token,
      status: 'active',
    },
  })
  if (!response.success) {
    if (response.fieldErrors?.scopes == null && /Scopes must be/.test(response.error)) return invalid({ scopes: 'Only scopes your own permissions allow' })
    return response
  }
  if (!response.data.createApiKey) return { success: false, error: 'API key was not created' }
  revalidatePath(API_KEYS_PATH)
  return { success: true, data: { key: response.data.createApiKey, token } }
}

export async function updateApiKey(id: string, input: KeyInput): Promise<DeskResult<{ id: string }>> {
  const fieldErrors = validate(input)
  if (Object.keys(fieldErrors).length) return invalid(fieldErrors)
  const response = await deskRequest<{ updateApiKey: { id: string } | null }>(`
    mutation UpdateApiKey($id: ID!, $data: ApiKeyUpdateInput!) { updateApiKey(where: { id: $id }, data: $data) { id } }
  `, { id, data: { name: input.name.trim(), scopes: input.scopes, expiresAt: input.expiresAt || null, restrictedToIPs: input.restrictedToIPs } })
  if (!response.success) {
    if (/Scopes must be/.test(response.error)) return invalid({ scopes: 'Only scopes your own permissions allow' })
    return response
  }
  if (!response.data.updateApiKey) return { success: false, error: 'API key not found' }
  revalidatePath(API_KEYS_PATH)
  return { success: true, data: { id: response.data.updateApiKey.id } }
}

/** active <-> inactive, and anything -> revoked. A revoked key cannot be reactivated (ApiKey validate hook). */
export async function setApiKeyStatus(id: string, status: ApiKeyStatus): Promise<DeskResult<{ id: string; status: ApiKeyStatus }>> {
  const response = await deskRequest<{ updateApiKey: { id: string; status: ApiKeyStatus } | null }>(`
    mutation SetApiKeyStatus($id: ID!, $data: ApiKeyUpdateInput!) { updateApiKey(where: { id: $id }, data: $data) { id status } }
  `, { id, data: { status } })
  if (!response.success) return response
  if (!response.data.updateApiKey) return { success: false, error: 'API key not found' }
  revalidatePath(API_KEYS_PATH)
  return { success: true, data: response.data.updateApiKey }
}
