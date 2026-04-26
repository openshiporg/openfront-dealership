import { DEALERSHIP_TEMPLATES } from '../config/templates';

// Helper function to extract display items from JSON data
export function getItemsFromJsonData(jsonData: any, sectionType: string): string[] {
  if (!jsonData) return [];

  switch (sectionType) {
    case 'dealership':
      return jsonData.dealership ? [jsonData.dealership.name || 'Unknown Dealership'] : ['Elite Auto Dealership'];
    case 'regions':
      return (jsonData.regions || []).map((r: any) =>
        `${r.name || 'Unknown'} (${(r.currencyCode || 'USD').toUpperCase()})`
      );
    case 'paymentProviders':
      return (jsonData.paymentProviders || []).map((p: any) => p.name || 'Unknown Provider');
    case 'shipping':
      return (jsonData.shipping_options || []).map((s: any) => s.name || 'Unknown Delivery');
    case 'vehicleMakes':
      return (jsonData.vehicleMakes || []).map((m: any) => m.name || 'Unknown Make');
    case 'vehicleTypes':
      return (jsonData.vehicleTypes || []).map((t: any) => t.name || 'Unknown Type');
    case 'services':
      return (jsonData.services || []).map((s: any) => s.name || 'Unknown Service');
    case 'staff':
      return (jsonData.staff || []).map((s: any) => s.role || 'Unknown Role');
    default:
      return [];
  }
}

// Helper to get the right slice of seed data for a template
export function getSeedForTemplate(template: 'full' | 'minimal' | 'custom', seedData: any, customData?: Record<string, string[]>) {
  const templateToUse = template === 'custom' ? 'minimal' : template;
  const tpl = DEALERSHIP_TEMPLATES[templateToUse];

  // Get the region codes for this template
  const templateRegionCodes = tpl.regions;

  return {
    regions: (seedData.regions as any[]).filter((r: any) =>
      tpl.regions.includes(r.code)
    ),
    paymentProviders: (seedData.paymentProviders as any[]).filter((p: any) =>
      tpl.paymentProviders.includes(p.code)
    ),
    shipping_options: (seedData.shipping_options as any[]).filter((s: any) =>
      tpl.shipping.includes(s.name)
    ),
    vehicleMakes: (seedData.vehicleMakes as any[]).filter((m: any) =>
      tpl.vehicleMakes.includes(m.name)
    ),
    vehicleTypes: (seedData.vehicleTypes as any[]).filter((t: any) =>
      tpl.vehicleTypes.includes(t.name)
    ),
    services: (seedData.services as any[]).filter((s: any) =>
      tpl.services.includes(s.name)
    ),
    staff: (seedData.staff as any[]).filter((s: any) =>
      tpl.staff.includes(s.role)
    ),
  };
}
