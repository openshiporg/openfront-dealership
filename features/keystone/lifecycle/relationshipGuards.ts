type RelationshipInput = {
  connect?: { id?: string | number } | Array<{ id?: string | number }>
  disconnect?: boolean | { id?: string | number } | Array<{ id?: string | number }>
  set?: Array<{ id?: string | number }>
}

export function connectedId(value: unknown): string | null | undefined {
  if (value === undefined) return undefined
  if (value === null) return null
  if (typeof value !== 'object') return undefined

  const relation = value as RelationshipInput
  if (relation.disconnect === true) return null
  if (Array.isArray(relation.connect)) {
    const id = relation.connect[0]?.id
    return id == null ? undefined : String(id)
  }
  if (relation.connect?.id != null) return String(relation.connect.id)
  if (Array.isArray(relation.set)) {
    const id = relation.set[0]?.id
    return id == null ? null : String(id)
  }
  return undefined
}

export function assertRelationshipUnchanged(
  field: string,
  resolvedData: Record<string, unknown>,
  currentId: unknown
) {
  const nextId = connectedId(resolvedData[field])
  if (nextId === undefined) return
  const normalizedCurrent = currentId == null ? null : String(currentId)
  if (nextId !== normalizedCurrent) {
    throw new Error(`${field} cannot be moved to another record`)
  }
}

export async function assertAccessibleRelationship(
  context: any,
  listKey: string,
  id: string | null | undefined,
  query = 'id'
) {
  if (!id) return null
  const item = await context.query[listKey].findOne({ where: { id }, query })
  if (!item) throw new Error(`${listKey} relationship is not accessible`)
  return item
}
