import { DEALERSHIP_TEMPLATES, SECTION_TYPES, seedItemLabel, type SectionType } from '../config/templates'

export function getItemsFromJsonData(jsonData: any, sectionType: string): string[] {
  if (!jsonData) return []
  const type = sectionType as SectionType
  if (!SECTION_TYPES.includes(type)) return []
  if (type === 'dealership') return jsonData.dealership ? [seedItemLabel('dealership', jsonData.dealership)] : []
  const records = Array.isArray(jsonData[type]) ? jsonData[type] : []
  return records.map((item: any) => seedItemLabel(type, item))
}

export function getSeedForTemplate(template: 'full' | 'minimal' | 'custom', seedData: any) {
  const templateToUse = template === 'custom' ? 'minimal' : template
  const selected = DEALERSHIP_TEMPLATES[templateToUse].displayNames

  return Object.fromEntries(SECTION_TYPES.map(type => {
    if (type === 'dealership') return [type, seedData.dealership]
    return [type, (seedData[type] as any[] || []).filter(item => selected[type].includes(seedItemLabel(type, item)))]
  }))
}

export function emptySectionItems(): Record<string, string[]> {
  return Object.fromEntries(SECTION_TYPES.map(type => [type, []]))
}
