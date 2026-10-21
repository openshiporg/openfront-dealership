import { NextResponse, type NextRequest } from "next/server";

// The vertical's storefront hook for the shared proxy, supplied per vertical as Openfront Restaurant does. The
// dealership storefront needs no region, cart-cookie or redirect handling, so every request passes through, as it
// did in the dealership's previous proxy.
export async function handleStorefrontRoutes(_request: NextRequest, _user: unknown) {
  return NextResponse.next();
}
