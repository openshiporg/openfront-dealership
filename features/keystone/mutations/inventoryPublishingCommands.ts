import { randomUUID } from 'node:crypto'

import { permissions } from '../access'
import { inventoryCommand } from './inventoryCommandErrors'
import { assertActiveInventory } from './inventoryActiveStatus'
import { commandDate } from '../lifecycle/commandDate'
import { assertMerchandisingContent, assertPublishableInventory, loadInventoryPublication, lockInventoryStock, merchandisingSnapshot } from '../lifecycle/inventoryPublication'
import { resolveInventoryChannel } from '../../integrations/inventory-channel'
import { domainEventRequestHash, recordDomainEventInTransaction, type DomainEventInput } from '../lifecycle/domainEvents'
import { assertMerchandisingTransition } from '../lifecycle/inventoryOperationsLifecycle'
import { assertSessionRooftopPermission } from '../tenantRecords'
import { appendInventoryPriceHistory } from '../lifecycle/inventoryPriceHistory'

function required(value: unknown, label: string, max = 500) {
  const result = String(value || '').trim()
  if (!result || result.length > max) throw new Error(`${label} is required and must be at most ${max} characters`)
  return result
}

function key(value: unknown) {
  const result = String(value || '').trim()
  if (result.length < 8 || result.length > 180) throw new Error('A valid idempotency key is required')
  return result
}

function requireInventory(context: any) {
  if (!context.session?.itemId || !permissions.canManageInventory({ session: context.session })) throw new Error('Inventory management permission is required')
}

async function stockAccess(context: any, id: string) {
  const stock = await context.query.InventoryStock.findOne({ where: { id }, query: 'id stockNumber reconStatus merchandisingStatus feedStatus frontlineAt updatedAt rooftop { id } vehicle { id vin year make model trim description priceCents status images { id imagePath isPrimary } }' })
  if (!stock?.rooftop?.id || !stock.vehicle?.id) throw new Error('Inventory stock not found or not accessible')
  await assertSessionRooftopPermission(context, stock.rooftop.id, 'canManageInventory')
  return stock
}

function nonNegativeInteger(value: unknown, label: string) {
  const result = Number(value)
  if (!Number.isSafeInteger(result) || result < 0 || result > 2_147_483_647) throw new Error(`${label} must be non-negative integer cents/count`)
  return result
}

async function commandResult(context: any, stockId: string, id: string, reused: boolean) {
  const stock = await context.sudo().prisma.inventoryStock.findUnique({ where: { id: stockId }, select: { updatedAt: true, reconStatus: true, merchandisingStatus: true, feedStatus: true } })
  if (!stock) throw new Error('Inventory stock no longer exists')
  return { id, stockId, status: stock.reconStatus, merchandisingStatus: stock.merchandisingStatus, feedStatus: stock.feedStatus, updatedAt: stock.updatedAt, reused }
}

async function updateInventoryMerchandisingDraftCommand(_root: unknown, { data }: any, context: any) {
  requireInventory(context)
  const stock = await stockAccess(context, String(data.stockId || ''))
  assertActiveInventory(stock.vehicle.status)
  const priceCents = nonNegativeInteger(data.priceCents, 'Retail price')
  const listPriceCents = data.listPriceCents == null ? priceCents : nonNegativeInteger(data.listPriceCents, 'List price')
  const mileage = data.mileage == null ? null : nonNegativeInteger(data.mileage, 'Mileage')
  if (priceCents === 0) throw new Error('Retail price must be greater than zero')
  const description = required(data.description, 'Description', 4_000)
  // Photos are managed by the photo commands; a typed primary path is still accepted from older callers.
  const imagePath = String(data.imagePath || '').trim()
  if (imagePath.length > 500) throw new Error('Primary image path must be at most 500 characters')
  const expectedUpdatedAt = commandDate(data.expectedUpdatedAt)
  const reason = required(data.reason, 'Audit reason')
  const eventKey = `inventory-merchandising-draft:${key(data.idempotencyKey)}`
  const evidence = {
    stockId: stock.id,
    vehicleId: stock.vehicle.id,
    priceCents,
    listPriceCents,
    mileage,
    description,
    imagePath,
    expectedUpdatedAt: expectedUpdatedAt.toISOString(),
    reason,
  }
  const reused = await context.transaction(async (tx: any) => {
    await lockInventoryStock(tx, stock.id)
    const event: DomainEventInput = { eventKey, rooftopId: stock.rooftop.id, aggregateType: 'InventoryStock', aggregateId: stock.id, action: 'merchandising-draft-updated', topic: 'inventory-merchandising.draft-updated', actorId: context.session.itemId, afterSnapshot: evidence, payload: { rooftopId: stock.rooftop.id, ...evidence } }
    const recorded = await recordDomainEventInTransaction(tx, event)
    if (recorded.reused) return true
    const current = await loadInventoryPublication(tx, stock.id)
    assertActiveInventory(current.vehicle.status)
    const changed = await tx.prisma.inventoryStock.updateMany({
      where: { id: stock.id, rooftopId: stock.rooftop.id, updatedAt: expectedUpdatedAt },
      data: { merchandisingStatus: 'draft', approvedRevisionHash: '', feedStatus: 'not-published' },
    })
    if (changed.count !== 1) throw new Error('Inventory stock changed concurrently; reload and retry')
    await tx.prisma.inventoryMerchandisingVersion.updateMany({ where: { stockId: stock.id, status: 'submitted' }, data: { status: 'rejected', decisionReason: 'Superseded by edited draft', decidedById: context.session.itemId, decidedAt: new Date() } })
    await tx.prisma.vehicle.update({
      where: { id: stock.vehicle.id },
      data: { priceCents, listPriceCents, mileage, description },
    })
    await appendInventoryPriceHistory(tx, { rooftopId: stock.rooftop.id, vehicleId: stock.vehicle.id, previousPriceCents: current.vehicle.priceCents, newPriceCents: priceCents, actorId: context.session.itemId, changeReason: reason })
    if (imagePath) {
      const primary = await tx.prisma.vehicleImage.findFirst({ where: { vehicleId: stock.vehicle.id, isPrimary: true }, select: { id: true } })
      if (primary) await tx.prisma.vehicleImage.update({ where: { id: primary.id }, data: { rooftopId: stock.rooftop.id, imagePath, caption: `${stock.vehicle.year} ${stock.vehicle.make} ${stock.vehicle.model}`, category: 'exterior', sortOrder: 0 } })
      else await tx.prisma.vehicleImage.create({ data: { rooftopId: stock.rooftop.id, vehicleId: stock.vehicle.id, imagePath, caption: `${stock.vehicle.year} ${stock.vehicle.make} ${stock.vehicle.model}`, category: 'exterior', sortOrder: 0, isPrimary: true } })
    }
    await tx.prisma.inventoryStockEvent.create({ data: { rooftopId: stock.rooftop.id, stockId: stock.id, eventKey, eventType: 'merchandising-draft-updated', reason, evidence, actorId: context.session.itemId } })
    return false
  }, { timeout: 30_000 })
  return commandResult(context, stock.id, stock.id, reused)
}

async function submitInventoryMerchandisingCommand(_root: unknown, { data }: any, context: any) {
  requireInventory(context)
  const stock = await stockAccess(context, String(data.stockId || ''))
  const idempotencyKey = key(data.idempotencyKey)
  const eventKey = `inventory-merchandising-submit:${idempotencyKey}`
  const reason = required(data.reason, 'Audit reason')
  // A replay of an accepted submission still answers; a new one is refused before any work on inactive stock.
  if (!(await context.sudo().prisma.domainAuditEvent.findUnique({ where: { eventKey }, select: { id: true } }))) assertActiveInventory(stock.vehicle.status)
  const command = await context.transaction(async (tx: any) => {
    await lockInventoryStock(tx, stock.id)
    await tx.prisma.$queryRaw`SELECT 1 AS "locked" FROM pg_advisory_xact_lock(hashtextextended(${`command:${eventKey}`}, 0))`
    const replay = await tx.prisma.domainAuditEvent.findUnique({ where: { eventKey }, select: { metadata: true, afterSnapshot: true } })
    if (replay) {
      const eventEvidence = { snapshot: replay.afterSnapshot?.snapshot, reason }
      const versionId = String((replay.metadata as any)?.versionId || '')
      const version = await tx.prisma.inventoryMerchandisingVersion.findUnique({ where: { id: versionId }, select: { version: true } })
      await recordDomainEventInTransaction(tx, { eventKey, rooftopId: stock.rooftop.id, aggregateType: 'InventoryStock', aggregateId: stock.id, action: 'merchandising-submitted', topic: 'inventory-merchandising.submitted', actorId: context.session.itemId, afterSnapshot: eventEvidence, metadata: { versionId, version: version?.version }, payload: { stockId: stock.id, rooftopId: stock.rooftop.id, versionId, version: version?.version } })
      return { id: versionId, reused: true }
    }
    const current = await loadInventoryPublication(tx, stock.id)
    assertActiveInventory(current.vehicle.status)
    if (current.merchandisingStatus === 'submitted') throw new Error('Merchandising review is already pending')
    if (commandDate(current.updatedAt).getTime() !== commandDate(data.expectedUpdatedAt ?? stock.updatedAt).getTime()) throw new Error('Inventory changed concurrently; reload before submitting')
    const snapshot = assertMerchandisingContent(current)
    const eventEvidence = { snapshot, reason }
    const version = (current.merchandisingVersions[0]?.version ?? 0) + 1
    const versionId = randomUUID()
    await tx.prisma.inventoryMerchandisingVersion.create({ data: { id: versionId, rooftopId: stock.rooftop.id, stockId: stock.id, version, versionKey: `${stock.id}:${version}`, status: 'submitted', snapshot, submittedById: context.session.itemId, submittedAt: new Date() } })
    await tx.prisma.inventoryStock.update({ where: { id: stock.id }, data: { merchandisingStatus: 'submitted', approvedRevisionHash: '', feedStatus: 'not-published' } })
    const event: DomainEventInput = { eventKey, rooftopId: stock.rooftop.id, aggregateType: 'InventoryStock', aggregateId: stock.id, action: 'merchandising-submitted', topic: 'inventory-merchandising.submitted', actorId: context.session.itemId, afterSnapshot: eventEvidence, metadata: { versionId, version }, payload: { stockId: stock.id, rooftopId: stock.rooftop.id, versionId, version } }
    await recordDomainEventInTransaction(tx, event)
    await tx.prisma.inventoryStockEvent.create({ data: { rooftopId: stock.rooftop.id, stockId: stock.id, eventKey, eventType: 'merchandising-submitted', reason, evidence: { versionId, version }, actorId: context.session.itemId } })
    return { id: versionId, reused: false }
  }, { timeout: 30_000 })
  return commandResult(context, stock.id, command.id, command.reused)
}

async function decideInventoryMerchandisingCommand(_root: unknown, { data }: any, context: any) {
  requireInventory(context)
  const version = await context.query.InventoryMerchandisingVersion.findOne({ where: { id: String(data.id || '') }, query: 'id version status updatedAt stock { id rooftop { id } vehicle { status } }' })
  if (!version?.stock?.rooftop?.id) throw new Error('Merchandising version not found or not accessible')
  await assertSessionRooftopPermission(context, version.stock.rooftop.id, 'canManageInventory')
  const decision = String(data.decision || '')
  const reason = required(data.reason, 'Decision reason')
  const expectedUpdatedAt = commandDate(data.expectedUpdatedAt)
  const eventKey = `inventory-merchandising-decision:${key(data.idempotencyKey)}`
  const evidence = { stockId: version.stock.id, versionId: version.id, version: version.version, decision, reason, expectedUpdatedAt: expectedUpdatedAt.toISOString() }
  // An approved version whose stock lost its revision hash (rows approved before the hash existed, or
  // seeded without it) is re-approved in place when its snapshot still matches the live content.
  const reapproval = decision === 'approved' && version.status === 'approved'
  const priorEvent = await context.sudo().prisma.domainAuditEvent.findUnique({ where: { eventKey }, select: { id: true } })
  if (!priorEvent && !reapproval) assertMerchandisingTransition(version.status, decision)
  // Rejecting a stale review on a sold unit is clean-up; approving one would put it back on sale.
  if (!priorEvent && decision === 'approved') assertActiveInventory(version.stock.vehicle?.status)
  const reused = await context.transaction(async (tx: any) => {
    await lockInventoryStock(tx, version.stock.id)
    const event: DomainEventInput = { eventKey, rooftopId: version.stock.rooftop.id, aggregateType: 'InventoryStock', aggregateId: version.stock.id, action: reapproval ? 'merchandising-reapproved' : `merchandising-${decision}`, topic: 'inventory-merchandising.decided', actorId: context.session.itemId, afterSnapshot: evidence, payload: { rooftopId: version.stock.rooftop.id, ...evidence } }
    const recorded = await recordDomainEventInTransaction(tx, event)
    if (recorded.reused) return true
    const current = await loadInventoryPublication(tx, version.stock.id)
    if (decision === 'approved') assertActiveInventory(current.vehicle.status)
    const latest = current.merchandisingVersions[0]
    if (reapproval) {
      if (current.merchandisingStatus !== 'approved' || current.approvedRevisionHash !== '' || latest?.id !== version.id || latest.status !== 'approved') throw new Error('This listing is not awaiting re-approval; reload the current revision')
      const snapshot = assertMerchandisingContent(current)
      if (latest.snapshot?.schemaVersion !== 2 || domainEventRequestHash(latest.snapshot) !== domainEventRequestHash(snapshot)) throw new Error('Listing changed since approval; submit it for review again')
      if (commandDate(latest.updatedAt).getTime() !== expectedUpdatedAt.getTime()) throw new Error('Merchandising version changed concurrently; reload and retry')
      const restored = await tx.prisma.inventoryStock.updateMany({
        where: { id: version.stock.id, rooftopId: version.stock.rooftop.id, merchandisingStatus: 'approved', approvedRevisionHash: '' },
        data: { approvedRevisionHash: domainEventRequestHash(merchandisingSnapshot(current)), feedStatus: 'not-published' },
      })
      if (restored.count !== 1) throw new Error('Inventory changed concurrently; reload the current revision')
      await tx.prisma.inventoryStockEvent.create({ data: { rooftopId: version.stock.rooftop.id, stockId: version.stock.id, eventKey, eventType: 'merchandising-reapproved', reason, evidence, actorId: context.session.itemId } })
      return false
    }
    if (current.merchandisingStatus !== 'submitted' || latest?.id !== version.id || latest.status !== 'submitted') throw new Error('This merchandising review was superseded; reload the current revision')
    const snapshot = assertMerchandisingContent(current)
    if (latest.snapshot?.schemaVersion !== 2 || domainEventRequestHash(latest.snapshot) !== domainEventRequestHash(snapshot)) throw new Error('Inventory changed after submission; submit the current revision again')
    const changed = await tx.prisma.inventoryMerchandisingVersion.updateMany({ where: { id: version.id, status: 'submitted', updatedAt: expectedUpdatedAt }, data: { status: decision, decisionReason: reason, decidedById: context.session.itemId, decidedAt: new Date() } })
    if (changed.count !== 1) throw new Error('Merchandising version changed concurrently; reload and retry')
    const changedStock = await tx.prisma.inventoryStock.updateMany({
      where: {
        id: version.stock.id,
        rooftopId: version.stock.rooftop.id,
        merchandisingStatus: 'submitted',
        approvedRevisionHash: '',
      },
      data: {
        merchandisingStatus: decision,
        approvedRevisionHash: decision === 'approved' ? domainEventRequestHash(merchandisingSnapshot(current)) : '',
        feedStatus: 'not-published',
      },
    })
    if (changedStock.count !== 1) throw new Error('Inventory changed concurrently; reload the current revision')
    await tx.prisma.inventoryStockEvent.create({ data: { rooftopId: version.stock.rooftop.id, stockId: version.stock.id, eventKey, eventType: `merchandising-${decision}`, reason, evidence, actorId: context.session.itemId } })
    return false
  }, { timeout: 30_000 })
  return commandResult(context, version.stock.id, version.id, reused)
}

async function recordInventoryFeedRunCommand(_root: unknown, { data }: any, context: any) {
  requireInventory(context)
  const channel = resolveInventoryChannel(data.channelKey)
  const stockIds: string[] = [...new Set<string>((Array.isArray(data.stockIds) ? data.stockIds : []).map((value: unknown) => String(value)))].slice(0, 500)
  if (stockIds.length === 0) throw new Error('At least one inventory stock record is required')
  const stocks = await Promise.all(stockIds.map(id => stockAccess(context, id)))
  const rooftopId = stocks[0].rooftop.id
  if (stocks.some(stock => stock.rooftop.id !== rooftopId)) throw new Error('Feed run inventory must belong to one rooftop')
  const errors: Array<{ stockId: string | null; errorCode: string; message: string; rowReference: string | null }> = (Array.isArray(data.errors) ? data.errors : []).slice(0, 500).map((error: any) => ({
    stockId: error.stockId ? String(error.stockId) : null,
    errorCode: required(error.errorCode, 'Feed error code', 100),
    message: required(error.message, 'Feed error message', 1000),
    rowReference: String(error.rowReference || '').trim().slice(0, 200) || null,
  }))
  const stockIdSet = new Set(stockIds)
  if (errors.some(error => error.stockId && !stockIdSet.has(error.stockId))) throw new Error('Feed errors must reference inventory in the same run')
  const failedStockIds = new Set(errors.flatMap(error => error.stockId ? [error.stockId] : []))
  if (errors.length && failedStockIds.size === 0) stockIds.forEach(id => failedStockIds.add(id))
  const failedCount = failedStockIds.size
  const succeededCount = Math.max(0, stockIds.length - failedCount)
  const status = failedCount === 0 ? 'succeeded' : succeededCount === 0 ? 'failed' : 'partial'
  const eventKey = `inventory-feed-run:${key(data.idempotencyKey)}`
  const priorRun = await context.sudo().prisma.domainAuditEvent.findUnique({ where: { eventKey }, select: { afterSnapshot: true } })
  const startedAt = commandDate(data.startedAt ?? priorRun?.afterSnapshot?.startedAt ?? new Date(), 'startedAt')
  const completedAt = commandDate(data.completedAt ?? priorRun?.afterSnapshot?.completedAt ?? new Date(), 'completedAt')
  if ([startedAt, completedAt].some(date => Number.isNaN(date.getTime())) || completedAt < startedAt) throw new Error('Feed run timestamps are invalid')
  const evidence = {
    channelKey: channel.key, stockIds, status, attemptedCount: stockIds.length, succeededCount, failedCount,
    externalRequestSent: channel.externalRequestSent, startedAt: startedAt.toISOString(), completedAt: completedAt.toISOString(),
    errors: errors.map(error => ({ stockId: error.stockId, errorCode: error.errorCode, rowReference: error.rowReference, messageHash: domainEventRequestHash(error.message) })),
  }
  const command = await context.transaction(async (tx: any) => {
    for (const stockId of [...stockIds].sort()) await lockInventoryStock(tx, stockId)
    await tx.prisma.$queryRaw`SELECT 1 AS "locked" FROM pg_advisory_xact_lock(hashtextextended(${`command:${eventKey}`}, 0))`
    const replay = await tx.prisma.domainAuditEvent.findUnique({ where: { eventKey }, select: { metadata: true } })
    if (replay) {
      const runId = String((replay.metadata as any)?.runId || '')
      await recordDomainEventInTransaction(tx, { eventKey, rooftopId, aggregateType: 'InventoryFeedRun', aggregateId: runId, action: 'recorded', topic: 'inventory-feed.recorded', actorId: context.session.itemId, afterSnapshot: evidence, metadata: { runId }, payload: { rooftopId, runId, ...evidence } })
      return { id: runId, reused: true }
    }
    const revisions = []
    for (const stockId of stockIds) {
      const current = await loadInventoryPublication(tx, stockId)
      if (current.rooftopId !== rooftopId) throw new Error('Inventory rooftop changed')
      if (channel.key === 'public-inventory-feed') revisions.push({ stockId, ...assertPublishableInventory(current) })
    }
    const runId = randomUUID()
    await tx.prisma.inventoryFeedRun.create({ data: { id: runId, rooftopId, runKey: eventKey, channelKey: channel.key, status, attemptedCount: stockIds.length, succeededCount, failedCount, requestSnapshot: { stockIds, revisions }, responseSummary: { mode: channel.mode, externalRequestSent: channel.externalRequestSent }, startedAt, completedAt, recordedById: context.session.itemId } })
    if (errors.length) await tx.prisma.inventoryFeedError.createMany({ data: errors.map(error => ({ rooftopId, runId, stockId: error.stockId, errorCode: error.errorCode, message: error.message, rowReference: error.rowReference, evidence: { source: 'operator-recorded' } })) })
    const failedIds = [...failedStockIds]
    const succeededIds = stockIds.filter(id => !failedStockIds.has(id))
    if (failedIds.length) await tx.prisma.inventoryStock.updateMany({ where: { id: { in: failedIds }, rooftopId }, data: { feedStatus: 'failed' } })
    if (succeededIds.length) await tx.prisma.inventoryStock.updateMany({ where: { id: { in: succeededIds }, rooftopId }, data: { feedStatus: 'succeeded' } })
    await recordDomainEventInTransaction(tx, { eventKey, rooftopId, aggregateType: 'InventoryFeedRun', aggregateId: runId, action: 'recorded', topic: 'inventory-feed.recorded', actorId: context.session.itemId, afterSnapshot: evidence, metadata: { runId }, payload: { rooftopId, runId, ...evidence } })
    return { id: runId, reused: false }
  }, { timeout: 30_000 })
  return { id: command.id, rooftopId, channelKey: channel.key, status, attemptedCount: stockIds.length, succeededCount, failedCount, errorCount: errors.length, completedAt, reused: command.reused }
}

export const updateInventoryMerchandisingDraft = inventoryCommand(updateInventoryMerchandisingDraftCommand)
export const submitInventoryMerchandising = inventoryCommand(submitInventoryMerchandisingCommand)
export const decideInventoryMerchandising = inventoryCommand(decideInventoryMerchandisingCommand)
export const recordInventoryFeedRun = inventoryCommand(recordInventoryFeedRunCommand)
