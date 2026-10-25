import { isSignedIn, permissions } from '../access'
import { domainEventRequestHash } from '../lifecycle/domainEvents'
import { DEFAULT_STORE_LOGO_COLOR, DEFAULT_STORE_LOGO_ICON, normalizeStoreLogoColor } from '../../lib/store-logo'
import { configureAccountingMapping } from './accountingOperations'
import { configureLeadRoutingRule } from './crmIdentityWorkflows'
import { configureFinanceProduct } from './financeOperations'
import { configurePart, recordPartsMovement } from './fixedOpsOperations'
import { intakeInventoryVehicleInTransaction } from './intakeInventoryVehicle'

type SeedObject = Record<string, any>
type EnsureResult = { id: string; name?: string; reused: boolean; rooftopId?: string }

const ENTITIES = [
  'Dealership',
  'Make',
  'Model',
  'Vehicle',
  'ServicePackage',
  'Part',
  'FinanceProduct',
  'LeadRoutingRule',
  'AccountingMapping',
  'PaymentProvider',
  'Role',
] as const
type Entity = (typeof ENTITIES)[number]

const PAYMENT_ADAPTERS = new Set(['manual', 'stripe'])
const PAYMENT_FUNCTION_FIELDS = [
  'createPaymentFunction',
  'capturePaymentFunction',
  'refundPaymentFunction',
  'getPaymentStatusFunction',
  'generatePaymentLinkFunction',
  'handleWebhookFunction',
] as const

function text(value: unknown, fallback = '', max = 500) {
  return String(value ?? fallback).trim().slice(0, max)
}

function required(value: unknown, label: string, max = 200) {
  const normalized = text(value, '', max)
  if (!normalized) throw new Error(`${label} is required`)
  return normalized
}

function cents(value: unknown, label: string) {
  const amount = Number(value)
  if (!Number.isSafeInteger(amount) || amount < 0) throw new Error(`${label} must be a whole number of cents`)
  return amount
}

function slug(value: unknown, fallback: string, label: string) {
  const normalized = text(value, fallback, 120).toLowerCase()
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(normalized)) throw new Error(`${label} must use lowercase letters, numbers and hyphens`)
  return normalized
}

function optionalEmail(value: unknown, label: string) {
  const email = text(value, '', 320).toLowerCase()
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error(`${label} is invalid`)
  return email
}

// Deterministic per-record keys: a retry reuses the saved record, and an edited
// setup document produces a new key so the change is applied.
function setupKey(rooftopId: string, kind: string, code: string, input: unknown) {
  return `onboarding:${rooftopId}:${kind}:${code}:${domainEventRequestHash(input).slice(0, 16)}`
}

function rolePermissions(roleCode: string) {
  const base = { canAccessDashboard: true, canViewInventory: true }
  switch (roleCode) {
    case 'sales-manager':
      return { ...base, canManageInventory: true, canManageLeads: true, canViewAllLeads: true, canManageDeals: true, canApproveDeals: true, canViewReports: true, canManageTradeIns: true }
    case 'sales-associate':
      return { ...base, canManageLeads: true, canManageDeals: true, canManageTradeIns: true }
    case 'finance-manager':
      return { ...base, canViewAllLeads: true, canManageDeals: true, canApproveDeals: true, canManageFinancing: true, canViewReports: true, canReadPayments: true }
    case 'service-manager':
      return { ...base, canManageService: true, canViewReports: true }
    case 'service-advisor':
    case 'technician':
    case 'parts-specialist':
      return { ...base, canManageService: true }
    case 'office-manager':
      return { ...base, canViewReports: true, canReadPayments: true, canManagePayments: true }
    default:
      return base
  }
}

const ROLE_PERMISSION_KEYS = [
  'canManageInventory', 'canManageLeads', 'canViewAllLeads', 'canManageDeals',
  'canApproveDeals', 'canViewReports', 'canManageTradeIns', 'canManageFinancing', 'canManageService',
  'canReadPayments', 'canManagePayments',
] as const

function profileData(input: SeedObject) {
  const name = required(input.name, 'Dealership name')
  const currencyCode = text(input.currencyCode, 'USD', 3).toUpperCase()
  if (currencyCode !== 'USD') throw new Error('Currency must be USD')
  const websiteUrl = text(input.websiteUrl, '', 500)
  if (websiteUrl && !/^https?:\/\//.test(websiteUrl)) throw new Error('Website URL must start with http:// or https://')
  return {
    name,
    shortName: text(input.shortName, name, 200),
    salesEmail: optionalEmail(input.salesEmail, 'Sales email'),
    serviceEmail: optionalEmail(input.serviceEmail, 'Service email'),
    phone: text(input.phone, '', 50),
    addressLine1: text(input.addressLine1, '', 200),
    addressLine2: text(input.addressLine2, '', 200),
    city: text(input.city, '', 100),
    state: text(input.state, '', 100),
    postalCode: text(input.postalCode, '', 30),
    hoursMonFri: text(input.hoursMonFri, '', 100),
    hoursSaturday: text(input.hoursSaturday, '', 100),
    hoursSunday: text(input.hoursSunday, '', 100),
    websiteUrl,
    currencyCode,
    homepageTitle: text(input.homepageTitle, '', 200),
    homepageDescription: text(input.homepageDescription, '', 1000),
    logoIcon: text(input.logoIcon, '', 20_000) || DEFAULT_STORE_LOGO_ICON,
    logoColor: normalizeStoreLogoColor(text(input.logoColor, '', 100) || DEFAULT_STORE_LOGO_COLOR),
  }
}

async function ensureDealership(input: SeedObject, context: any): Promise<EnsureResult> {
  const userId = context.session.itemId
  const profile = profileData(input)
  const groupSlug = slug(input.groupSlug, 'sams-motor-company', 'Dealer group slug')
  const rooftopSlug = slug(input.rooftopSlug, 'main', 'Rooftop slug')
  const rooftopCode = text(input.rooftopCode, 'MAIN', 40).toUpperCase()
  if (!/^[A-Z0-9][A-Z0-9-]*$/.test(rooftopCode)) throw new Error('Rooftop code must use letters, numbers or hyphens')

  return context.transaction(async (tx: any) => {
    const sudo = tx.withSession(context.session).sudo()

    // Fill the profile without overwriting anything already saved in Store Settings.
    const existingProfile = await sudo.query.DealershipProfile.findOne({
      where: { id: 1 },
      query: Object.keys(profile).join(' ') + ' id',
    })
    let profileReused = Boolean(existingProfile)
    if (!existingProfile) {
      await sudo.db.DealershipProfile.createOne({ data: profile })
    } else {
      const missing = Object.fromEntries(
        Object.entries(profile).filter(([field]) => !String(existingProfile[field] ?? '').trim())
      )
      if (Object.keys(missing).length) {
        await sudo.db.DealershipProfile.updateOne({ where: { id: existingProfile.id }, data: missing })
        profileReused = false
      }
    }

    let groups = await sudo.query.DealerGroup.findMany({ where: { slug: { equals: groupSlug } }, take: 1, query: 'id' })
    const rooftops = await sudo.query.Rooftop.findMany({
      where: { publicSlug: { equals: rooftopSlug } },
      take: 1,
      query: 'id dealerGroup { id }',
    })

    // Every install, including a fresh one, starts with the rooftop-scope migration's
    // default dealer group and rooftop, which nobody belongs to. When the requested
    // rooftop slug is that unclaimed rooftop, setup adopts its group under the merchant's
    // name instead of failing on the taken slug. A group or rooftop with any member is
    // never adopted.
    const rooftopGroupId: string | undefined = rooftops[0]?.dealerGroup?.id
    if (!groups[0] && rooftopGroupId) {
      const [groupMembers, rooftopMembers] = await Promise.all([
        sudo.db.DealerGroupMembership.count({ where: { dealerGroup: { id: { equals: rooftopGroupId } } } }),
        sudo.db.RooftopMembership.count({ where: { rooftop: { dealerGroup: { id: { equals: rooftopGroupId } } } } }),
      ])
      if (groupMembers === 0 && rooftopMembers === 0) {
        await sudo.db.DealerGroup.updateOne({ where: { id: rooftopGroupId }, data: { name: profile.name } })
        await sudo.db.Rooftop.updateOne({ where: { id: rooftops[0].id }, data: { name: profile.name } })
        groups = [{ id: rooftopGroupId }]
      }
    }

    const dealerGroupId: string = groups[0]?.id
      || (await sudo.db.DealerGroup.createOne({ data: { name: profile.name, slug: groupSlug, status: 'active' } })).id

    if (rooftops[0] && rooftops[0].dealerGroup?.id !== dealerGroupId) {
      throw new Error('This rooftop slug already belongs to another dealer group')
    }
    const rooftopId: string = rooftops[0]?.id || (await sudo.db.Rooftop.createOne({
      data: {
        rooftopKey: `${dealerGroupId}:${rooftopCode}`,
        code: rooftopCode,
        name: profile.name,
        publicSlug: rooftopSlug,
        status: 'active',
        timezone: text(input.timezone, 'America/New_York', 100),
        currencyCode: profile.currencyCode,
        dealerGroup: { connect: { id: dealerGroupId } },
      },
    })).id

    const membershipKey = `${dealerGroupId}:${userId}`
    const memberships = await sudo.query.DealerGroupMembership.findMany({
      where: { membershipKey: { equals: membershipKey } },
      take: 1,
      query: 'id',
    })
    if (!memberships.length) {
      const user = await sudo.query.User.findOne({ where: { id: userId }, query: 'id role { id }' })
      const membership = await sudo.db.DealerGroupMembership.createOne({
        data: {
          membershipKey,
          status: 'active',
          accessAllRooftops: true,
          ...(user?.role?.id ? { role: { connect: { id: user.role.id } } } : {}),
          joinedAt: new Date().toISOString(),
          dealerGroup: { connect: { id: dealerGroupId } },
          user: { connect: { id: userId } },
        },
      })
      await sudo.db.MembershipAuditEvent.createOne({
        data: {
          scopeType: 'dealer-group',
          action: 'onboarding-bootstrap',
          dealerGroup: { connect: { id: dealerGroupId } },
          targetUser: { connect: { id: userId } },
          actor: { connect: { id: userId } },
          membershipId: membership.id,
          previousSnapshot: null,
          nextSnapshot: { id: membership.id, status: 'active', accessAllRooftops: true, roleId: user?.role?.id || null },
          reason: 'Onboarding',
          occurredAt: new Date().toISOString(),
        },
      })
    }

    return { id: rooftopId, rooftopId, name: profile.name, reused: profileReused && Boolean(groups[0] && rooftops[0] && memberships.length) }
  }, { timeout: 30_000 })
}

async function activeRooftopId(input: SeedObject, context: any) {
  const rooftopId = required(input.rooftopId, 'Rooftop', 100)
  const rooftop = await context.sudo().query.Rooftop.findOne({ where: { id: rooftopId }, query: 'id' })
  if (!rooftop) throw new Error('Set up the dealership before adding records to it')
  return rooftop.id as string
}

async function ensureMake(input: SeedObject, context: any): Promise<EnsureResult> {
  const name = required(input.name, 'Make name', 100)
  const existing = await context.db.Make.findMany({ where: { name: { equals: name } }, take: 1 })
  if (existing[0]) return { id: existing[0].id, name, reused: true }
  const make = await context.db.Make.createOne({ data: { name } })
  return { id: make.id, name, reused: false }
}

const BODY_STYLES = new Set(['sedan', 'suv', 'truck', 'coupe', 'hatchback', 'convertible', 'wagon', 'van', 'minivan'])

async function ensureModel(input: SeedObject, context: any): Promise<EnsureResult> {
  const name = required(input.name, 'Model name', 100)
  const makeName = required(input.make, `Make for ${name}`, 100)
  const bodyStyle = text(input.bodyStyle, '', 30)
  if (bodyStyle && !BODY_STYLES.has(bodyStyle)) throw new Error(`Unsupported body style for ${name}`)
  const baseYear = input.baseYear == null ? null : Number(input.baseYear)
  if (baseYear !== null && (!Number.isInteger(baseYear) || baseYear < 1886 || baseYear > 2200)) throw new Error(`Invalid base year for ${name}`)
  const makes = await context.db.Make.findMany({ where: { name: { equals: makeName } }, take: 1 })
  if (!makes[0]) throw new Error(`Add the make ${makeName} before its models`)
  const existing = await context.db.Model.findMany({
    where: { name: { equals: name }, make: { id: { equals: makes[0].id } } },
    take: 1,
  })
  if (existing[0]) return { id: existing[0].id, name, reused: true }
  const model = await context.db.Model.createOne({
    data: { name, make: { connect: { id: makes[0].id } }, ...(bodyStyle ? { bodyStyle } : {}), ...(baseYear ? { baseYear } : {}) },
  })
  return { id: model.id, name, reused: false }
}

async function ensureVehicle(input: SeedObject, context: any): Promise<EnsureResult> {
  if (!permissions.canManageInventory({ session: context.session })) throw new Error('Inventory management permission is required')
  const rooftopId = await activeRooftopId(input, context)
  const vin = required(input.vin, 'VIN', 17).toUpperCase()
  const name = `${text(input.year)} ${text(input.make)} ${text(input.model)}`.trim()
  const features = Array.isArray(input.features) ? input.features.slice(0, 100).map((value: unknown) => text(value, '', 200)) : []
  const intake = await context.transaction(
    (tx: any) => intakeInventoryVehicleInTransaction(tx, {
      rooftopId,
      idempotencyKey: `onboarding:${vin}`,
      reason: 'Onboarding',
      acquisitionSource: text(input.acquisitionSource, 'dealer-transfer', 40),
      sourceReference: 'onboarding',
      vin,
      stockNumber: required(input.stockNumber, `Stock number for ${vin}`, 100),
      year: Number(input.year),
      make: required(input.make, `Make for ${vin}`, 100),
      model: required(input.model, `Model for ${vin}`, 100),
      trim: text(input.trim, '', 100),
      exteriorColor: text(input.exteriorColor, '', 100),
      interiorColor: text(input.interiorColor, '', 100),
      mileage: Number(input.mileage || 0),
      purchasePriceCents: cents(input.purchasePriceCents, `Purchase price for ${vin}`),
      listPriceCents: cents(input.listPriceCents, `List price for ${vin}`),
      priceCents: cents(input.priceCents, `Price for ${vin}`),
      condition: text(input.condition, 'used', 30),
      description: text(input.description, '', 4000),
      features,
      imagePath: text(input.imagePath, '', 500),
      locationCode: text(input.locationCode, 'FRONTLINE', 80),
      locationLabel: text(input.locationLabel, 'Front line', 200),
    }, {
      actorId: context.session.itemId,
      mode: 'onboarding-ready',
      allowExistingVehicle: true,
    }),
    { timeout: 30_000 }
  )
  return { id: intake.vehicleId, name, reused: !intake.vehicleCreated }
}

async function ensureServicePackage(input: SeedObject, context: any): Promise<EnsureResult> {
  const rooftopId = await activeRooftopId(input, context)
  const name = required(input.name, 'Service name')
  const existing = await context.db.ServicePackage.findMany({
    where: { name: { equals: name }, rooftop: { id: { equals: rooftopId } } },
    take: 1,
  })
  if (existing[0]) return { id: existing[0].id, name, reused: true }
  const description = text(input.description, '', 2000)
  const estimatedDuration = Number(input.estimatedDuration || 0)
  if (!Number.isInteger(estimatedDuration) || estimatedDuration < 0) throw new Error(`Invalid duration for ${name}`)
  const service = await context.db.ServicePackage.createOne({
    data: {
      rooftop: { connect: { id: rooftopId } },
      name,
      description,
      priceCents: cents(input.priceCents, `Price for ${name}`),
      estimatedDuration,
      includedServices: [{ service: name, description }],
    },
  })
  return { id: service.id, name, reused: false }
}

async function ensurePart(input: SeedObject, context: any): Promise<EnsureResult> {
  const rooftopId = await activeRooftopId(input, context)
  const partNumber = required(input.partNumber, 'Part number', 100).toUpperCase()
  const config = {
    rooftopId,
    partNumber,
    description: required(input.description, `Description for ${partNumber}`),
    binLocation: text(input.binLocation, '', 100),
    minimumQuantity: Number(input.minimumQuantity || 0),
    costCents: cents(input.costCents, `Cost for ${partNumber}`),
    priceCents: cents(input.priceCents, `Price for ${partNumber}`),
    supplier: text(input.supplier, '', 200),
  }
  const part = await configurePart(null, { data: { ...config, idempotencyKey: setupKey(rooftopId, 'part', partNumber, config) } }, context)
  const quantity = Number(input.quantity || 0)
  if (!Number.isInteger(quantity) || quantity < 0) throw new Error(`Opening quantity for ${partNumber} is invalid`)
  if (quantity > 0) {
    await recordPartsMovement(null, {
      data: {
        partId: part.id,
        movementType: 'receipt',
        quantity,
        reference: 'Opening stock',
        reason: 'Onboarding',
        idempotencyKey: `onboarding:${rooftopId}:part-opening-stock:${partNumber}`,
      },
    }, context)
  }
  return { id: part.id, name: partNumber, reused: false }
}

async function ensureFinanceProduct(input: SeedObject, context: any): Promise<EnsureResult> {
  const rooftopId = await activeRooftopId(input, context)
  const code = required(input.code, 'Product code', 80).toUpperCase()
  const config = {
    rooftopId,
    code,
    name: required(input.name, `Name for ${code}`),
    category: required(input.category, `Category for ${code}`, 50),
    providerKey: text(input.providerKey, 'operator-recorded', 80),
    retailPriceCents: cents(input.retailPriceCents, `Retail price for ${code}`),
    costCents: cents(input.costCents, `Cost for ${code}`),
    active: input.active !== false,
  }
  const product = await configureFinanceProduct(null, { data: { ...config, idempotencyKey: setupKey(rooftopId, 'finance-product', code, config) } }, context)
  return { id: product.id, name: config.name, reused: false }
}

async function ensureLeadRoutingRule(input: SeedObject, context: any): Promise<EnsureResult> {
  const rooftopId = await activeRooftopId(input, context)
  const config = {
    rooftopId,
    name: required(input.name, 'Rule name'),
    source: text(input.source, 'any', 40),
    assigneeId: String(context.session.itemId),
    priority: Number(input.priority ?? 100),
    firstResponseMinutes: Number(input.firstResponseMinutes ?? 30),
    active: input.active !== false,
  }
  const rule = await configureLeadRoutingRule(null, {
    data: { ...config, idempotencyKey: setupKey(rooftopId, 'lead-route', config.source, config) },
  }, context)
  return { id: rule.id, name: config.name, reused: Boolean(rule.reused) }
}

async function ensureAccountingMapping(input: SeedObject, context: any): Promise<EnsureResult> {
  const rooftopId = await activeRooftopId(input, context)
  const config = {
    rooftopId,
    sourceType: required(input.sourceType, 'Source type', 30),
    sourceCode: required(input.sourceCode, 'Source code', 80),
    debitAccount: required(input.debitAccount, 'Debit account', 100),
    creditAccount: required(input.creditAccount, 'Credit account', 100),
    providerKey: text(input.providerKey, 'operator-recorded', 80),
  }
  const mapping = await configureAccountingMapping(null, {
    data: { ...config, idempotencyKey: setupKey(rooftopId, 'accounting', `${config.sourceType}-${config.sourceCode}`, config) },
  }, context)
  return { id: mapping.id, name: `${config.sourceType}:${config.sourceCode}`, reused: false }
}

async function ensurePaymentProvider(input: SeedObject, context: any): Promise<EnsureResult> {
  const name = required(input.name, 'Payment provider name')
  const code = required(input.code, `Code for ${name}`, 100)
  if (!/^pp_[A-Za-z0-9_-]+$/.test(code)) throw new Error(`Invalid payment provider code for ${name}`)
  const functions = Object.fromEntries(PAYMENT_FUNCTION_FIELDS.map(field => {
    const adapter = text(input[field], '', 50)
    if (!PAYMENT_ADAPTERS.has(adapter)) throw new Error(`${name} must use a registered payment adapter`)
    return [field, adapter]
  }))
  // Insert-only: an installed provider's credentials and status are never changed here.
  const sudo = context.sudo()
  const existing = await sudo.db.PaymentProvider.findMany({ where: { code: { equals: code } }, take: 1 })
  if (existing[0]) return { id: existing[0].id, name, reused: true }
  const provider = await sudo.db.PaymentProvider.createOne({
    data: { name, code, isInstalled: input.isInstalled !== false, ...functions },
  })
  return { id: provider.id, name, reused: false }
}

async function ensureRole(input: SeedObject, context: any): Promise<EnsureResult> {
  if (!permissions.canManageRoles({ session: context.session })) throw new Error('Role management permission is required')
  const name = required(input.role, 'Role name')
  const code = text(input.code, name.toLowerCase().replace(/[^a-z0-9]+/g, '-'), 100)
  const granted: Record<string, boolean> = rolePermissions(code)
  const data = {
    name,
    canAccessDashboard: true,
    canViewInventory: true,
    ...Object.fromEntries(ROLE_PERMISSION_KEYS.map(key => [key, granted[key] === true])),
  }
  const sudo = context.sudo()
  const existing = await sudo.db.Role.findMany({ where: { name: { equals: name } }, take: 1 })
  if (existing[0]) {
    await sudo.db.Role.updateOne({ where: { id: existing[0].id }, data })
    return { id: existing[0].id, name, reused: true }
  }
  const role = await sudo.db.Role.createOne({ data })
  return { id: role.id, name, reused: false }
}

const HANDLERS: Record<Entity, (input: SeedObject, context: any) => Promise<EnsureResult>> = {
  Dealership: ensureDealership,
  Make: ensureMake,
  Model: ensureModel,
  Vehicle: ensureVehicle,
  ServicePackage: ensureServicePackage,
  Part: ensurePart,
  FinanceProduct: ensureFinanceProduct,
  LeadRoutingRule: ensureLeadRoutingRule,
  AccountingMapping: ensureAccountingMapping,
  PaymentProvider: ensurePaymentProvider,
  Role: ensureRole,
}

export async function ensureDealershipOnboardingRecord(
  _root: unknown,
  { entity, data }: { entity: string; data: SeedObject },
  context: any
) {
  if (!isSignedIn({ session: context.session }) || !permissions.canManageOnboarding({ session: context.session })) {
    throw new Error('Not authorized to set up the dealership')
  }
  if (!ENTITIES.includes(entity as Entity)) throw new Error('Unsupported setup record')
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Invalid setup record')
  return HANDLERS[entity as Entity](data, context)
}
