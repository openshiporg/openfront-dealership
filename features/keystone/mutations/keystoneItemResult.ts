// Immutable command receipts are explicit, serialized DTOs. Resolve their IDs
// through the scoped DB API only at a Keystone-object GraphQL boundary: its
// DateTime/virtual/relationship resolvers require native internal item values.
// Never use this adapter for JSON/DTO response types or send internal items to
// a client outside the Keystone field resolvers (which enforce field read ACL).
export function keystoneItemResult(
  listKey: string,
  command: (root: any, args: any, context: any) => Promise<any>,
) {
  return async (root: unknown, args: any, context: any) => {
    const receipt = await command(root, args, context)
    if (!receipt) return null
    if (typeof receipt.id !== 'string' || !receipt.id) throw new Error('Command item readback is unavailable')
    return context.db[listKey].findOne({ where: { id: receipt.id } })
  }
}
