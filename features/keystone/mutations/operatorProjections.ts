function date(value: any) {
  if (!value) return null
  return value instanceof Date ? value : new Date(value)
}

// Keystone query API serializes DateTime values. Typed extension resolvers must
// return Dates again, without traversing/changing immutable JSON snapshots.
export function operatorDateFields(value: any, fields: readonly string[]) {
  const result = { ...value }
  for (const field of fields) result[field] = date(value[field])
  return result
}

function person(value: any) {
  return value ? { id: value.id, name: value.name ?? (`${value.firstName ?? ''} ${value.lastName ?? ''}`.trim() || null) } : null
}

export function crmLeadResult(value: any) {
  return {
    id: value.id,
    firstName: value.firstName ?? '',
    lastName: value.lastName ?? '',
    email: value.email ?? null,
    phone: value.phone ?? null,
    source: value.source ?? null,
    status: value.status ?? null,
    temperature: value.timeframe ?? null,
    interestedVehicle: value.interestedVehicle ? { id: value.interestedVehicle.id, year: value.interestedVehicle.year, make: value.interestedVehicle.make, model: value.interestedVehicle.model } : null,
    customerId: value.customer?.id ?? null,
    assignedSalesperson: person(value.assignedSalesperson),
    assignedAt: date(value.assignedAt),
    firstResponseDueAt: date(value.firstResponseDueAt),
    firstResponseAt: date(value.firstResponseAt),
    lastContact: date(value.lastContact),
    createdAt: date(value.createdAt),
    updatedAt: date(value.updatedAt),
  }
}

export function deliveryDealResult(value: any) {
  return {
    id: value.id,
    status: value.status ?? null,
    saleDate: date(value.saleDate),
    lockedAt: date(value.lockedAt),
    updatedAt: date(value.updatedAt),
    vehicle: value.vehicle ? {
      id: value.vehicle.id,
      vin: value.vehicle.vin ?? null,
      stockNumber: value.vehicle.stockNumber ?? null,
      year: value.vehicle.year ?? null,
      make: value.vehicle.make ?? null,
      model: value.vehicle.model ?? null,
      status: value.vehicle.status ?? null,
    } : null,
    lead: value.lead ? { id: value.lead.id, firstName: value.lead.firstName ?? '', lastName: value.lead.lastName ?? '' } : null,
    salesperson: person(value.salesperson),
  }
}

export function serviceOrderResult(value: any) {
  return {
    id: value.id,
    rooftop: value.rooftop ? { id: value.rooftop.id, name: value.rooftop.name } : null,
    status: value.status ?? null,
    concern: value.concern ?? '',
    cause: value.cause ?? '',
    correction: value.correction ?? '',
    payType: value.payType ?? 'customer',
    authorizationStatus: value.authorizationStatus ?? 'pending',
    authorizationEvidence: value.authorizationEvidence ?? {},
    inspectionEvidence: value.inspectionEvidence ?? [],
    declinedWork: value.declinedWork ?? [],
    invoiceNumber: value.invoiceNumber ?? null,
    diagnosis: value.diagnosis ?? '',
    workPerformed: value.workPerformed ?? '',
    recommendations: value.recommendations ?? '',
    laborTotalCents: value.laborTotalCents ?? 0,
    partsTotalCents: value.partsTotalCents ?? 0,
    taxCents: value.taxCents ?? 0,
    grandTotalCents: value.grandTotalCents ?? 0,
    completedAt: date(value.completedAt),
    settledAt: date(value.settledAt),
    updatedAt: date(value.updatedAt),
    appointment: value.appointment ? {
      id: value.appointment.id,
      appointmentDate: date(value.appointment.appointmentDate),
      serviceType: value.appointment.serviceType ?? null,
      assignedTech: person(value.appointment.assignedTech),
      vehicleVin: value.appointment.vehicleVin ?? null,
      transportationNeed: value.appointment.transportationNeed ?? 'none',
      capacitySlot: value.appointment.capacitySlot ?? null,
      customerVehicleDescription: value.appointment.customerVehicleDescription ?? '',
      lead: value.appointment.lead ? { id: value.appointment.lead.id, firstName: value.appointment.lead.firstName ?? '', lastName: value.appointment.lead.lastName ?? '' } : null,
    } : null,
    laborOperations: (value.laborOperations ?? []).map((operation: any) => operatorDateFields(operation, ['startedAt', 'completedAt'])),
    lineItems: (value.lineItems ?? []).map((line: any) => ({ id: line.id, itemType: line.itemType, description: line.description, partNumber: line.partNumber, quantity: line.quantity, unitPriceCents: line.unitPriceCents, priceCents: line.priceCents })),
  }
}

export function financeApplicationResult(value: any) {
  return {
    id: value.id,
    reference: value.reference ?? null,
    status: value.status ?? null,
    applicantName: value.applicantName ?? null,
    applicantEmail: value.applicantEmail ?? null,
    applicantPhone: value.applicantPhone ?? null,
    employmentStatus: value.employmentStatus ?? null,
    annualIncomeCents: value.annualIncomeCents ?? null,
    selfReportedCreditTier: value.selfReportedCreditTier ?? null,
    requestedAmountCents: value.requestedAmountCents ?? null,
    plannedMonthlyPaymentCents: value.plannedMonthlyPaymentCents ?? null,
    plannedDownPaymentCents: value.plannedDownPaymentCents ?? null,
    tradeInValueCents: value.tradeInValueCents ?? null,
    aprBasisPoints: value.aprBasisPoints ?? null,
    loanTermMonths: value.loanTermMonths ?? null,
    consentAt: date(value.consentAt),
    submittedAt: date(value.submittedAt),
    updatedAt: date(value.updatedAt),
    vehicle: value.vehicle ? { id: value.vehicle.id, vin: value.vehicle.vin, stockNumber: value.vehicle.stockNumber, year: value.vehicle.year, make: value.vehicle.make, model: value.vehicle.model, priceCents: value.vehicle.priceCents ?? null } : null,
    lead: value.lead ? {
      id: value.lead.id, rooftop: value.rooftop ? { id: value.rooftop.id } : null,
      firstName: value.lead.firstName, lastName: value.lead.lastName, email: value.lead.email, phone: value.lead.phone,
      status: value.lead.status, createdAt: date(value.lead.createdAt),
      interestedVehicle: value.lead.interestedVehicle ? { id: value.lead.interestedVehicle.id, year: value.lead.interestedVehicle.year, make: value.lead.interestedVehicle.make, model: value.lead.interestedVehicle.model, stockNumber: value.lead.interestedVehicle.stockNumber, priceCents: value.lead.interestedVehicle.priceCents } : null,
      tasks: (value.lead.tasks ?? []).map((task: any) => ({ id: task.id, title: task.title, dueDate: date(task.dueDate), completed: task.completed, priority: task.priority })),
    } : null,
    submissions: (value.submissions ?? []).map((submission: any) => ({
      id: submission.id,
      providerKey: submission.providerKey,
      providerMode: submission.responseSummary?.mode ?? 'operator-recorded',
      externalRequestSent: submission.responseSummary?.externalRequestSent === true,
      status: submission.status,
      externalReference: submission.externalReference ?? null,
      queuedAt: date(submission.queuedAt),
      submittedAt: date(submission.submittedAt),
    })),
    decisions: (value.decisions ?? []).map((decision: any) => ({ id: decision.id, providerKey: decision.providerKey, decision: decision.decision, approvedAmountCents: decision.approvedAmountCents ?? null, aprBasisPoints: decision.aprBasisPoints ?? null, termMonths: decision.termMonths ?? null, monthlyPaymentCents: decision.monthlyPaymentCents ?? null, reasonCodes: decision.reasonCodes ?? [], decidedAt: date(decision.decidedAt) })),
  }
}
