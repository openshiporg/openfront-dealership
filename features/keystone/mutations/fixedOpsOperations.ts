import { commandDate } from '../lifecycle/commandDate'
import { currentServiceOrderAuthority, lockServiceOrder } from '../lifecycle/serviceOrderAuthority'
import { stableJson } from '../lifecycle/domainEvents'
import { permissions } from '../access'
import { recordDomainEventInTransaction } from '../lifecycle/domainEvents'
import { assertSessionRooftopPermission, assertUserRooftopAccess } from '../tenantRecords'
const req=(v:any,n:string,max=1000)=>{const s=String(v||'').trim();if(!s||s.length>max)throw new Error(`${n} is required`);return s},key=(v:any)=>req(v,'Idempotency key',200)
async function order(context:any,id:any){if(!context.session?.itemId||!permissions.canManageService({session:context.session}))throw new Error('Service management permission is required');const value=await context.query.ServiceOrder.findOne({where:{id:String(id||'')},query:'id status updatedAt rooftop { id } appointment { id lead { id } }'});if(!value?.rooftop?.id)throw new Error('Service order not found or accessible');await assertSessionRooftopPermission(context,value.rooftop.id,'canManageService');return value}
async function event(context:any,e:any,write:(tx:any,reused:boolean)=>Promise<any>){return context.transaction(async(tx:any)=>{await tx.prisma.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${e.eventKey},0))`;const r=await recordDomainEventInTransaction(tx,e);return write(tx,r.reused)},{timeout:30000})}
export async function recordServiceOrderEvidence(_r:unknown,{data}:any,context:any){const o=await order(context,data.serviceOrderId);if(!['estimate','approved','in-progress'].includes(o.status))throw new Error('Service evidence is locked');const concern=req(data.concern,'Concern'),cause=req(data.cause,'Cause'),correction=req(data.correction,'Correction'),payType=req(data.payType,'Pay type',30),authorizationStatus=req(data.authorizationStatus,'Authorization status',30);if(!['customer','warranty','internal'].includes(payType)||!['pending','authorized','declined'].includes(authorizationStatus))throw new Error('Invalid service evidence');const authorizationEvidence=data.authorizationEvidence||{};if(authorizationStatus!=='pending'&&!req(authorizationEvidence.reference,'Authorization reference',200))throw new Error('Authorization evidence is required');const inspection=Array.isArray(data.inspectionEvidence)?data.inspectionEvidence.slice(0,100):[],declinedWork=Array.isArray(data.declinedWork)?data.declinedWork.slice(0,100):[];const expected=commandDate(data.expectedUpdatedAt);const eventKey=`service-evidence:${key(data.idempotencyKey)}`,evidence={serviceOrderId:o.id,concern,cause,correction,payType,authorizationStatus,authorizationEvidence,inspection,declinedWork,invoiceNumber:String(data.invoiceNumber||'').trim()||null,expectedUpdatedAt:expected.toISOString()};await event(context,{eventKey,rooftopId:o.rooftop.id,aggregateType:'ServiceOrder',aggregateId:o.id,action:'evidence-recorded',topic:'service-order.evidence-recorded',actorId:context.session.itemId,afterSnapshot:evidence,payload:{rooftopId:o.rooftop.id,serviceOrderId:o.id,authorizationStatus}},async(tx,reused)=>{if(reused)return;const changed=await tx.prisma.serviceOrder.updateMany({where:{id:o.id,updatedAt:expected,status:{in:['estimate','approved','in-progress']}},data:{concern,cause,correction,payType,authorizationStatus,authorizationEvidence,inspectionEvidence:inspection,declinedWork,invoiceNumber:String(data.invoiceNumber||'').trim()}});if(changed.count!==1)throw new Error('Service order changed concurrently')});return context.db.ServiceOrder.findOne({ where: {id:o.id} })}
export async function manageLaborOperation(_root: unknown, { data }: any, context: any) {
  const serviceOrderId = req(data.serviceOrderId, 'Service order', 100)
  const action = req(data.action, 'Labor action', 30)
  if (!['create', 'dispatch', 'start', 'pause', 'complete', 'cancel'].includes(action)) throw new Error('Invalid labor action')
  const request: any = { serviceOrderId, action, operationId: action === 'create' ? null : req(data.operationId, 'Labor operation', 100) }
  if (action === 'create') {
    request.operationCode = req(data.operationCode, 'Operation code', 80)
    request.description = req(data.description, 'Description')
    request.soldHours = Number(data.soldHours)
    if (!Number.isFinite(request.soldHours) || request.soldHours < 0) throw new Error('Sold hours are invalid')
  }
  if (action === 'dispatch') request.technicianId = req(data.technicianId, 'Technician', 100)
  if (action === 'complete') {
    request.actualMinutes = Number(data.actualMinutes)
    if (!Number.isInteger(request.actualMinutes) || request.actualMinutes < 0) throw new Error('Actual minutes are required')
  }
  const eventKey = `labor-operation:${key(data.idempotencyKey)}`
  return context.transaction(async (tx: any) => {
    await lockServiceOrder(tx, serviceOrderId)
    const authority = await currentServiceOrderAuthority(tx, context.session, serviceOrderId)
    const scoped = authority.context
    const prior = await tx.prisma.domainAuditEvent.findUnique({ where: { eventKey } })
    if (prior) {
      if (prior.actorId !== context.session.itemId || prior.rooftopId !== authority.rooftopId || prior.afterSnapshot?.version !== 2 || stableJson(prior.afterSnapshot.request) !== stableJson(request)) throw new Error('Labor retry changed or requires legacy receipt reconciliation')
      const receipt = await scoped.db.ServiceLaborOperation.findOne({ where: { id: prior.aggregateId } })
      if (!receipt || receipt.serviceOrderId !== serviceOrderId) throw new Error('Labor receipt is unavailable in current scope')
      return receipt
    }
    const order = await tx.prisma.serviceOrder.findUnique({ where: { id: serviceOrderId } })
    if (!order || order.rooftopId !== authority.rooftopId || !['estimate', 'approved', 'in-progress'].includes(order.status)) throw new Error('Service labor is locked')
    if (['start', 'pause', 'complete'].includes(action) && (!['approved', 'in-progress'].includes(order.status) || order.authorizationStatus !== 'authorized')) throw new Error('Authorized approved repair is required before labor work')
    const existing = request.operationId ? await tx.prisma.serviceLaborOperation.findFirst({ where: { id: request.operationId, serviceOrderId, rooftopId: authority.rooftopId } }) : null
    if (action !== 'create') {
      const allowed: Record<string, string[]> = { open: ['dispatch', 'cancel'], dispatched: ['start', 'cancel'], 'in-progress': ['pause', 'complete'], paused: ['start', 'complete', 'cancel'] }
      if (!existing || !allowed[existing.status]?.includes(action)) throw new Error('Invalid labor transition')
    }
    if (action === 'dispatch') {
      if (!await scoped.query.User.findOne({ where: { id: request.technicianId }, query: 'id' })) throw new Error('Technician not accessible')
      await assertUserRooftopAccess(scoped, request.technicianId, authority.rooftopId)
    }
    const now = new Date()
    const punches = Array.isArray(existing?.timePunches) ? existing.timePunches : []
    const patch: any = action === 'create'
      ? { operationCode: request.operationCode, description: request.description, soldHours: request.soldHours, status: 'open' }
      : action === 'dispatch' ? { technicianId: request.technicianId, status: 'dispatched' }
        : action === 'start' ? { status: 'in-progress', startedAt: existing.startedAt || now, timePunches: [...punches, { type: 'in', at: now.toISOString(), actorId: context.session.itemId }] }
          : action === 'pause' ? { status: 'paused', timePunches: [...punches, { type: 'out', at: now.toISOString(), actorId: context.session.itemId }] }
            : action === 'complete' ? { status: 'completed', completedAt: now, actualMinutes: request.actualMinutes, timePunches: [...punches, { type: 'out', at: now.toISOString(), actorId: context.session.itemId }] }
              : { status: 'cancelled' }
    const saved = existing
      ? await tx.prisma.serviceLaborOperation.update({ where: { id: existing.id }, data: patch })
      : await tx.prisma.serviceLaborOperation.create({ data: { ...patch, rooftopId: authority.rooftopId, serviceOrderId, idempotencyKey: key(data.idempotencyKey) } })
    await recordDomainEventInTransaction(tx, { eventKey, rooftopId: authority.rooftopId, aggregateType: 'ServiceLaborOperation', aggregateId: saved.id, action, topic: 'service-labor.updated', actorId: context.session.itemId,
      afterSnapshot: { version: 2, request, status: saved.status }, payload: { rooftopId: authority.rooftopId, serviceOrderId, operationId: saved.id, status: saved.status } })
    return scoped.db.ServiceLaborOperation.findOne({ where: { id: saved.id } })
  }, { timeout: 30_000 })
}

// Parts commands live in ./partsOperations; re-exported for existing importers (onboarding seed).
export { configurePart, managePartsPurchaseOrder, recordPartsMovement } from './partsOperations'
