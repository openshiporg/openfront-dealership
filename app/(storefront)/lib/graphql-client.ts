import { GraphQLClient } from 'graphql-request'

const endpoint = process.env.NEXT_PUBLIC_GRAPHQL_ENDPOINT || 'http://localhost:3000/api/graphql'

export const graphqlClient = new GraphQLClient(endpoint, {
  headers: {
    'Content-Type': 'application/json',
  },
})

export async function fetchGraphQL<T>(query: string, variables?: Record<string, any>): Promise<T> {
  try {
    const data = await graphqlClient.request<T>(query, variables)
    return data
  } catch (error) {
    console.error('GraphQL Error:', error)
    throw error
  }
}
