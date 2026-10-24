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
