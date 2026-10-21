import { NextRequest, NextResponse } from 'next/server'

import { getPublicInventoryFeedResponse } from '@/features/keystone/integrations/inventory/publicInventoryFeed'
import { keystoneContext } from '@/features/keystone/context'

export async function GET(request: NextRequest) {
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host')
  const protocol = request.headers.get('x-forwarded-proto') || 'https'
  const { status, body } = await getPublicInventoryFeedResponse(keystoneContext, {
    baseUrl: host ? `${protocol}://${host}` : request.nextUrl.origin,
    pathname: request.nextUrl.pathname,
    search: request.nextUrl.search,
    searchParams: request.nextUrl.searchParams,
  })
  return NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'public, max-age=60, stale-while-revalidate=300' },
  })
}
