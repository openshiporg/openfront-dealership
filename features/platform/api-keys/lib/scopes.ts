/**
 * Dealership API key scopes and the permission each needs.
 * Mirrors API_KEY_SCOPES in features/keystone/models/ApiKey.ts and API_SCOPE_PERMISSIONS in
 * features/keystone/utils/apiKeyPolicy.ts; a key may only carry scopes its owner holds.
 */
export const API_KEY_SCOPES: ReadonlyArray<{ value: string; label: string; permissions: readonly string[] }> = [
  { value: 'read_inventory', label: 'View vehicle inventory', permissions: ['canViewInventory'] },
  { value: 'write_inventory', label: 'Manage vehicle inventory', permissions: ['canViewInventory', 'canManageInventory'] },
  { value: 'write_leads', label: 'Manage leads and customers', permissions: ['canManageLeads'] },
  { value: 'write_deals', label: 'Manage deals', permissions: ['canManageDeals'] },
  { value: 'write_service', label: 'Manage service appointments and repair orders', permissions: ['canManageService'] },
  { value: 'read_reports', label: 'View reports', permissions: ['canViewReports'] },
]

export type ApiKeyStatus = 'active' | 'inactive' | 'revoked'

export type ApiKey = {
  id: string
  name: string
  tokenPreview: string | null
  scopes: string[] | null
  status: ApiKeyStatus
  expiresAt: string | null
  lastUsedAt: string | null
  usageCount: { total?: number; daily?: Record<string, number> } | null
  restrictedToIPs: string[] | null
  createdAt: string | null
  updatedAt: string | null
}

export type ApiKeysData = {
  keys: ApiKey[]
  /** Scopes the signed-in owner can grant; others are shown disabled. */
  grantableScopes: string[]
  error: string | null
}

/** "2026-12-31" in the dealership zone -> the UTC instant of 23:59:59 that day. */
export function endOfDayInZone(date: string, timeZone: string) {
  const match = date.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) return null
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])]
  const guess = Date.UTC(year, month - 1, day, 23, 59, 59)
  const parts = new Intl.DateTimeFormat('en-US', { timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })
    .formatToParts(new Date(guess))
    .reduce<Record<string, number>>((acc, part) => (part.type === 'literal' ? acc : { ...acc, [part.type]: Number(part.value) }), {})
  const asZone = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second)
  return new Date(guess - (asZone - guess))
}
