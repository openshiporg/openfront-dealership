import { GraphQLError } from 'graphql'

export const OPERATOR_COMMAND_REJECTED = 'OPERATOR_COMMAND_REJECTED'

/**
 * GraphQL Yoga masks every non-GraphQLError as "Unexpected error.". Finance, funding and delivery
 * commands throw plain `Error`s only for their own validation and lifecycle gates ("Record the OFAC
 * check first"), so those messages pass through as GraphQLErrors with a stable code the desks can
 * show as-is. Library errors (Prisma, Keystone, zod, any Error subclass) stay masked.
 * Same contract as `inventoryCommand` in ./inventoryCommandErrors.
 */
export function operatorCommand<A extends unknown[], R>(resolver: (...args: A) => Promise<R>) {
  return async (...args: A): Promise<R> => {
    try {
      return await resolver(...args)
    } catch (error) {
      if (error instanceof Error && !(error instanceof GraphQLError) && Object.getPrototypeOf(error) === Error.prototype) {
        throw new GraphQLError(error.message, { extensions: { code: OPERATOR_COMMAND_REJECTED } })
      }
      throw error
    }
  }
}
