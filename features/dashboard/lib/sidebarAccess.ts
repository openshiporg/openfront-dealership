/**
 * Sidebar filtering from capabilities the session already has: the role's
 * canAccessDashboard flag and Keystone's per-session list `isHidden` from admin meta.
 * Plain module: no 'use server' / 'use client', no @/ imports.
 */

type SidebarList = { path: string; isHidden?: boolean | null }
type SidebarUser = { role?: { canAccessDashboard?: boolean | null; canManageSettings?: boolean | null; canManageOnboarding?: boolean | null; canManageDealerships?: boolean | null } | null } | null | undefined

/** Only an explicit false hides navigation; an unknown user is left to the middleware. */
export function canUseDashboardNav(user: SidebarUser) {
  return user?.role?.canAccessDashboard !== false
}

export function visibleSidebarLists<T extends SidebarList>(lists: T[], user: SidebarUser): T[] {
  if (!canUseDashboardNav(user)) return []
  return lists.filter((list) => !list.isHidden)
}

/** Platform pages whose data lives in a list with a different path; the page follows that list's visibility. */
export function canEditStoreSettings(user: SidebarUser) {
  const role = user?.role
  return role?.canManageSettings === true || role?.canManageOnboarding === true || role?.canManageDealerships === true
}

export const PLATFORM_PAGE_LIST: Record<string, string> = {
  crm: 'leads',
  finance: 'financing-applications',
  delivery: 'delivery-cases',
  payments: 'payment-transactions',
  accounting: 'accounting-batches',
  service: 'service-orders',
  parts: 'parts-inventories',
  reports: 'saved-reports',
}

/**
 * A platform page whose first segment is a list path follows that list's visibility;
 * pages that are not tied to one list stay visible to dashboard users.
 */
export function visiblePlatformItems<T extends { href: string }>(
  items: T[],
  lists: SidebarList[],
  user: SidebarUser
): T[] {
  if (!canUseDashboardNav(user)) return []
  const hiddenPaths = new Set(lists.filter((list) => list.isHidden).map((list) => list.path))
  return items.filter((item) => {
    const slug = item.href.split('/platform/')[1]?.split(/[/?#]/)[0]
    if (!slug) return true
    // Store Settings is saved by roles that manage settings, onboarding or dealerships only; an unknown user is left to the page.
    if (slug === 'store-settings' && user?.role && !canEditStoreSettings(user)) return false
    return !hiddenPaths.has(slug) && !hiddenPaths.has(PLATFORM_PAGE_LIST[slug] ?? slug)
  })
}
