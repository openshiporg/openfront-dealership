import { useSyncExternalStore } from 'react'

const subscribe = () => () => {}

// False during server render and hydration, true after. Dates formatted in the
// viewer's time zone wait for it so the server's UTC text never mismatches.
export function useHydrated() {
  return useSyncExternalStore(subscribe, () => true, () => false)
}
