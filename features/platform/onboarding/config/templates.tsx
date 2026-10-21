import { Building2, Package, CircleCheck } from 'lucide-react'
import seedData from '../lib/seed.json'

export type TemplateKey = 'full' | 'minimal' | 'custom'

export const SECTION_TYPES = [
  'dealership',
  'vehicleMakes',
  'vehicleModels',
  'vehicles',
  'services',
  'parts',
  'financeProducts',
  'leadRoutingRules',
  'accountingMappings',
  'paymentProviders',
  'staff',
] as const

export type SectionType = (typeof SECTION_TYPES)[number]

// One display label per seed record; the same label tracks its progress.
export function seedItemLabel(type: SectionType, item: any): string {
  switch (type) {
    case 'dealership':
      return item?.name || 'Dealership'
    case 'vehicleModels':
      return `${item.make || ''} ${item.name || ''}`.trim() || 'Model'
    case 'vehicles':
      return `${item.year || ''} ${item.make || ''} ${item.model || item.vin || ''}`.trim() || 'Vehicle'
    case 'parts':
      return item.description || item.partNumber || 'Part'
    case 'accountingMappings':
      return `${item.sourceType || ''} / ${item.sourceCode || ''}`
    case 'staff':
      return item.role || 'Role'
    default:
      return item.name || 'Record'
  }
}

type DisplayNames = Record<SectionType, string[]>

function labels(type: SectionType, filter: (item: any) => boolean = () => true): string[] {
  if (type === 'dealership') return [seedItemLabel('dealership', seedData.dealership)]
  return ((seedData as any)[type] as any[]).filter(filter).map(item => seedItemLabel(type, item))
}

const basicMakes = ['Toyota', 'Honda', 'Ford']
const basicVehicleModels = ['Camry', 'Highlander', 'CR-V', 'Mustang Mach-E']

const fullDisplayNames = Object.fromEntries(SECTION_TYPES.map(type => [type, labels(type)])) as DisplayNames

const basicDisplayNames: DisplayNames = {
  dealership: labels('dealership'),
  vehicleMakes: labels('vehicleMakes', item => basicMakes.includes(item.name)),
  vehicleModels: labels('vehicleModels', item => basicVehicleModels.includes(item.name)),
  vehicles: labels('vehicles', item => basicVehicleModels.includes(item.model)),
  services: labels('services', item => ['Synthetic Oil Change', 'Tire Rotation & Balance', 'Multi-Point Inspection'].includes(item.name)),
  parts: labels('parts', item => ['90915-YZZD1', '15400-PLM-A02', '0W20-SYN-5QT'].includes(item.partNumber)),
  financeProducts: labels('financeProducts', item => ['VSC-60-75', 'GAP-PLUS'].includes(item.code)),
  leadRoutingRules: labels('leadRoutingRules', item => ['website', 'phone'].includes(item.source)),
  accountingMappings: labels('accountingMappings'),
  paymentProviders: labels('paymentProviders', item => item.code === 'pp_system_default'),
  staff: labels('staff', item => ['sales-manager', 'sales-associate', 'service-manager'].includes(item.code)),
}

export interface DealershipTemplate {
  name: string
  description: string
  icon: React.ReactNode
  displayNames: DisplayNames
}

export const DEALERSHIP_TEMPLATES: Record<TemplateKey, DealershipTemplate> = {
  full: {
    name: 'Complete Setup',
    description: 'Set up your dealership profile, full inventory, service, parts, financing, accounting and staff roles.',
    icon: <Building2 className="h-5 w-5" />,
    displayNames: fullDisplayNames,
  },
  minimal: {
    name: 'Basic Setup',
    description: 'A few vehicles, services and staff roles to get started.',
    icon: <Package className="h-5 w-5" />,
    displayNames: basicDisplayNames,
  },
  custom: {
    name: 'Custom Setup',
    description: 'Use your own JSON configuration.',
    icon: <CircleCheck className="h-5 w-5" />,
    displayNames: basicDisplayNames,
  },
}

export interface SectionDefinition {
  id: number
  type: SectionType
  label: string
  getItemsFn: (template: TemplateKey) => string[]
}

const SECTION_LABELS: Record<SectionType, string> = {
  dealership: 'Dealership Information',
  vehicleMakes: 'Vehicle Makes',
  vehicleModels: 'Vehicle Models',
  vehicles: 'Vehicle Inventory',
  services: 'Service Packages',
  parts: 'Parts Inventory',
  financeProducts: 'Finance Products',
  leadRoutingRules: 'Lead Routing',
  accountingMappings: 'Accounting Mappings',
  paymentProviders: 'Payment Providers',
  staff: 'Staff Roles',
}

export const SECTION_DEFINITIONS: SectionDefinition[] = SECTION_TYPES.map((type, index) => ({
  id: index + 1,
  type,
  label: SECTION_LABELS[type],
  getItemsFn: template => DEALERSHIP_TEMPLATES[template].displayNames[type],
}))
