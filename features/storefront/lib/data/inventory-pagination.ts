export const INVENTORY_PAGE_SIZE = 12

// GraphQL Int is signed 32-bit; this is a transport bound, not a product page cap.
const MAX_GRAPHQL_INT = 2_147_483_647

export type InventoryPageRequest =
  | { status: 'valid'; page: number; skip: number }
  | { status: 'invalid' }

export function parseInventoryPage(value: string | null | undefined): InventoryPageRequest {
  if (value == null) return { status: 'valid', page: 1, skip: 0 }
  if (!/^\d+$/.test(value)) return { status: 'invalid' }

  const page = Number(value)
  if (!Number.isSafeInteger(page) || page < 1) return { status: 'invalid' }

  const skip = (page - 1) * INVENTORY_PAGE_SIZE
  if (!Number.isSafeInteger(skip) || skip > MAX_GRAPHQL_INT) return { status: 'invalid' }
  return { status: 'valid', page, skip }
}

export type InventoryPageResolution =
  | { status: 'ready'; page: number; totalPages: number }
  | { status: 'empty'; resetToFirstPage: boolean }
  | { status: 'out-of-range'; lastPage: number }
  | { status: 'invalid-response' }

export function resolveInventoryPage(requestedPage: number, totalCount: number, itemCount: number): InventoryPageResolution {
  if (
    !Number.isSafeInteger(requestedPage) || requestedPage < 1 ||
    !Number.isSafeInteger(totalCount) || totalCount < 0 ||
    !Number.isSafeInteger(itemCount) || itemCount < 0 || itemCount > INVENTORY_PAGE_SIZE
  ) {
    return { status: 'invalid-response' }
  }

  if (totalCount === 0) {
    return itemCount === 0
      ? { status: 'empty', resetToFirstPage: requestedPage > 1 }
      : { status: 'invalid-response' }
  }

  const totalPages = Math.ceil(totalCount / INVENTORY_PAGE_SIZE)
  if (requestedPage > totalPages) {
    return itemCount === 0
      ? { status: 'out-of-range', lastPage: totalPages }
      : { status: 'invalid-response' }
  }

  const expectedItems = Math.min(INVENTORY_PAGE_SIZE, totalCount - (requestedPage - 1) * INVENTORY_PAGE_SIZE)
  if (itemCount !== expectedItems) return { status: 'invalid-response' }
  return { status: 'ready', page: requestedPage, totalPages }
}
