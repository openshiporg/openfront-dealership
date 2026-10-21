/** GraphQL DateTime scalars may already be Date objects. String(Date) drops milliseconds. */
export function commandDate(value: unknown, label = 'expectedUpdatedAt'): Date {
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(String(value ?? ''))
  if (Number.isNaN(date.getTime())) throw new Error(`${label} is invalid`)
  return date
}
