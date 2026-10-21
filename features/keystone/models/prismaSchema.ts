function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Keep command-owned relationships non-null in generated Prisma and migrations. */
export function requiredRelationshipDb(fieldName: string) {
  const field = escapeRegExp(fieldName)
  return {
    extendPrismaSchema: (schema: string) => schema
      .replace(new RegExp(`(${field}\\s+\\w+)\\?`), '$1')
      .replace(new RegExp(`(${field}Id\\s+String)\\?`), '$1'),
  }
}

/** Preserve compound database identities that Keystone cannot express through one field. */
export function prismaModelDirectives(...directives: string[]) {
  return {
    extendPrismaSchema: (schema: string) => schema.replace(
      /\n}$/,
      `\n\n  ${directives.join('\n  ')}\n}`
    ),
  }
}
