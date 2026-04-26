import { Building2, Package, CircleCheck } from 'lucide-react';

export interface DealershipTemplate {
  name: string;
  description: string;
  icon: React.ReactNode;
  regions: string[];
  paymentProviders: string[];
  shipping: string[];
  vehicleMakes: string[];
  vehicleTypes: string[];
  services: string[];
  staff: string[];
  displayNames: {
    dealership: string[];
    regions: string[];
    paymentProviders: string[];
    shipping: string[];
    vehicleMakes: string[];
    vehicleTypes: string[];
    services: string[];
    staff: string[];
  };
}

export const DEALERSHIP_TEMPLATES: Record<'full' | 'minimal' | 'custom', DealershipTemplate> = {
  full: {
    name: 'Complete Setup',
    description:
      'Start with a fully configured dealership including multiple regions, payment methods, vehicle inventory, and service offerings.',
    icon: <Building2 className="h-5 w-5" />,
    regions: ['na', 'eu', 'uk'],
    paymentProviders: [
      'pp_stripe_stripe',
      'pp_financing_dealer',
      'pp_system_default',
    ],
    shipping: ['Dealership Pickup', 'Vehicle Delivery', 'Transfer Service'],
    vehicleMakes: ['Ford', 'Chevrolet', 'Toyota', 'Honda', 'BMW', 'Mercedes-Benz'],
    vehicleTypes: ['Sedan', 'SUV', 'Truck', 'Coupe', 'Van', 'Electric'],
    services: ['Oil Change', 'Tire Rotation', 'Brake Service', 'Vehicle Inspection', 'Detailing', 'Parts Sales'],
    staff: ['Sales Manager', 'Sales Associate', 'Finance Manager', 'Service Manager', 'Technician', 'Parts Specialist'],
    displayNames: {
      dealership: ['Elite Auto Dealership'],
      regions: ['North America (USD)', 'Europe (EUR)', 'United Kingdom (GBP)'],
      paymentProviders: ['Credit/Debit Card', 'Dealer Financing', 'Cash/Check'],
      shipping: ['Dealership Pickup', 'Vehicle Delivery', 'Transfer Service'],
      vehicleMakes: ['Ford', 'Chevrolet', 'Toyota', 'Honda', 'BMW', 'Mercedes-Benz'],
      vehicleTypes: ['Sedan', 'SUV', 'Truck', 'Coupe', 'Van', 'Electric'],
      services: ['Oil Change', 'Tire Rotation', 'Brake Service', 'Vehicle Inspection', 'Detailing', 'Parts Sales'],
      staff: ['Sales Manager', 'Sales Associate', 'Finance Manager', 'Service Manager', 'Technician', 'Parts Specialist'],
    },
  },
  minimal: {
    name: 'Basic Setup',
    description:
      'Start with just the essentials - one region, basic payment methods, and core vehicle types.',
    icon: <Package className="h-5 w-5" />,
    regions: ['na'],
    paymentProviders: ['pp_system_default'],
    shipping: ['Dealership Pickup'],
    vehicleMakes: ['Ford', 'Toyota'],
    vehicleTypes: ['Sedan', 'SUV'],
    services: ['Oil Change', 'Tire Rotation'],
    staff: ['Sales Manager', 'Service Manager'],
    displayNames: {
      dealership: ['Elite Auto Dealership'],
      regions: ['North America (USD)'],
      paymentProviders: ['Cash/Check'],
      shipping: ['Dealership Pickup'],
      vehicleMakes: ['Ford', 'Toyota'],
      vehicleTypes: ['Sedan', 'SUV'],
      services: ['Oil Change', 'Tire Rotation'],
      staff: ['Sales Manager', 'Service Manager'],
    },
  },
  custom: {
    name: 'Custom Setup',
    description:
      'Customize your setup with your own JSON templates for each section.',
    icon: <CircleCheck className="h-5 w-5" />,
    regions: ['na'],
    paymentProviders: ['pp_system_default'],
    shipping: ['Dealership Pickup'],
    vehicleMakes: ['Ford'],
    vehicleTypes: ['Sedan'],
    services: ['Oil Change'],
    staff: ['Sales Manager'],
    displayNames: {
      dealership: ['Elite Auto Dealership'],
      regions: ['North America (USD)'],
      paymentProviders: ['Cash/Check'],
      shipping: ['Dealership Pickup'],
      vehicleMakes: ['Ford'],
      vehicleTypes: ['Sedan'],
      services: ['Oil Change'],
      staff: ['Sales Manager'],
    },
  },
};

export interface SectionDefinition {
  id: number;
  type: string;
  label: string;
  getItemsFn: (template: 'full' | 'minimal' | 'custom') => string[];
  jsonKey: 'regions' | 'paymentProviders' | 'shipping_options' | 'vehicleMakes' | 'vehicleTypes' | 'services' | 'staff';
}

export const SECTION_DEFINITIONS: SectionDefinition[] = [
  {
    id: 1,
    type: 'dealership',
    label: 'Dealership Information',
    getItemsFn: () => ['Elite Auto Dealership'],
    jsonKey: 'dealership' as const,
  },
  {
    id: 2,
    type: 'regions',
    label: 'Regions & Countries',
    getItemsFn: (template) => DEALERSHIP_TEMPLATES[template].displayNames.regions,
    jsonKey: 'regions' as const,
  },
  {
    id: 3,
    type: 'paymentProviders',
    label: 'Payment Providers',
    getItemsFn: (template) => DEALERSHIP_TEMPLATES[template].displayNames.paymentProviders,
    jsonKey: 'paymentProviders' as const,
  },
  {
    id: 4,
    type: 'shipping',
    label: 'Delivery Options',
    getItemsFn: (template) => DEALERSHIP_TEMPLATES[template].displayNames.shipping,
    jsonKey: 'shipping_options' as const,
  },
  {
    id: 5,
    type: 'vehicleMakes',
    label: 'Vehicle Makes',
    getItemsFn: (template) => DEALERSHIP_TEMPLATES[template].displayNames.vehicleMakes,
    jsonKey: 'vehicleMakes' as const,
  },
  {
    id: 6,
    type: 'vehicleTypes',
    label: 'Vehicle Types',
    getItemsFn: (template) => DEALERSHIP_TEMPLATES[template].displayNames.vehicleTypes,
    jsonKey: 'vehicleTypes' as const,
  },
  {
    id: 7,
    type: 'services',
    label: 'Service Offerings',
    getItemsFn: (template) => DEALERSHIP_TEMPLATES[template].displayNames.services,
    jsonKey: 'services' as const,
  },
  {
    id: 8,
    type: 'staff',
    label: 'Staff Roles',
    getItemsFn: (template) => DEALERSHIP_TEMPLATES[template].displayNames.staff,
    jsonKey: 'staff' as const,
  },
];
