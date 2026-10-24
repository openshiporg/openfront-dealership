export type FixedOpsAppointment = {
  id: string
  rooftop: { id: string }
  appointmentDate: string | null
  serviceType: string | null
  status: string | null
  customerVehicleDescription: string | null
  description: string | null
  estimatedDuration: number | null
  mileageIn: number | null
  advisorNotes: string | null
  assignedTech: { id: string; name: string | null } | null
  serviceOrder: { id: string; status: string | null; grandTotalCents: number | null } | null
  lead: { id: string; firstName: string | null; lastName: string | null; email: string | null; phone: string | null } | null
}

export type FixedOpsLineItem = {
  id: string
  itemType: string
  description: string
  partNumber: string | null
  quantity: number
  unitPriceCents: number
  priceCents: number
}

export type FixedOpsOrder = {
  id: string
  rooftop: { id: string; name: string } | null
  payType: string
  authorizationEvidence: { reference?: string }
  status: string | null
  concern: string
  cause: string
  correction: string
  authorizationStatus: string
  invoiceNumber: string | null
  laborOperations: { id: string; operationCode: string; description: string; status: string; technician: { id: string; name: string } | null }[]
  lineItems: FixedOpsLineItem[]
  laborTotalCents: number | null
  partsTotalCents: number | null
  taxCents: number | null
  grandTotalCents: number | null
  completedAt: string | null
  updatedAt: string
  appointment: {
    id: string
    appointmentDate: string | null
    serviceType: string | null
    customerVehicleDescription: string | null
    assignedTech: { name: string | null } | null
  } | null
}

export type FixedOpsPart = {
  id: string
  partNumber: string | null
  description: string | null
  quantity: number | null
  minimumQuantity: number | null
  priceCents: number | null
  supplier: string | null
}

export type FixedOpsWorkspace = {
  serviceRooftops: Array<{ id: string; name: string }>
  appointments: FixedOpsAppointment[]
  orders: FixedOpsOrder[]
  parts: FixedOpsPart[]
}

export type ServicePerson = { id: string; name: string | null }
export type ServiceLead = { id: string; firstName: string | null; lastName: string | null; email: string | null; phone: string | null }

export type ServiceLaborOperationDetail = {
  id: string
  operationCode: string
  description: string
  status: string
  soldHours: number | null
  actualMinutes: number | null
  startedAt: string | null
  completedAt: string | null
  technician: ServicePerson | null
}

export type ServicePaymentRow = {
  id: string
  status: string
  amountCents: number
  capturedCents: number
  refundedCents: number
  providerKey: string
  providerTransactionId: string | null
  createdAt: string | null
}

export type ServiceOrderDetail = {
  id: string
  status: string | null
  updatedAt: string
  createdAt: string | null
  concern: string | null
  cause: string | null
  correction: string | null
  payType: string | null
  authorizationStatus: string | null
  authorizationEvidence: { reference?: string } | null
  invoiceNumber: string | null
  diagnosis: string | null
  laborTotalCents: number | null
  partsTotalCents: number | null
  taxCents: number | null
  grandTotalCents: number | null
  completedAt: string | null
  lockedAt: string | null
  settledAt: string | null
  rooftop: { id: string; name: string } | null
  appointment: {
    id: string
    status: string | null
    appointmentDate: string | null
    serviceType: string | null
    description: string | null
    customerVehicleDescription: string | null
    vehicleVin: string | null
    mileageIn: number | null
    transportationNeed: string | null
    advisorNotes: string | null
    assignedTech: ServicePerson | null
    lead: ServiceLead | null
  } | null
  laborOperations: ServiceLaborOperationDetail[]
  lineItems: FixedOpsLineItem[]
  partsMovements: Array<{ id: string; movementType: string; quantityDelta: number; reference: string; occurredAt: string; part: { id: string; partNumber: string | null; description: string | null } | null }>
  /** null when the viewer cannot read payments. */
  payments: ServicePaymentRow[] | null
}

export type ServiceAppointmentDetail = {
  id: string
  status: string | null
  updatedAt: string
  createdAt: string | null
  appointmentDate: string | null
  serviceType: string | null
  description: string | null
  estimatedDuration: number | null
  customerVehicleDescription: string | null
  vehicleVin: string | null
  mileageIn: number | null
  transportationNeed: string | null
  capacitySlot: string | null
  advisorNotes: string | null
  rooftop: { id: string; name: string } | null
  assignedTech: ServicePerson | null
  lead: ServiceLead | null
  serviceOrder: { id: string; status: string | null; grandTotalCents: number | null; authorizationStatus: string | null } | null
}

export type ServicePartOption = {
  id: string
  partNumber: string | null
  description: string | null
  quantity: number | null
  committedQuantity: number | null
  priceCents: number | null
}
