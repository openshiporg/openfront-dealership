import type { OperatorActionField } from '../../components/OperatorActionDialog'

export type ServiceTask = {
  kind: 'evidence' | 'labor-line' | 'labor' | 'part' | 'receipt'
  recordId?: string
  expectedUpdatedAt?: string
  operationId?: string
  action?: 'create' | 'dispatch' | 'start' | 'complete'
  idempotencyKey: string
  values: Record<string, string>
}
export type ServiceChoice = { value: string; label: string }
export type ServiceTaskOperation = 'recordServiceOrderEvidence' | 'addServiceOrderLineItem' | 'manageLaborOperation' | 'configurePart' | 'recordPartsMovement'

export function serviceTaskFields(task: ServiceTask, rooftops: ServiceChoice[], staff: ServiceChoice[]): OperatorActionField[] {
  const money = (name: string, label: string): OperatorActionField => ({ name, label, type: 'number', min: 0, max: 21474836.47, step: 0.01 })
  if (task.kind === 'evidence') return [
    { name: 'concern', label: 'Customer concern', type: 'textarea', maxLength: 5000 },
    { name: 'cause', label: 'Cause', type: 'textarea', maxLength: 5000 },
    { name: 'correction', label: 'Correction / repair plan', type: 'textarea', maxLength: 5000 },
    { name: 'payType', label: 'Pay type', type: 'select', options: ['customer', 'warranty', 'internal'].map(value => ({ value, label: value })) },
    { name: 'authorizationStatus', label: 'Authorization status', type: 'select', options: ['pending', 'authorized', 'declined'].map(value => ({ value, label: value })) },
    { name: 'reference', label: 'Authorization reference', required: task.values.authorizationStatus !== 'pending', maxLength: 200 },
    { name: 'invoiceNumber', label: 'Invoice number (optional)', required: false, maxLength: 100 },
  ]
  if (task.kind === 'labor-line') return [{ name: 'description', label: 'Labor description', maxLength: 1000 }, money('amount', 'Labor amount (USD)')]
  if (task.kind === 'labor') {
    if (task.action === 'create') return [{ name: 'operationCode', label: 'Operation code', maxLength: 80 }, { name: 'description', label: 'Labor description', maxLength: 1000 }, { name: 'soldHours', label: 'Sold hours', type: 'number', min: 0, step: 0.01 }]
    if (task.action === 'dispatch') return [{ name: 'technicianId', label: 'Assigned staff', type: 'select', options: staff }]
    if (task.action === 'complete') return [{ name: 'actualMinutes', label: 'Actual labor minutes', type: 'number', min: 0, step: 1 }]
    return []
  }
  if (task.kind === 'part') return [
    { name: 'rooftopId', label: 'Service location', type: 'select', options: rooftops },
    { name: 'partNumber', label: 'Part number', maxLength: 100 }, { name: 'description', label: 'Description', maxLength: 1000 },
    { name: 'binLocation', label: 'Bin location', maxLength: 100 },
    { name: 'minimumQuantity', label: 'Reorder threshold', type: 'number', min: 0, step: 1 },
    money('cost', 'Unit cost (USD)'), money('price', 'Unit price (USD)'),
    { name: 'supplier', label: 'Supplier', maxLength: 200 },
  ]
  return [{ name: 'quantity', label: 'Receipt quantity', type: 'number', min: 1, step: 1 }, { name: 'reference', label: 'Receipt reference', maxLength: 200 }]
}

export function serviceTaskRequest(task: ServiceTask) {
  const value = (key: string) => (task.values[key] || '').trim()
  const required = (key: string, label: string) => { const result = value(key); if (!result) throw new Error(`${label} is required`); return result }
  const number = (key: string, label: string, integer = false) => {
    const result = Number(required(key, label))
    if (!Number.isFinite(result) || result < 0 || (integer && !Number.isSafeInteger(result))) throw new Error(`${label} must be a non-negative ${integer ? 'integer' : 'number'}`)
    return result
  }
  const cents = (key: string, label: string) => {
    const raw = required(key, label)
    if (!/^\d+(?:\.\d{1,2})?$/.test(raw)) throw new Error(`${label} must have at most two decimal places`)
    const result = Math.round(Number(raw) * 100)
    if (!Number.isSafeInteger(result) || result > 2147483647) throw new Error(`${label} is out of range`)
    return result
  }
  let operation: ServiceTaskOperation
  let data: Record<string, unknown> = { idempotencyKey: task.idempotencyKey }
  if (task.kind === 'evidence') {
    operation = 'recordServiceOrderEvidence'
    const status = required('authorizationStatus', 'Authorization status')
    const reference = status === 'pending' ? value('reference') : required('reference', 'Authorization reference')
    data = { ...data, serviceOrderId: task.recordId, expectedUpdatedAt: task.expectedUpdatedAt, concern: required('concern', 'Customer concern'), cause: required('cause', 'Cause'), correction: required('correction', 'Correction'), payType: required('payType', 'Pay type'), authorizationStatus: status, authorizationEvidence: { reference, channel: 'operator-recorded' }, invoiceNumber: value('invoiceNumber'), inspectionEvidence: [], declinedWork: [] }
  } else if (task.kind === 'labor-line') {
    operation = 'addServiceOrderLineItem'
    data = { ...data, serviceOrderId: task.recordId, expectedUpdatedAt: task.expectedUpdatedAt, itemType: 'labor', description: required('description', 'Description'), quantity: 1, unitPriceCents: cents('amount', 'Labor amount') }
  } else if (task.kind === 'labor') {
    operation = 'manageLaborOperation'
    data = { ...data, serviceOrderId: task.recordId, action: task.action, ...(task.operationId ? { operationId: task.operationId } : {}) }
    if (task.action === 'create') Object.assign(data, { operationCode: required('operationCode', 'Operation code'), description: required('description', 'Description'), soldHours: number('soldHours', 'Sold hours') })
    else if (task.action === 'dispatch') data.technicianId = required('technicianId', 'Assigned staff')
    else if (task.action === 'complete') data.actualMinutes = number('actualMinutes', 'Actual minutes', true)
    else if (task.action !== 'start') throw new Error('Unsupported labor action')
  } else if (task.kind === 'part') {
    operation = 'configurePart'
    data = { ...data, rooftopId: required('rooftopId', 'Service location'), partNumber: required('partNumber', 'Part number'), description: required('description', 'Description'), binLocation: required('binLocation', 'Bin location'), minimumQuantity: number('minimumQuantity', 'Reorder threshold', true), costCents: cents('cost', 'Unit cost'), priceCents: cents('price', 'Unit price'), supplier: required('supplier', 'Supplier') }
  } else {
    operation = 'recordPartsMovement'
    const quantity = number('quantity', 'Receipt quantity', true)
    if (!quantity) throw new Error('Receipt quantity must be positive')
    data = { ...data, partId: task.recordId, movementType: 'receipt', quantity, reference: required('reference', 'Receipt reference'), reason: 'Stock receipt' }
  }
  return { operation, data }
}
