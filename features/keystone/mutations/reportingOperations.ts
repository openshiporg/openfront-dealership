import { createHash } from 'node:crypto'
import { permissions } from '../access'
import { recordDomainEventInTransaction } from '../lifecycle/domainEvents'
import { assertSessionRooftopPermission } from '../tenantRecords'
import { rooftopPermissionAccessFilter } from '../tenancy'

const required = (value: unknown, name: string, max = 500) => { const text = String(value || '').trim(); if (!text || text.length > max) throw new Error(`${name} is required`); return text }
function canReport(context: any) { if (!context.session?.itemId || !permissions.canViewReports({ session: context.session })) throw new Error('Reporting permission is required') }
function canAdmin(context: any) { canReport(context); if (!permissions.canManageDealerships({ session: context.session })) throw new Error('Dealership administration permission is required') }
async function accessibleRooftops(context: any) {
  const scope = rooftopPermissionAccessFilter(context.session, 'canViewReports')
  if (scope === false) return []
  return context.query.Rooftop.findMany({
    where: scope === true ? {} : scope,
    take: 100,
    query: 'id name',
  })
}
const grouped = (items: any[], key: string) => Object.entries(items.reduce((result: Record<string, number>, item) => { const value = String(item[key] || 'unknown'); result[value] = (result[value] || 0) + 1; return result }, {})).map(([label, count]) => ({ label, count }))

function periodMetric(current: number, previous: number) {
  const direction = current === previous ? 'neutral' : current > previous ? 'up' : 'down'
  const percentChange = previous === 0 ? null : Math.round((current - previous) / previous * 10_000) / 100
  return { current, previous, direction, percentChange }
}

export async function operationalReport(_root: unknown, args: { rooftopId?: string } | undefined, context: any) {
  canReport(context)
  const accessible = await accessibleRooftops(context)
  const rooftops = args?.rooftopId ? accessible.filter((item: any) => item.id === args.rooftopId) : accessible
  if (args?.rooftopId && rooftops.length !== 1) throw new Error('Report rooftop inaccessible')
  const rooftopIds = rooftops.map((item: any) => item.id)
  const where = { rooftopId: { in: rooftopIds } }
  const prisma = context.sudo().prisma
  const reportNow = new Date()
  const currentStart = new Date(reportNow.getTime() - 30 * 86400000)
  const previousStart = new Date(reportNow.getTime() - 60 * 86400000)
  const todayStart = new Date(reportNow); todayStart.setHours(0, 0, 0, 0)
  const tomorrowStart = new Date(todayStart.getTime() + 86400000)
  const [leads, deals, stocks, menus, labor, parts, serviceOrders, todayServiceAppointments, todayTestDrives, accountingExceptions, paymentExceptions, fundingExceptions] = await Promise.all([
    prisma.lead.findMany({ where, select: { status: true, createdAt: true } }),
    prisma.deal.findMany({ where, select: { id: true, status: true, vehiclePriceCents: true, grossCents: true, saleDate: true, createdAt: true, salesperson: { select: { id: true, name: true } }, vehicle: { select: { year: true, make: true, model: true } }, lead: { select: { firstName: true, lastName: true } } } }),
    prisma.inventoryStock.findMany({ where, select: { stockedAt: true, totalCostCents: true, vehicle: { select: { status: true, priceCents: true } } } }),
    prisma.financeMenuVersion.findMany({ where: { ...where, status: 'accepted' }, select: { dealId: true, selectedProductCodes: true } }),
    prisma.serviceLaborOperation.findMany({ where, select: { soldHours: true, actualMinutes: true, status: true } }),
    prisma.partsInventory.findMany({ where, select: { quantity: true, committedQuantity: true, onOrderQuantity: true, minimumQuantity: true, updatedAt: true } }),
    prisma.serviceOrder.findMany({ where, select: { status: true, laborTotalCents: true, grandTotalCents: true, settledAt: true } }),
    prisma.serviceAppointment.count({ where: { ...where, appointmentDate: { gte: todayStart, lt: tomorrowStart }, status: { not: 'cancelled' } } }),
    prisma.testDrive.count({ where: { ...where, scheduledTime: { gte: todayStart, lt: tomorrowStart } } }),
    prisma.accountingBatch.count({ where: { ...where, status: { in: ['failed', 'posting'] } } }),
    prisma.paymentTransaction.count({ where: { ...where, status: { in: ['creating', 'failed'] } } }),
    prisma.financeFundingCase.count({ where: { ...where, status: 'exception' } }),
  ])
  const delivered = deals.filter((item: any) => item.status === 'delivered' && item.saleDate)
  const currentDelivered = delivered.filter((item: any) => new Date(item.saleDate).getTime() >= currentStart.getTime())
  const previousDelivered = delivered.filter((item: any) => { const value = new Date(item.saleDate).getTime(); return value >= previousStart.getTime() && value < currentStart.getTime() })
  const currentLeads = leads.filter((item: any) => new Date(item.createdAt).getTime() >= currentStart.getTime())
  const previousLeads = leads.filter((item: any) => { const value = new Date(item.createdAt).getTime(); return value >= previousStart.getTime() && value < currentStart.getTime() })
  const settledService = serviceOrders.filter((item: any) => item.status === 'paid' && item.settledAt)
  const currentService = settledService.filter((item: any) => new Date(item.settledAt).getTime() >= currentStart.getTime())
  const previousService = settledService.filter((item: any) => { const value = new Date(item.settledAt).getTime(); return value >= previousStart.getTime() && value < currentStart.getTime() })
  const now = reportNow.getTime()
  const availableStocks = stocks.filter((item: any) => item.vehicle?.status === 'available')
  const soldHours = labor.filter((item: any) => item.status === 'completed').reduce((total: number, item: any) => total + Number(item.soldHours || 0), 0)
  const laborRevenue = serviceOrders.reduce((total: number, item: any) => total + Number(item.laborTotalCents || 0), 0)
  const acceptedDealsWithProducts = new Set(menus.filter((menu: any) => Array.isArray(menu.selectedProductCodes) && menu.selectedProductCodes.length > 0).map((menu: any) => menu.dealId))
  const deliveredByMonth = Object.values(delivered.reduce((result: Record<string, { month: string; revenueCents: number; grossCents: number; count: number }>, item: any) => {
    const month = new Date(item.saleDate).toISOString().slice(0, 7)
    result[month] ||= { month, revenueCents: 0, grossCents: 0, count: 0 }
    result[month].revenueCents += Number(item.vehiclePriceCents || 0)
    result[month].grossCents += Number(item.grossCents || 0)
    result[month].count += 1
    return result
  }, {})).sort((left: any, right: any) => left.month.localeCompare(right.month)).slice(-12)
  const topSalespeople = Object.values(delivered.reduce((result: Record<string, { id: string; name: string; deals: number; revenueCents: number; grossCents: number }>, item: any) => {
    const id = String(item.salesperson?.id || 'unassigned')
    result[id] ||= { id, name: item.salesperson?.name || 'Unassigned', deals: 0, revenueCents: 0, grossCents: 0 }
    result[id].deals += 1
    result[id].revenueCents += Number(item.vehiclePriceCents || 0)
    result[id].grossCents += Number(item.grossCents || 0)
    return result
  }, {})).sort((left: any, right: any) => right.grossCents - left.grossCents).slice(0, 5)
  const metrics = {
    rooftopCount: rooftops.length,
    period: { generatedAt: reportNow.toISOString(), currentStart: currentStart.toISOString(), previousStart: previousStart.toISOString(), days: 30 },
    periodComparison: {
      deliveredCount: periodMetric(currentDelivered.length, previousDelivered.length),
      deliveredRevenueCents: periodMetric(currentDelivered.reduce((total: number, item: any) => total + Number(item.vehiclePriceCents || 0), 0), previousDelivered.reduce((total: number, item: any) => total + Number(item.vehiclePriceCents || 0), 0)),
      deliveredGrossCents: periodMetric(currentDelivered.reduce((total: number, item: any) => total + Number(item.grossCents || 0), 0), previousDelivered.reduce((total: number, item: any) => total + Number(item.grossCents || 0), 0)),
      newLeads: periodMetric(currentLeads.length, previousLeads.length),
      settledServiceRevenueCents: periodMetric(currentService.reduce((total: number, item: any) => total + Number(item.grandTotalCents || 0), 0), previousService.reduce((total: number, item: any) => total + Number(item.grandTotalCents || 0), 0)),
    },
    salesFunnel: grouped(leads, 'status'),
    totalLeads: leads.length,
    leadConversionPercent: leads.length ? Math.round(leads.filter((item: any) => item.status === 'closed-won').length / leads.length * 10_000) / 100 : 0,
    pendingDeals: deals.filter((item: any) => ['pencil', 'submitted'].includes(item.status)).length,
    todayAppointments: todayServiceAppointments + todayTestDrives,
    deliveredDeals: delivered.length,
    deliveredRevenueCents: delivered.reduce((total: number, item: any) => total + Number(item.vehiclePriceCents || 0), 0),
    deliveredGrossCents: delivered.reduce((total: number, item: any) => total + Number(item.grossCents || 0), 0),
    averageDeliveredGrossCents: delivered.length ? Math.round(delivered.reduce((total: number, item: any) => total + Number(item.grossCents || 0), 0) / delivered.length) : 0,
    deliveredByMonth,
    topSalespeople,
    recentDeals: [...deals].sort((left: any, right: any) => new Date(right.saleDate || right.createdAt).getTime() - new Date(left.saleDate || left.createdAt).getTime()).slice(0, 5).map((item: any) => ({ id: item.id, status: item.status, vehiclePriceCents: item.vehiclePriceCents, grossCents: item.grossCents, occurredAt: item.saleDate || item.createdAt, vehicle: item.vehicle, lead: item.lead })),
    financeProductPenetrationPercent: delivered.length ? Math.round(acceptedDealsWithProducts.size / delivered.length * 10000) / 100 : 0,
    inventory: { available: availableStocks.length, averageAgeDays: availableStocks.length ? Math.round(availableStocks.reduce((total: number, item: any) => total + Math.max(0, (now - new Date(item.stockedAt).getTime()) / 86400000), 0) / availableStocks.length) : 0, retailCents: availableStocks.reduce((total: number, item: any) => total + Number(item.vehicle?.priceCents || 0), 0), costCents: availableStocks.reduce((total: number, item: any) => total + Number(item.totalCostCents || 0), 0) },
    service: { soldHours, actualHours: Math.round(labor.reduce((total: number, item: any) => total + Number(item.actualMinutes || 0), 0) / 60 * 100) / 100, effectiveLaborRateCents: soldHours ? Math.round(laborRevenue / soldHours) : 0, ordersByStatus: grouped(serviceOrders, 'status') },
    parts: { lowStockCount: parts.filter((item: any) => item.quantity - item.committedQuantity <= Number(item.minimumQuantity || 0)).length, fillRatePercent: parts.reduce((total: number, item: any) => total + item.committedQuantity, 0) ? Math.round(parts.reduce((total: number, item: any) => total + Math.min(item.quantity, item.committedQuantity), 0) / parts.reduce((total: number, item: any) => total + item.committedQuantity, 0) * 10000) / 100 : 100, obsoleteCount: parts.filter((item: any) => item.quantity > 0 && now - new Date(item.updatedAt).getTime() > 180 * 86400000).length },
  }
  return { generatedAt: new Date().toISOString(), metrics, exceptions: { accounting: accountingExceptions, payments: paymentExceptions, funding: fundingExceptions, total: accountingExceptions + paymentExceptions + fundingExceptions } }
}

function nextRun(schedule: string, from = new Date()) { const next = new Date(from); if (schedule === 'daily') next.setUTCDate(next.getUTCDate() + 1); else if (schedule === 'weekly') next.setUTCDate(next.getUTCDate() + 7); else if (schedule === 'monthly') next.setUTCMonth(next.getUTCMonth() + 1); else return null; return next }
export async function saveOperationalReport(_root: unknown, { data }: any, context: any) {
  canReport(context)
  const rooftopId = required(data.rooftopId, 'Rooftop ID', 100), idempotencyKey = required(data.idempotencyKey, 'Idempotency key', 200)
  await assertSessionRooftopPermission(context, rooftopId, 'canViewReports')
  const rooftop = await context.query.Rooftop.findOne({ where: { id: rooftopId }, query: 'id' }); if (!rooftop) throw new Error('Rooftop inaccessible')
  const reportType = required(data.reportType, 'Report type', 50), exportFormat = required(data.exportFormat, 'Export format', 10), schedule = required(data.schedule, 'Schedule', 20), filters = data.filters && typeof data.filters === 'object' && !Array.isArray(data.filters) ? data.filters : {}
  if (Object.keys(filters).length) throw new Error('Saved report filters are not supported yet')
  if (!['operations','audit','accounting-exceptions','payment-reconciliation'].includes(reportType) || !['json','csv'].includes(exportFormat) || !['manual','daily','weekly','monthly'].includes(schedule)) throw new Error('Unsupported report configuration')
  const eventKey = `saved-report:${idempotencyKey}`
  const id = await context.transaction(async (tx: any) => {
    await tx.prisma.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${eventKey}, 0))`
    const existing = await tx.prisma.savedReport.findUnique({ where: { idempotencyKey } })
    await recordDomainEventInTransaction(tx, { eventKey, rooftopId, aggregateType: 'SavedReport', aggregateId: rooftopId, action: 'configured', topic: 'report.saved', actorId: context.session.itemId, afterSnapshot: { name: required(data.name, 'Name', 100), reportType, filters, exportFormat, schedule }, payload: { rooftopId, reportType, schedule } })
    if (existing) return existing.id
    return (await tx.prisma.savedReport.create({ data: { rooftopId, ownerId: context.session.itemId, name: required(data.name, 'Name', 100), reportType, filters, exportFormat, schedule, active: true, nextRunAt: nextRun(schedule), idempotencyKey }, select: { id: true } })).id
  })
  return context.db.SavedReport.findOne({ where: { id } })
}

async function savedReportPayload(saved: any, context: any) {
  const rooftopId = saved.rooftop.id, prisma = context.sudo().prisma
  if (saved.reportType === 'operations') return operationalReport(null, { rooftopId }, context)
  if (saved.reportType === 'audit') return { generatedAt: new Date().toISOString(), events: await prisma.domainAuditEvent.findMany({ where: { rooftopId }, orderBy: { occurredAt: 'desc' }, take: 1000, select: { eventKey: true, aggregateType: true, aggregateId: true, action: true, occurredAt: true, actorId: true } }) }
  if (saved.reportType === 'accounting-exceptions') return { generatedAt: new Date().toISOString(), batches: await prisma.accountingBatch.findMany({ where: { rooftopId, status: { in: ['failed','posting'] } }, orderBy: { updatedAt: 'desc' }, take: 1000, select: { id: true, sourceType: true, sourceId: true, status: true, attemptCount: true, lastErrorCode: true, updatedAt: true } }) }
  if (saved.reportType === 'payment-reconciliation') return { generatedAt: new Date().toISOString(), payments: await prisma.paymentTransaction.findMany({ where: { rooftopId }, orderBy: { updatedAt: 'desc' }, take: 1000, select: { id: true, sourceType: true, amountCents: true, capturedCents: true, refundedCents: true, status: true, providerKey: true, reconciliationReference: true, reconciledAt: true, updatedAt: true } }) }
  throw new Error('Unsupported saved report type')
}

function reportCsv(value: unknown) {
  const rows: Array<[string, string]> = []
  const visit = (current: any, path: string) => {
    if (current === null || current === undefined || typeof current !== 'object') { rows.push([path, String(current ?? '')]); return }
    if (Array.isArray(current)) { current.forEach((item, index) => visit(item, `${path}[${index}]`)); return }
    for (const [key, item] of Object.entries(current)) visit(item, path ? `${path}.${key}` : key)
  }
  visit(value, '')
  const quote = (text: string) => `"${text.replaceAll('"', '""')}"`
  return ['path,value', ...rows.map(([path, value]) => `${quote(path)},${quote(value)}`)].join('\n')
}

export async function runSavedReport(_root: unknown, { data }: any, context: any) {
  canReport(context)
  const reportId = required(data.reportId, 'Report ID', 100), idempotencyKey = required(data.idempotencyKey, 'Idempotency key', 200)
  const saved = await context.query.SavedReport.findOne({ where: { id: reportId }, query: 'id name reportType exportFormat schedule nextRunAt rooftop { id }' })
  if (!saved?.rooftop?.id) throw new Error('Saved report inaccessible')
  await assertSessionRooftopPermission(context, saved.rooftop.id, 'canViewReports')
  const priorRun = await context.sudo().prisma.reportRun.findUnique({ where: { idempotencyKey } })
  if (priorRun) {
    if (priorRun.savedReportId !== saved.id) throw new Error('Report-run idempotency key belongs to another report')
    return context.db.ReportRun.findOne({ where: { id: priorRun.id } })
  }
  const report = await savedReportPayload(saved, context)
  const exportPayload = saved.exportFormat === 'csv' ? { contentType: 'text/csv', content: reportCsv(report) } : report
  const snapshot = { schema: 'openfront.report.v1', reportType: saved.reportType, exportFormat: saved.exportFormat, report: exportPayload }
  const digest = createHash('sha256').update(JSON.stringify(snapshot)).digest('hex')
  const expiresAt = new Date(Date.now() + 30 * 86400000)
  const id = await context.transaction(async (tx: any) => {
    const eventKey = `report-run:${idempotencyKey}`
    await tx.prisma.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${eventKey}, 0))`
    const existing = await tx.prisma.reportRun.findUnique({ where: { idempotencyKey } })
    await recordDomainEventInTransaction(tx, { eventKey, rooftopId: saved.rooftop.id, aggregateType: 'ReportRun', aggregateId: saved.id, action: 'completed', topic: 'report.completed', actorId: context.session.itemId, afterSnapshot: { reportId: saved.id, digest, exportFormat: saved.exportFormat, expiresAt }, payload: { rooftopId: saved.rooftop.id, reportId: saved.id, digest } })
    if (existing) return existing.id
    const run = await tx.prisma.reportRun.create({ data: { rooftopId: saved.rooftop.id, savedReportId: saved.id, status: 'completed', exportFormat: saved.exportFormat, resultSnapshot: snapshot, resultDigest: digest, completedAt: new Date(), expiresAt, idempotencyKey }, select: { id: true } })
    if (saved.schedule !== 'manual') await tx.prisma.savedReport.update({ where: { id: saved.id }, data: { nextRunAt: nextRun(saved.schedule) } })
    return run.id
  })
  return context.db.ReportRun.findOne({ where: { id } })
}

export async function queueDueSavedReports(_root: unknown, _args: unknown, context: any) {
  canAdmin(context)
  const rooftops = await accessibleRooftops(context), rooftopIds = rooftops.map((item: any) => item.id), now = new Date()
  const due = await context.sudo().prisma.savedReport.findMany({ where: { rooftopId: { in: rooftopIds }, active: true, schedule: { not: 'manual' }, nextRunAt: { lte: now } }, take: 100 })
  const queuedIds: string[] = []
  for (const saved of due) {
    await assertSessionRooftopPermission(context, saved.rooftopId, 'canManageDealerships')
    await assertSessionRooftopPermission(context, saved.rooftopId, 'canViewReports')
    const scheduledFor = saved.nextRunAt || now, idempotencyKey = `scheduled:${saved.id}:${scheduledFor.toISOString()}`
    const runId = await context.transaction(async (tx: any) => {
      await tx.prisma.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${idempotencyKey}, 0))`
      const existing = await tx.prisma.reportRun.findUnique({ where: { idempotencyKey } })
      await recordDomainEventInTransaction(tx, { eventKey: `report-scheduled:${idempotencyKey}`, rooftopId: saved.rooftopId, aggregateType: 'ReportRun', aggregateId: saved.id, action: 'queued', topic: 'report.run-requested', actorId: context.session.itemId, afterSnapshot: { reportId: saved.id, scheduledFor, exportFormat: saved.exportFormat }, payload: { rooftopId: saved.rooftopId, reportId: saved.id, scheduledFor } })
      if (existing) return existing.id
      const run = await tx.prisma.reportRun.create({ data: { rooftopId: saved.rooftopId, savedReportId: saved.id, status: 'queued', exportFormat: saved.exportFormat, idempotencyKey }, select: { id: true } })
      await tx.prisma.savedReport.update({ where: { id: saved.id }, data: { nextRunAt: nextRun(saved.schedule, scheduledFor) } })
      return run.id
    })
    queuedIds.push(runId)
  }
  return { queuedCount: queuedIds.length, runIds: queuedIds }
}

export async function auditSearch(_root: unknown, { aggregateType, aggregateId, action, limit = 50 }: any, context: any) {
  canReport(context)
  const rooftops = await accessibleRooftops(context), rooftopIds = rooftops.map((item: any) => item.id)
  return context.sudo().prisma.domainAuditEvent.findMany({ where: { rooftopId: { in: rooftopIds }, ...(aggregateType ? { aggregateType: String(aggregateType) } : {}), ...(aggregateId ? { aggregateId: String(aggregateId) } : {}), ...(action ? { action: { contains: String(action), mode: 'insensitive' } } : {}) }, orderBy: { occurredAt: 'desc' }, take: Math.min(Math.max(Number(limit) || 50, 1), 100) })
}
