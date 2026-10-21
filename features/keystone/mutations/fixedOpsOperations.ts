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

export async function configurePart(_r:unknown,{data}:any,context:any){if(!context.session?.itemId||!permissions.canManageService({session:context.session}))throw new Error('Service permission required');const rooftopId=String(data.rooftopId||'');await assertSessionRooftopPermission(context,rooftopId,'canManageService');const rooftop=await context.query.Rooftop.findOne({where:{id:rooftopId},query:'id'});if(!rooftop)throw new Error('Rooftop inaccessible');const partNumber=req(data.partNumber,'Part number',100).toUpperCase(),description=req(data.description,'Description'),priceCents=Number(data.priceCents),costCents=Number(data.costCents||0);if(!Number.isInteger(priceCents)||priceCents<0||!Number.isInteger(costCents)||costCents<0)throw new Error('Part money is invalid');const eventKey=`part-config:${key(data.idempotencyKey)}`,evidence={rooftopId:rooftop.id,partNumber,description,binLocation:String(data.binLocation||'').trim(),minimumQuantity:Number(data.minimumQuantity||0),priceCents,costCents,supplier:String(data.supplier||'').trim()};const id=await event(context,{eventKey,rooftopId:rooftop.id,aggregateType:'PartsInventory',aggregateId:`${rooftop.id}:${partNumber}`,action:'configured',topic:'parts.configured',actorId:context.session.itemId,afterSnapshot:evidence,payload:evidence},async(tx,reused)=>{const found=await tx.prisma.partsInventory.findFirst({where:{rooftopId:rooftop.id,partNumber}});if(reused){if(!found)throw new Error('Part replay missing');return found.id}const values={...evidence,quantity:found?.quantity||0,committedQuantity:found?.committedQuantity||0,onOrderQuantity:found?.onOrderQuantity||0};return found?(await tx.prisma.partsInventory.update({where:{id:found.id},data:values,select:{id:true}})).id:(await tx.prisma.partsInventory.create({data:values,select:{id:true}})).id});return context.db.PartsInventory.findOne({ where: {id} })}
export async function recordPartsMovement(_r: unknown, { data }: any, context: any) {
  if (!context.session?.itemId || !permissions.canManageService({ session: context.session })) {
    throw new Error('Service permission required')
  }
  const part = await context.query.PartsInventory.findOne({
    where: { id: String(data.partId || '') },
    query: 'id partNumber quantity committedQuantity onOrderQuantity rooftop { id }',
  })
  if (!part?.rooftop?.id) throw new Error('Part inaccessible')
  await assertSessionRooftopPermission(context, part.rooftop.id, 'canManageService')

  const type = req(data.movementType, 'Movement type', 30)
  const quantity = Number(data.quantity)
  const movementTypes = ['receipt', 'issue', 'return', 'adjustment', 'count', 'commit', 'release', 'po-order', 'po-cancel']
  if (!movementTypes.includes(type) || !Number.isInteger(quantity) || quantity <= 0) {
    throw new Error('Invalid parts movement')
  }
  const serviceOrderId = String(data.serviceOrderId || '').trim() || null
  const serviceLinkedTypes = new Set(['issue', 'return', 'commit', 'release'])
  if (serviceLinkedTypes.has(type) && !serviceOrderId) {
    throw new Error('A service order is required for this parts movement')
  }
  if (serviceOrderId) {
    const serviceOrder = await context.query.ServiceOrder.findOne({
      where: { id: serviceOrderId },
      query: 'id status rooftop { id }',
    })
    if (
      !serviceOrder ||
      serviceOrder.rooftop?.id !== part.rooftop.id ||
      !['estimate', 'approved', 'in-progress'].includes(serviceOrder.status)
    ) {
      throw new Error('Service order not found, inaccessible, or unavailable for parts movement')
    }
  }

  let onHand = Number(part.quantity || 0)
  let committed = Number(part.committedQuantity || 0)
  let onOrder = Number(part.onOrderQuantity || 0)
  let delta = 0
  if (type === 'receipt') {
    onHand += quantity
    onOrder = Math.max(0, onOrder - quantity)
    delta = quantity
  } else if (type === 'issue') {
    onHand -= quantity
    committed = Math.max(0, committed - quantity)
    delta = -quantity
  } else if (type === 'return') {
    onHand += quantity
    delta = quantity
  } else if (type === 'adjustment') {
    delta = Number(data.quantityDelta)
    if (!Number.isInteger(delta)) throw new Error('Adjustment delta required')
    onHand += delta
  } else if (type === 'count') {
    delta = quantity - onHand
    onHand = quantity
  } else if (type === 'commit') committed += quantity
  else if (type === 'release') committed -= quantity
  else if (type === 'po-order') onOrder += quantity
  else if (type === 'po-cancel') onOrder -= quantity
  if (onHand < 0 || committed < 0 || onOrder < 0 || committed > onHand) {
    throw new Error('Parts movement would violate available inventory')
  }

  const idempotencyKey = key(data.idempotencyKey)
  const eventKey = `parts-movement:${idempotencyKey}`
  const reference = req(data.reference, 'Reference', 200)
  const reason = req(data.reason, 'Reason')
  const evidence = {
    partId: part.id,
    partNumber: part.partNumber,
    movementType: type,
    quantity,
    quantityDelta: delta,
    onHandAfter: onHand,
    committedAfter: committed,
    onOrderAfter: onOrder,
    reference,
    reason,
    serviceOrderId,
  }
  const id = await event(context, {
    eventKey,
    rooftopId: part.rooftop.id,
    aggregateType: 'PartsMovement',
    aggregateId: part.id,
    action: type,
    topic: 'parts.moved',
    actorId: context.session.itemId,
    afterSnapshot: evidence,
    payload: { rooftopId: part.rooftop.id, partId: part.id, movementType: type, serviceOrderId },
  }, async (tx, reused) => {
    if (reused) {
      const found = await tx.prisma.partsMovement.findUnique({ where: { idempotencyKey } })
      if (!found) throw new Error('Movement replay missing')
      return found.id
    }
    if (serviceOrderId) {
      const scopedOrder = await tx.prisma.serviceOrder.findFirst({
        where: {
          id: serviceOrderId,
          rooftopId: part.rooftop.id,
          status: { in: ['estimate', 'approved', 'in-progress'] },
        },
        select: { id: true },
      })
      if (!scopedOrder) throw new Error('Service order changed or is outside the parts rooftop')
    }
    const changed = await tx.prisma.partsInventory.updateMany({
      where: {
        id: part.id,
        quantity: part.quantity,
        committedQuantity: part.committedQuantity,
        onOrderQuantity: part.onOrderQuantity,
      },
      data: { quantity: onHand, committedQuantity: committed, onOrderQuantity: onOrder },
    })
    if (changed.count !== 1) throw new Error('Part inventory changed concurrently')
    const movement = await tx.prisma.partsMovement.create({
      data: {
        rooftopId: part.rooftop.id,
        partId: part.id,
        serviceOrderId,
        movementType: type,
        quantityDelta: delta,
        onHandAfter: onHand,
        committedAfter: committed,
        onOrderAfter: onOrder,
        reference,
        reason,
        evidence,
        occurredAt: new Date(),
        idempotencyKey,
      },
      select: { id: true },
    })
    return movement.id
  })
  return context.db.PartsMovement.findOne({ where: { id } })
}
export async function managePartsPurchaseOrder(_r:unknown,{data}:any,context:any){if(!context.session?.itemId||!permissions.canManageService({session:context.session}))throw new Error('Service permission required');const action=req(data.action,'PO action',30);if(!['create','order','receive','cancel'].includes(action))throw new Error('Invalid purchase-order action');const existing=data.purchaseOrderId?await context.query.PartsPurchaseOrder.findOne({where:{id:String(data.purchaseOrderId)},query:'id reference supplier status lines orderedAt receivedAt rooftop { id }'}):null;const rooftopId=existing?.rooftop?.id||String(data.rooftopId||'');await assertSessionRooftopPermission(context,rooftopId,'canManageService');let reference=existing?.reference||'',supplier=existing?.supplier||'',status=existing?.status||'draft',lines:any[]=Array.isArray(existing?.lines)?existing.lines:[],orderedAt:null|Date=existing?.orderedAt?new Date(existing.orderedAt):null,receivedAt:null|Date=existing?.receivedAt?new Date(existing.receivedAt):null;if(action==='create'){await assertSessionRooftopPermission(context,rooftopId,'canManageService');const roof=await context.query.Rooftop.findOne({where:{id:rooftopId},query:'id'});if(!roof)throw new Error('Rooftop inaccessible');reference=req(data.reference,'PO reference',100);supplier=req(data.supplier,'Supplier',200);if(!Array.isArray(data.lines)||!data.lines.length)throw new Error('PO lines required');lines=data.lines.map((x:any)=>({partId:req(x.partId,'Part ID',100),quantity:Number(x.quantity),unitCostCents:Number(x.unitCostCents)}));if(lines.some(x=>!Number.isInteger(x.quantity)||x.quantity<=0||!Number.isInteger(x.unitCostCents)||x.unitCostCents<0))throw new Error('Invalid PO line')}else{if(!existing)throw new Error('Purchase order not found');if(action==='order'&&existing.status==='draft'){status='ordered';orderedAt=new Date()}else if(action==='receive'&&['ordered','partially-received'].includes(existing.status)){status='received';receivedAt=new Date()}else if(action==='cancel'&&['draft','ordered'].includes(existing.status))status='cancelled';else throw new Error('Invalid purchase-order transition')}const eventKey=`parts-po:${key(data.idempotencyKey)}`,evidence={purchaseOrderId:existing?.id||null,reference,supplier,action,status,lines};const id=await event(context,{eventKey,rooftopId,aggregateType:'PartsPurchaseOrder',aggregateId:existing?.id||reference,action,topic:'parts-purchase-order.updated',actorId:context.session.itemId,afterSnapshot:evidence,payload:{rooftopId,status,reference}},async(tx,reused)=>{if(reused){const f=existing||await tx.prisma.partsPurchaseOrder.findUnique({where:{idempotencyKey:key(data.idempotencyKey)}});if(!f)throw new Error('PO replay missing');return f.id}const values={reference,supplier,status,lines,orderedAt,receivedAt};return existing?(await tx.prisma.partsPurchaseOrder.update({where:{id:existing.id},data:values,select:{id:true}})).id:(await tx.prisma.partsPurchaseOrder.create({data:{...values,rooftopId,idempotencyKey:key(data.idempotencyKey)},select:{id:true}})).id});return context.db.PartsPurchaseOrder.findOne({ where: {id} })}
