import { GraphQLError } from 'graphql'

export const INVENTORY_COMMAND_REJECTED = 'INVENTORY_COMMAND_REJECTED'

/**
 * GraphQL Yoga masks every non-GraphQLError as "Unexpected error.". Inventory commands throw plain
 * `Error`s only for their own validation and lifecycle gates, so those messages are passed through as
 * GraphQLErrors with a stable code. Library errors (Prisma, Keystone, subclasses of Error) stay masked.
 */
export function inventoryCommand<A extends unknown[], R>(resolver: (...args: A) => Promise<R>) {
  return async (...args: A): Promise<R> => {
    try {
      return await resolver(...args)
    } catch (error) {
      if (error instanceof Error && !(error instanceof GraphQLError) && Object.getPrototypeOf(error) === Error.prototype) {
        throw new GraphQLError(error.message, { extensions: { code: INVENTORY_COMMAND_REJECTED } })
      }
      throw error
    }
  }
}
