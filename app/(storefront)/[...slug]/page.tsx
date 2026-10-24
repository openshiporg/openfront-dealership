import { notFound } from 'next/navigation'

// Unmatched storefront URLs 404 inside the storefront layout instead of the bare root 404.
export default function Page() {
  notFound()
}
