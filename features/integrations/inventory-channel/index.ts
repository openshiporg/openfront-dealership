export type InventoryChannelAdapter = {
  key: string
  label: string
  mode: 'internal' | 'operator-recorded'
  externalRequestSent: false
}

const CHANNELS: Readonly<Record<string, InventoryChannelAdapter>> = Object.freeze({
  'public-inventory-feed': Object.freeze({
    key: 'public-inventory-feed',
    label: 'Built-in public inventory feed',
    mode: 'internal',
    externalRequestSent: false,
  }),
  'manual-marketplace-export': Object.freeze({
    key: 'manual-marketplace-export',
    label: 'Operator-recorded marketplace export',
    mode: 'operator-recorded',
    externalRequestSent: false,
  }),
})

export function resolveInventoryChannel(key: unknown) {
  const channel = CHANNELS[String(key || '')]
  if (!channel) throw new Error('Unsupported inventory channel')
  return channel
}

export function inventoryChannelKeys() {
  return Object.keys(CHANNELS)
}
