import {
  BarChart3,
  CalendarClock,
  Car,
  CarFront,
  ClipboardList,
  CreditCard,
  DollarSign,
  Gauge,
  Landmark,
  LucideIcon,
  Package,
  PackageCheck,
  Settings2,
  Sparkles,
  Users,
  Wrench,
} from 'lucide-react'

export interface PlatformNavItem {
  title: string
  href: string
  color: string
  description: string
  icon: LucideIcon
  group?: string
}

export interface PlatformNavGroup {
  id: string
  title: string
  icon: LucideIcon
  items: PlatformNavItem[]
}

export const platformNavItems: PlatformNavItem[] = [
  // Standalone
  { title: 'Overview',       href: '/platform/overview',       color: 'slate',   description: 'Daily sales, inventory, and service performance.',              icon: Gauge,         group: 'standalone' },
  { title: 'Inventory',      href: '/platform/vehicles',       color: 'blue',    description: 'Manage vehicle inventory, pricing, photos, and merchandising.', icon: Car,           group: 'standalone' },
  { title: 'Deals',          href: '/platform/deals',          color: 'emerald', description: 'Work deals from quote through contracting and delivery.',       icon: DollarSign,    group: 'standalone' },
  { title: 'Analytics',      href: '/platform/analytics',      color: 'violet',  description: 'Track sales, inventory, conversion, and operations metrics.',   icon: BarChart3,     group: 'standalone' },
  { title: 'Store Settings', href: '/platform/store-settings', color: 'slate',   description: 'Configure dealership settings, hours, and branding.',           icon: Settings2,     group: 'standalone' },

  // Sales
  { title: 'CRM',            href: '/platform/crm',            color: 'purple',  description: 'Manage leads, contacts, follow-up, and sales opportunities.',   icon: Users,         group: 'sales' },
  { title: 'Test Drives',    href: '/platform/test-drives',    color: 'cyan',    description: 'Schedule and track test drive appointments.',                   icon: CalendarClock, group: 'sales' },
  { title: 'Trade-Ins',      href: '/platform/trade-ins',      color: 'amber',   description: 'Evaluate trade-in vehicles and acquisition opportunities.',     icon: CarFront,      group: 'sales' },

  // Finance
  { title: 'Finance',        href: '/platform/finance',        color: 'indigo',  description: 'Review finance applications and lender workflows.',             icon: CreditCard,    group: 'finance' },
  { title: 'Delivery',       href: '/platform/delivery',       color: 'teal',    description: 'Schedule deliveries and complete handoff checklists.',          icon: PackageCheck,  group: 'finance' },
  { title: 'Accounting',     href: '/platform/accounting',     color: 'sky',     description: 'Export accounting batches and reconcile payments.',             icon: Landmark,      group: 'finance' },

  // Service
  { title: 'Service',        href: '/platform/service',        color: 'orange',  description: 'Coordinate service appointments and repair work.',              icon: Wrench,        group: 'service' },

  // Operations
  { title: 'Staff',          href: '/platform/users',          color: 'purple',  description: 'Manage staff accounts, roles, and permissions.',                icon: Users,         group: 'operations' },
]

export const platformStandaloneItems = platformNavItems.filter((item) => item.group === 'standalone')

export const platformNavGroups: PlatformNavGroup[] = [
  { id: 'sales',      title: 'Sales',      icon: Users,         items: platformNavItems.filter((i) => i.group === 'sales') },
  { id: 'finance',    title: 'Finance',    icon: CreditCard,    items: platformNavItems.filter((i) => i.group === 'finance') },
  { id: 'service',    title: 'Service',    icon: Wrench,        items: platformNavItems.filter((i) => i.group === 'service') },
  { id: 'operations', title: 'Operations', icon: ClipboardList, items: platformNavItems.filter((i) => i.group === 'operations') },
]

export function getPlatformNavItemsWithBasePath(basePath: string) {
  return platformNavItems.map((item) => ({
    ...item,
    href: `${basePath}${item.href}`,
  }))
}

export function getIconForNavItem(title: string): LucideIcon {
  if (title === 'Onboarding') {
    return Sparkles
  }

  const item = platformNavItems.find((navItem) => navItem.title === title)
  return item?.icon || Package
}
