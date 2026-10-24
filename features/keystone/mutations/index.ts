import { mergeSchemas } from "@graphql-tools/schema";
import type { GraphQLSchema } from 'graphql';
import redirectToInit from "./redirectToInit";
import { registerCustomerAccount, customerRequestHistory } from './customerAccount';
import updateActiveUser from "./updateActiveUser";
import { submitInquiry } from './submitInquiry';
import { submitTestDrive } from './submitTestDrive';
import { submitTradeIn } from './submitTradeIn';
import { submitFinancing } from './submitFinancing';
import { submitServiceBooking } from './submitServiceBooking';
import { publicSubmissionResolver } from './publicSubmissionResolver';
import { storefrontProfile } from './storefrontProfile';
import { transitionDeal } from './transitionDeal';
import { transitionServiceOrder } from './transitionServiceOrder';
import { ensureDealershipOnboardingRecord } from './ensureDealershipOnboardingRecord';
import { queueFinancingApplication } from './queueFinancingApplication';
import { recordLenderDecision } from './recordLenderDecision';
import { changeDealerMembership } from './changeDealerMembership';
import { startInventoryAcquisition } from './startInventoryAcquisition';
import { transitionInventoryAcquisition } from './transitionInventoryAcquisition';
import { createDealPencil } from './createDealPencil';
import { openServiceOrder } from './openServiceOrder';
import {
  completeTask,
  createLeadTask,
  recordLeadInteraction,
  recordTradeInAppraisal,
  transitionLead,
  transitionServiceAppointment,
  updateTestDriveWorkflow,
} from './operatorWorkflows';
import { domainTimeline } from './domainTimeline';
import { inventoryWorkspace } from './inventoryWorkspace';
import {
  openInventoryReconWorkItem,
  establishInventoryStock,
  moveInventoryStock,
  recordInventoryCost,
  transitionInventoryReconWorkItem,
} from './inventoryStockCommands';
import {
  decideInventoryMerchandising,
  recordInventoryFeedRun,
  submitInventoryMerchandising,
  updateInventoryMerchandisingDraft,
} from './inventoryPublishingCommands';
import { addInventoryVehiclePhoto, arrangeInventoryVehiclePhotos, removeInventoryVehiclePhoto } from './inventoryPhotoCommands';
import { crmWorkspace, dealDeskWorkspace, dealWorkspace, deliveryWorkspace, financeWorkspace, fixedOpsWorkspace } from './operatorWorkspaces';
import { acceptDealWorksheet, addServiceOrderLineItem, completeDealDelivery, openFinanceFollowUp, presentDealWorksheet, reopenDealWorksheet, saveDealWorksheet, selectDealLenderOffer, transferLeadOwnership } from './operatorCommands';
import { configureLeadRoutingRule, customerDuplicateCandidates, mergeCustomers, routeLead } from './crmIdentityWorkflows';
import { advanceLeadCadence, enrollLeadCadence, linkCustomerHousehold, manageSalesVisit, updateCustomerCommunicationPreferences } from './crmEngagementWorkflows';
import { dealLenderOffers } from './dealLenderOffers';
import { configureAccountingMapping, manageAccountingBatch, stageAccountingBatch } from './accountingOperations';
import { accountingWorkspace } from './accountingWorkspace';
import { createPaymentCheckout, reconcilePaymentTransaction, requestPaymentRefund } from './paymentOperations';
import handlePaymentProviderWebhook from './handlePaymentProviderWebhook';
import { auditSearch, operationalReport, queueDueSavedReports, runSavedReport, saveOperationalReport } from './reportingOperations';
import { configurePart, manageLaborOperation, managePartsPurchaseOrder, recordPartsMovement, recordServiceOrderEvidence } from './fixedOpsOperations';
import { reviewFinancePrerequisites } from './financePrerequisiteReview';
import { operatorCommand } from './operatorCommandErrors';
import { manageDeliveryCase, manageWeOweItem } from './deliveryOperations';
import { keystoneItemResult } from './keystoneItemResult';
import { configureFinanceProduct, decideFinanceMenu, manageFinanceContractPackage, manageFinanceFundingCase, presentFinanceMenu, recordFinanceComplianceCheck, recordFinanceProductCancellation, recordFinanceProductQuote } from './financeOperations';
import { intakeInventoryVehicle } from './intakeInventoryVehicle';
import { publicInventoryCount, publicInventoryVehicle, publicInventoryVehicles } from '../integrations/inventory/publicStorefrontInventory';;

const graphql = String.raw;

export function extendGraphqlSchema(baseSchema: GraphQLSchema) {
  return mergeSchemas({
    schemas: [baseSchema],
    typeDefs: graphql`
      input UserUpdateProfileInput {
        onboardingStatus: String
      }

      type ActiveUserProfile {
        id: ID!
        onboardingStatus: String
      }

      type PublicSubmissionVehicle {
        id: ID!
        vin: String
        stockNumber: String
        year: Int
        make: String
        model: String
        price: Float
        status: String
      }

      type PublicInventoryStoredImage { url: String }
      type PublicInventoryImage {
        id: ID!
        imagePath: String
        image: PublicInventoryStoredImage
        isPrimary: Boolean!
        sortOrder: Int!
      }
      type PublicInventoryVehicle {
        id: ID!
        vin: String
        stockNumber: String
        year: Int
        make: String
        model: String
        trim: String
        exteriorColor: String
        mileage: Int
        price: Float
        status: String
        condition: String
        description: String
        features: JSON
        images: [PublicInventoryImage!]!
      }
      type PublicInventoryResult { items: [PublicInventoryVehicle!]!, totalCount: Int! }

      input SubmitInquiryInput {
        firstName: String!
        lastName: String!
        email: String!
        phone: String
        preferredContact: String!
        intent: String!
        message: String
        vehicleId: ID
        rooftopSlug: String
        idempotencyKey: String!
        website: String
      }

      type SubmitInquiryPayload {
        ok: Boolean!
        errorCode: String
        errorMessage: String
        leadId: ID
        intent: String
        intentLabel: String
        preferredContact: String
        selectedVehicle: PublicSubmissionVehicle
        reused: Boolean
      }

      input SubmitTestDriveInput {
        customerName: String!
        customerEmail: String!
        customerPhone: String!
        preferredDate: String!
        preferredTime: String!
        vehicleId: ID
        message: String
        rooftopSlug: String
        idempotencyKey: String!
        website: String
      }

      type SubmitTestDrivePayload {
        ok: Boolean!
        errorCode: String
        errorMessage: String
        testDriveId: ID
        leadId: ID
        scheduledTime: DateTime
        vehicle: PublicSubmissionVehicle
        reused: Boolean
      }

      input SubmitTradeInInput {
        firstName: String!
        lastName: String!
        email: String!
        phone: String!
        year: Int!
        make: String!
        model: String!
        trim: String
        vin: String
        mileage: Int!
        condition: String!
        ownership: String!
        payoffAmount: Float
        interestedVehicleId: ID
        rooftopSlug: String
        idempotencyKey: String!
        website: String
      }

      type SubmitTradeInPayload {
        ok: Boolean!
        errorCode: String
        errorMessage: String
        tradeInId: ID
        leadId: ID
        estimatedMin: Float
        estimatedMax: Float
        estimateMode: String
        providerRequestSent: Boolean
        vehicle: PublicSubmissionVehicle
        reused: Boolean
      }

      input SubmitFinancingInput {
        fullName: String!
        email: String!
        phone: String!
        employmentStatus: String!
        annualIncome: Float!
        creditTier: String!
        requestedAmount: Float
        monthlyPayment: Float
        downPayment: Float
        tradeInValue: Float
        apr: Float
        loanTerm: Int
        vehicleId: ID
        consent: Boolean!
        privacyAcknowledged: Boolean
        rooftopSlug: String
        idempotencyKey: String!
        website: String
      }

      type SubmitFinancingPayload {
        ok: Boolean!
        errorCode: String
        errorMessage: String
        applicationId: ID
        applicationReference: String
        leadId: ID
        taskId: ID
        followUpDueAt: DateTime
        vehicle: PublicSubmissionVehicle
        applicationStatus: String
        providerMode: String
        providerRequestSent: Boolean
        reused: Boolean
      }

      input SubmitServiceBookingInput {
        customerName: String!
        customerEmail: String!
        customerPhone: String!
        appointmentDate: String!
        appointmentTime: String!
        serviceType: String!
        vehicleYear: Int!
        vehicleMake: String!
        vehicleModel: String!
        vehicleVin: String
        description: String
        rooftopSlug: String
        idempotencyKey: String!
        website: String
      }

      type SubmitServiceBookingPayload {
        ok: Boolean!
        errorCode: String
        errorMessage: String
        serviceAppointmentId: ID
        leadId: ID
        appointmentDate: DateTime
        serviceType: String
        status: String
        requestedServiceLabel: String
        reused: Boolean
      }

      type LeadInteractionResult {
        id: ID!
        leadId: ID!
      }

      input CreateLeadTaskInput {
        leadId: ID!
        title: String!
        description: String
        priority: String = "medium"
        dueDate: DateTime
        assignedToId: ID
        communicationChannel: String = "internal"
        idempotencyKey: String!
      }

      input RecordLeadInteractionInput {
        leadId: ID!
        interactionType: String!
        outcome: String
        notes: String!
        date: DateTime
        followUpDate: DateTime
        idempotencyKey: String!
      }

      input TestDriveWorkflowInput {
        id: ID!
        action: String!
        interestedLevel: String
        feedback: String
        idempotencyKey: String!
      }

      input RecordTradeInAppraisalInput {
        id: ID!
        referenceValueCents: Int!
        offerAmountCents: Int!
        idempotencyKey: String!
      }

      input CreateDealPencilInput {
        rooftopId: ID!
        vehicleId: ID!
        leadId: ID
        salespersonId: ID
        tradeInId: ID
        vehiclePriceCents: Int!
        tradeInValueCents: Int
        downPaymentCents: Int
        idempotencyKey: String!
      }

      input OpenServiceOrderInput {
        appointmentId: ID!
        diagnosis: String
        laborTotalCents: Int
        partsTotalCents: Int
        taxCents: Int
        grandTotalCents: Int
        idempotencyKey: String!
      }

      input StartInventoryAcquisitionInput {
        rooftopId: ID!
        idempotencyKey: String!
        reason: String!
        acquisitionSource: String!
        sourceReference: String
        vin: String!
        year: Int!
        make: String!
        model: String!
        odometer: Int
        appraisalCents: Int!
        reconEstimateCents: Int
        vehicleId: ID
      }

      input ChangeDealerMembershipInput {
        scopeType: String!
        scopeId: ID!
        targetUserId: ID!
        roleId: ID!
        status: String!
        accessAllRooftops: Boolean = false
        reason: String!
        expectedUpdatedAt: DateTime
      }

      type DealerMembershipChangePayload {
        id: ID!
        scopeType: String!
        scopeId: ID!
        status: String!
        accessAllRooftops: Boolean!
        roleId: ID!
        updatedAt: DateTime!
      }

      input RecordLenderDecisionInput {
        applicationId: ID!
        submissionId: ID
        providerKey: String!
        idempotencyKey: String!
        externalReference: String
        decision: String!
        approvedAmountCents: Int
        aprBasisPoints: Int
        termMonths: Int
        monthlyPaymentCents: Int
        reasonCodes: [String!]
      }


      type OperatorPersonResult { id: ID!, name: String }
      type OperatorPageInfo { limit: Int!, offset: Int!, hasMore: Boolean! }
      type CRMLeadResult { id: ID!, customerId: ID, firstName: String!, lastName: String!, email: String, phone: String, source: String, status: String, temperature: String, interestedVehicle: DealVehicleResult, assignedSalesperson: OperatorPersonResult, assignedAt: DateTime, firstResponseDueAt: DateTime, firstResponseAt: DateTime, lastContact: DateTime, createdAt: DateTime, updatedAt: DateTime }
      type CRMWorkspaceSummary { visibleCount: Int!, newCount: Int!, overdueCount: Int! }
      type CRMWorkspaceResult { leads: [CRMLeadResult!]!, summary: CRMWorkspaceSummary!, pageInfo: OperatorPageInfo! }
      type CustomerDuplicateCandidate { id: ID!, firstName: String!, lastName: String!, primaryEmail: String, primaryPhone: String, status: String!, createdAt: DateTime!, updatedAt: DateTime!, leadsCount: Int! }
      type CustomerMergeResult { id: ID!, duplicateId: ID!, movedLeadCount: Int!, movedSalesVisitCount: Int!, reused: Boolean! }
      input MergeCustomersInput { survivorId: ID!, duplicateId: ID!, survivorExpectedUpdatedAt: DateTime!, duplicateExpectedUpdatedAt: DateTime!, reason: String!, idempotencyKey: String! }
      input ConfigureLeadRoutingRuleInput { rooftopId: ID!, name: String!, source: String = "any", assigneeId: ID!, priority: Int = 100, firstResponseMinutes: Int = 30, active: Boolean = true, idempotencyKey: String! }
      input RouteLeadInput { leadId: ID!, expectedUpdatedAt: DateTime!, idempotencyKey: String! }
      input UpdateCustomerCommunicationPreferencesInput { customerId: ID!, expectedUpdatedAt: DateTime!, emailConsent: Boolean!, smsConsent: Boolean!, phoneConsent: Boolean!, emailSuppressed: Boolean!, smsSuppressed: Boolean!, phoneSuppressed: Boolean!, preferredChannel: String!, source: String!, reason: String!, idempotencyKey: String! }
      input EnrollLeadCadenceInput { leadId: ID!, expectedUpdatedAt: DateTime!, cadenceKey: String!, campaignKey: String!, idempotencyKey: String! }
      input AdvanceLeadCadenceInput { leadId: ID!, expectedUpdatedAt: DateTime!, idempotencyKey: String! }
      input LinkCustomerHouseholdInput { primaryCustomerId: ID!, memberCustomerId: ID!, primaryExpectedUpdatedAt: DateTime!, memberExpectedUpdatedAt: DateTime!, displayName: String!, idempotencyKey: String! }
      input ManageSalesVisitInput { action: String!, visitId: ID, leadId: ID, kind: String, vehicleId: ID, managerId: ID, scheduledAt: DateTime, expectedUpdatedAt: DateTime, outcome: String, notes: String, idempotencyKey: String! }
      type DealVehicleResult { id: ID!, vin: String, stockNumber: String, year: Int, make: String, model: String, trim: String, exteriorColor: String, status: String, priceCents: Int }
      type DealLeadResult { id: ID!, firstName: String!, lastName: String!, status: String }
      type DealApprovalResult { id: ID!, decision: String, notes: String, approvalDate: DateTime, approver: OperatorPersonResult }
      type DealWorkspaceRecord { id: ID!, financeEvidence: JSON, status: String, structureType: String, worksheetVersion: Int, vehiclePriceCents: Int, tradeInValueCents: Int, downPaymentCents: Int, financingAmountCents: Int, monthlyPaymentCents: Int, taxAmountCents: Int, totalPriceCents: Int!, loanTerm: Int, apr: Float, residualValueCents: Int, moneyFactorBasisPoints: Int, grossCents: Int, fees: JSON, rebates: JSON, products: JSON, taxLines: JSON, presentedSnapshot: JSON, presentedAt: DateTime, acceptedSnapshot: JSON, acceptedAt: DateTime, evidenceSnapshot: JSON, lockedAt: DateTime, saleDate: DateTime, createdAt: DateTime!, updatedAt: DateTime!, vehicle: DealVehicleResult, lead: DealLeadResult, salesperson: OperatorPersonResult, approvals: [DealApprovalResult!]! }
      type DealWorksheetVersionResult { id: ID!, snapshot: JSON, occurredAt: DateTime!, actor: OperatorPersonResult }
      type DealWorkspaceResult { deal: DealWorkspaceRecord!, worksheetVersions: [DealWorksheetVersionResult!]! }
      type DealDeskRecord { id: ID!, status: String, vehiclePriceCents: Int, totalPriceCents: Int!, saleDate: DateTime, createdAt: DateTime!, updatedAt: DateTime!, vehicle: DealVehicleResult, lead: DealLeadResult, salesperson: OperatorPersonResult }
      type DealDeskSummary { visibleCount: Int!, pendingCount: Int!, deliveredCount: Int!, totalRevenueCents: Int! }
      type DealDeskWorkspaceResult { deals: [DealDeskRecord!]!, summary: DealDeskSummary!, pageInfo: OperatorPageInfo! }
      type FinanceSubmissionResult { id: ID!, providerKey: String!, providerMode: String!, externalRequestSent: Boolean!, status: String!, externalReference: String, queuedAt: DateTime!, submittedAt: DateTime }
      type FinanceDecisionResult { id: ID!, providerKey: String!, decision: String!, approvedAmountCents: Int, aprBasisPoints: Int, termMonths: Int, monthlyPaymentCents: Int, reasonCodes: JSON, decidedAt: DateTime! }
      type FinanceTaskResult { id: ID!, title: String, dueDate: DateTime, completed: Boolean, priority: String }
      type FinanceLeadResult { id: ID!, rooftop: InventoryRooftopResult, firstName: String, lastName: String, email: String, phone: String, status: String, createdAt: DateTime, interestedVehicle: DealVehicleResult, tasks: [FinanceTaskResult!]! }
      type FinanceApplicationResult { id: ID!, reference: String, status: String, applicantName: String, applicantEmail: String, applicantPhone: String, employmentStatus: String, annualIncomeCents: Int, selfReportedCreditTier: String, requestedAmountCents: Int, plannedMonthlyPaymentCents: Int, plannedDownPaymentCents: Int, tradeInValueCents: Int, aprBasisPoints: Int, loanTermMonths: Int, consentAt: DateTime, submittedAt: DateTime, updatedAt: DateTime, vehicle: DealVehicleResult, lead: FinanceLeadResult, submissions: [FinanceSubmissionResult!]!, decisions: [FinanceDecisionResult!]! }
      type FinanceDealLeadResult { id: ID!, firstName: String, lastName: String }
      type FinanceDealVehicleResult { id: ID!, year: Int, make: String, model: String, stockNumber: String, vin: String, purchasePrice: Float }
      type FinanceDealApprovalResult { id: ID!, decision: String, approvalDate: DateTime, notes: String, approver: OperatorPersonResult }
      type FinanceDealResult { id: ID!, worksheetVersion: Int, financeEvidence: JSON, rooftop: InventoryRooftopResult, vehiclePrice: Float, tradeInValue: Float, downPayment: Float, financingAmount: Float, monthlyPayment: Float, loanTerm: Int, apr: Float, taxAmount: Float, status: String, totalPrice: Float, profit: Float, createdAt: DateTime, updatedAt: DateTime, salesperson: OperatorPersonResult, lead: FinanceDealLeadResult, vehicle: FinanceDealVehicleResult, approvals: [FinanceDealApprovalResult!]! }
      type FinanceWorkspaceSummary { visibleCount: Int!, submittedCount: Int!, reviewCount: Int!, approvedCount: Int! }
      type FinanceProductResult { id: ID!, rooftop: InventoryRooftopResult!, code: String!, name: String!, category: String!, providerKey: String!, active: Boolean!, retailPriceCents: Int!, costCents: Int, updatedAt: DateTime! }
      type FinanceProductQuoteResult { id: ID!, deal: FinanceDealResult, product: FinanceProductResult, providerKey: String!, status: String!, retailPriceCents: Int, evidenceReference: String, requestedAt: DateTime!, completedAt: DateTime }
      type FinanceProductCancellationResult { id: ID!, deal: FinanceDealResult, menu: FinanceMenuResult, productCode: String!, status: String!, reason: String!, refundCents: Int, requestedAt: DateTime!, completedAt: DateTime }
      type FinanceMenuResult { id: ID!, deal: FinanceDealResult, version: Int!, status: String!, optionsSnapshot: JSON, selectedProductCodes: JSON, declinedProductCodes: JSON, disclosureAcknowledgment: String, presentedAt: DateTime!, decidedAt: DateTime }
      type FinanceComplianceResult { id: ID!, deal: FinanceDealResult, checkType: String!, providerKey: String!, status: String!, resultCode: String, requestedAt: DateTime!, completedAt: DateTime }
      type FinanceContractResult { id: ID!, deal: FinanceDealResult, status: String!, providerKey: String!, envelopeReference: String, requiredDocuments: JSON, documentChecklist: JSON, sentAt: DateTime, signedAt: DateTime, lastWebhookAt: DateTime, updatedAt: DateTime! }
      type FinanceFundingResult { id: ID!, immutableEvidence: JSON, deal: FinanceDealResult, status: String!, checklist: JSON, exceptions: JSON, fundingReference: String, fundedAt: DateTime, updatedAt: DateTime! }
      type FinanceWorkspaceResult { applications: [FinanceApplicationResult!]!, deals: [FinanceDealResult!]!, products: [FinanceProductResult!]!, productQuotes: [FinanceProductQuoteResult!]!, productCancellations: [FinanceProductCancellationResult!]!, menus: [FinanceMenuResult!]!, complianceChecks: [FinanceComplianceResult!]!, contractPackages: [FinanceContractResult!]!, fundingCases: [FinanceFundingResult!]!, summary: FinanceWorkspaceSummary!, pageInfo: OperatorPageInfo! }
      type DeliveryDealResult { id: ID!, financeEvidence: JSON, status: String, saleDate: DateTime, lockedAt: DateTime, updatedAt: DateTime, vehicle: DealVehicleResult, lead: DealLeadResult, salesperson: OperatorPersonResult }
      type DeliveryCaseResult { id: ID!, deliverySnapshot: JSON, deal: DeliveryDealResult, status: String!, appointmentAt: DateTime, arrivedAt: DateTime, checklist: JSON, customerAcknowledgment: String, acknowledgedAt: DateTime, updatedAt: DateTime!, weOweItems: [WeOweResult!]! }
      type WeOweResult { id: ID!, description: String!, status: String!, promisedAt: DateTime!, owner: OperatorPersonResult, estimatedCostCents: Int, fulfillmentEvidence: String, customerAcknowledgment: String, fulfilledAt: DateTime, updatedAt: DateTime! }
      type DeliveryWorkspaceSummary { readyCount: Int!, deliveredCount: Int! }
      type DeliveryWorkspaceResult { deliveries: [DeliveryDealResult!]!, cases: [DeliveryCaseResult!]!, summary: DeliveryWorkspaceSummary!, pageInfo: OperatorPageInfo! }
      type FixedOpsLineResult { id: ID!, itemType: String!, description: String!, partNumber: String, quantity: Float!, unitPriceCents: Int!, priceCents: Int! }
      type FixedOpsLeadResult { id: ID!, firstName: String!, lastName: String!, email: String, phone: String }
      type FixedOpsAppointmentOrderResult { id: ID!, status: String, grandTotalCents: Int }
      type FixedOpsAppointmentResult { id: ID!, appointmentDate: DateTime, serviceType: String, status: String, vehicleVin: String, transportationNeed: String, capacitySlot: String, customerVehicleDescription: String, description: String, estimatedDuration: Int, mileageIn: Int, advisorNotes: String, rooftop: InventoryRooftopResult, lead: FixedOpsLeadResult, assignedTech: OperatorPersonResult, serviceOrder: FixedOpsAppointmentOrderResult }
      type FixedOpsLaborResult { id: ID!, operationCode: String!, description: String!, status: String!, technician: OperatorPersonResult, soldHours: Float, actualMinutes: Int, timePunches: JSON, startedAt: DateTime, completedAt: DateTime }
      type FixedOpsOrderResult { id: ID!, rooftop: InventoryRooftopResult, status: String, concern: String!, cause: String!, correction: String!, payType: String!, authorizationStatus: String!, authorizationEvidence: JSON, inspectionEvidence: JSON, declinedWork: JSON, invoiceNumber: String, diagnosis: String!, workPerformed: String!, recommendations: String!, laborTotalCents: Int!, partsTotalCents: Int!, taxCents: Int!, grandTotalCents: Int!, completedAt: DateTime, settledAt: DateTime, updatedAt: DateTime, appointment: FixedOpsAppointmentResult, laborOperations: [FixedOpsLaborResult!]!, lineItems: [FixedOpsLineResult!]! }
      type FixedOpsWorkspaceSummary { openOrderCount: Int!, awaitingOrderCount: Int! }
      type FixedOpsPartResult { id: ID!, partNumber: String, description: String, binLocation: String, quantity: Int, committedQuantity: Int, onOrderQuantity: Int, minimumQuantity: Int, priceCents: Int, supplier: String }
      type PartsMovementResult { id: ID!, part: FixedOpsPartResult, serviceOrder: FixedOpsOrderResult, movementType: String!, quantityDelta: Int!, onHandAfter: Int!, committedAfter: Int!, onOrderAfter: Int!, reference: String!, reason: String!, occurredAt: DateTime! }
      type PartsPurchaseOrderResult { id: ID!, reference: String!, supplier: String!, status: String!, lines: JSON, orderedAt: DateTime, receivedAt: DateTime, updatedAt: DateTime! }
      type FixedOpsWorkspaceResult { serviceRooftops: [InventoryRooftopResult!]!, orders: [FixedOpsOrderResult!]!, appointments: [FixedOpsAppointmentResult!]!, parts: [FixedOpsPartResult!]!, partsMovements: [PartsMovementResult!]!, purchaseOrders: [PartsPurchaseOrderResult!]!, summary: FixedOpsWorkspaceSummary!, pageInfo: OperatorPageInfo! }
      type OperatorCommandResult { id: ID!, status: String, updatedAt: DateTime!, reused: Boolean! }
      type DealLenderOfferResult { id: ID!, providerKey: String!, decision: String!, approvedAmountCents: Int, aprBasisPoints: Int, termMonths: Int, monthlyPaymentCents: Int, reasonCodes: JSON, decidedAt: DateTime!, selected: Boolean! }

      input TransferLeadOwnershipInput { leadId: ID!, assignedToId: ID!, expectedUpdatedAt: DateTime!, reason: String!, idempotencyKey: String! }
      input SaveDealWorksheetInput { dealId: ID!, structureType: String, vehiclePriceCents: Int!, tradeInValueCents: Int, downPaymentCents: Int, monthlyPaymentCents: Int, loanTerm: Int, apr: Float, residualValueCents: Int, moneyFactorBasisPoints: Int, fees: JSON, rebates: JSON, products: JSON, taxLines: JSON, expectedUpdatedAt: DateTime!, reason: String!, idempotencyKey: String! }
      input PresentDealWorksheetInput { dealId: ID!, expectedUpdatedAt: DateTime!, idempotencyKey: String! }
      input AcceptDealWorksheetInput { dealId: ID!, expectedUpdatedAt: DateTime!, acknowledgment: String!, idempotencyKey: String! }
      input SelectDealLenderOfferInput { dealId: ID!, lenderDecisionId: ID!, expectedUpdatedAt: DateTime!, idempotencyKey: String! }
      input ReopenDealWorksheetInput { dealId: ID!, expectedUpdatedAt: DateTime!, reason: String!, idempotencyKey: String! }
      input CompleteDealDeliveryInput { dealId: ID!, expectedFundingUpdatedAt: DateTime!, expectedDeliveryCaseUpdatedAt: DateTime!, identityVerified: Boolean, insuranceVerified: Boolean, fundingVerified: Boolean, vehicleReleased: Boolean, notes: String, expectedUpdatedAt: DateTime!, idempotencyKey: String! }
      input ManageDeliveryCaseInput { dealId: ID!, action: String!, appointmentAt: DateTime, checklist: JSON, customerAcknowledgment: String, idempotencyKey: String! }
      input ManageWeOweItemInput { dealId: ID!, itemId: ID, action: String!, description: String, promisedAt: DateTime, ownerId: ID, estimatedCostCents: Int, fulfillmentEvidence: String, customerAcknowledgment: String, idempotencyKey: String! }
      input RecordServiceOrderEvidenceInput { serviceOrderId: ID!, concern: String!, cause: String!, correction: String!, payType: String!, authorizationStatus: String!, authorizationEvidence: JSON!, inspectionEvidence: JSON!, declinedWork: JSON!, invoiceNumber: String, expectedUpdatedAt: DateTime!, idempotencyKey: String! }
      input ManageLaborOperationInput { serviceOrderId: ID!, operationId: ID, action: String!, operationCode: String, description: String, soldHours: Float, technicianId: ID, actualMinutes: Int, idempotencyKey: String! }
      input ConfigurePartInput { rooftopId: ID!, partNumber: String!, description: String!, binLocation: String, minimumQuantity: Int, costCents: Int!, priceCents: Int!, supplier: String, idempotencyKey: String! }
      input RecordPartsMovementInput { partId: ID!, serviceOrderId: ID, movementType: String!, quantity: Int!, quantityDelta: Int, reference: String!, reason: String!, idempotencyKey: String! }
      input ManagePartsPurchaseOrderInput { purchaseOrderId: ID, rooftopId: ID, action: String!, reference: String, supplier: String, lines: JSON, idempotencyKey: String! }
      input ConfigureAccountingMappingInput { rooftopId: ID!, sourceType: String!, sourceCode: String!, debitAccount: String!, creditAccount: String!, providerKey: String!, idempotencyKey: String! }
      input StageAccountingBatchInput { sourceType: String!, sourceId: ID!, providerKey: String!, idempotencyKey: String! }
      input ManageAccountingBatchInput { batchId: ID!, action: String!, externalReference: String, errorCode: String, reconciliationReference: String, idempotencyKey: String! }
      type WebhookResult {
        success: Boolean!
        message: String
        statusCode: Int
        error: String
      }
      input CreatePaymentCheckoutInput { sourceType: String!, sourceId: ID!, amountCents: Int!, providerKey: String!, idempotencyKey: String! }
      input RequestPaymentRefundInput { transactionId: ID!, amountCents: Int!, reason: String!, idempotencyKey: String! }
      input ReconcilePaymentInput { transactionId: ID!, reconciliationReference: String!, idempotencyKey: String! }
      input SaveOperationalReportInput { rooftopId: ID!, name: String!, reportType: String!, filters: JSON, exportFormat: String!, schedule: String!, idempotencyKey: String! }
      input RunSavedReportInput { reportId: ID!, idempotencyKey: String! }
      input AddServiceOrderLineInput { serviceOrderId: ID!, itemType: String!, description: String!, partNumber: String, quantity: Float!, unitPriceCents: Int!, costCents: Int, expectedUpdatedAt: DateTime!, idempotencyKey: String! }
      input OpenFinanceFollowUpInput { leadId: ID!, reason: String!, idempotencyKey: String! }
      input ConfigureFinanceProductInput { rooftopId: ID!, code: String!, name: String!, category: String!, providerKey: String!, retailPriceCents: Int!, costCents: Int!, active: Boolean, idempotencyKey: String! }
      input RecordFinanceProductQuoteInput { dealId: ID!, productId: ID!, status: String!, retailPriceCents: Int, costCents: Int, evidenceReference: String, idempotencyKey: String! }
      input PresentFinanceMenuInput { dealId: ID!, expectedUpdatedAt: DateTime!, productCodes: JSON!, idempotencyKey: String! }
      input DecideFinanceMenuInput { dealId: ID!, expectedUpdatedAt: DateTime!, menuId: ID!, selectedProductCodes: JSON!, declinedProductCodes: JSON!, disclosureAcknowledgment: String!, idempotencyKey: String! }
      input RecordFinanceComplianceInput { dealId: ID!, expectedUpdatedAt: DateTime!, checkType: String!, providerKey: String!, status: String!, resultCode: String, evidenceReference: String, idempotencyKey: String! }
      input ManageFinanceContractInput { dealId: ID!, expectedUpdatedAt: DateTime!, action: String!, providerKey: String, requiredDocuments: JSON, documentChecklist: JSON, providerStatus: String, envelopeReference: String, evidenceSource: String, evidenceReference: String, webhookEventId: String, idempotencyKey: String! }
      input ReviewFinancePrerequisitesInput { dealId: ID!, worksheetVersion: Int!, expectedUpdatedAt: DateTime!, expectedPrerequisiteDigest: String!, providerKey: String!, reviewReference: String!, policyReference: String!, policyVersion: String!, reviewerAuthorityReference: String!, idempotencyKey: String! }
      input ManageFinanceFundingInput { dealId: ID!, worksheetVersion: Int!, expectedUpdatedAt: DateTime!, expectedFundingUpdatedAt: DateTime, status: String!, checklist: JSON!, exceptions: JSON!, fundingReference: String, paymentAmountCents: Int, idempotencyKey: String! }
      input RecordFinanceProductCancellationInput { dealId: ID!, menuId: ID!, productCode: String!, status: String!, reason: String!, refundCents: Int, evidenceReference: String, idempotencyKey: String! }

      type AccountingWorkspaceResult { mappings: [AccountingMapping!]!, batches: [AccountingBatch!]!, payments: [PaymentTransaction!]!, refunds: [PaymentRefund!]! }
      type OperationalReportResult { generatedAt: String!, metrics: JSON!, exceptions: JSON! }
      type ScheduledReportDispatchResult { queuedCount: Int!, runIds: [ID!]! }
      type InventoryRooftopResult { id: ID!, name: String! }
      type InventoryVehicleResult { id: ID!, vin: String!, stockNumber: String!, year: Int, make: String!, model: String!, trim: String, exteriorColor: String, interiorColor: String, condition: String, mileage: Int, status: String, priceCents: Int, description: String, primaryImagePath: String, images: [InventoryVehicleImageResult!]! }
      type InventoryVehicleImageResult { id: ID!, url: String, isPrimary: Boolean!, sortOrder: Int!, uploaded: Boolean! }
      type InventoryPublicListingResult { live: Boolean!, reason: String, action: String }
      type InventoryCostSummary { purchaseCostCents: Int!, reconCostCents: Int!, otherCostCents: Int!, totalCostCents: Int! }
      type InventoryReconWorkResult { id: ID!, title: String!, category: String!, status: String!, estimatedCostCents: Int, actualCostCents: Int, dueAt: DateTime, updatedAt: DateTime! }
      type InventoryMerchandisingResult { id: ID!, version: Int!, status: String!, submittedAt: DateTime!, decidedAt: DateTime, decisionReason: String, updatedAt: DateTime! }
      type InventoryStockResult { id: ID!, rooftop: InventoryRooftopResult!, vehicle: InventoryVehicleResult!, acquisition: InventoryAcquisitionResult, stockNumber: String!, locationCode: String!, locationLabel: String, stockedAt: DateTime!, updatedAt: DateTime!, frontlineAt: DateTime, daysInStock: Int!, isAged: Boolean!, reconStatus: String!, merchandisingStatus: String!, feedStatus: String!, cost: InventoryCostSummary, reconWorkItems: [InventoryReconWorkResult!]!, latestMerchandisingVersion: InventoryMerchandisingResult, publicListing: InventoryPublicListingResult! }
      type InventoryAcquisitionResult { id: ID!, reference: String!, status: String!, vin: String!, year: Int!, make: String!, model: String!, acquisitionSource: String!, appraisalCents: Int!, purchaseCents: Int, reconEstimateCents: Int, updatedAt: DateTime!, vehicleId: ID }
      type InventoryFeedRunResult { id: ID!, channelKey: String!, status: String!, attemptedCount: Int!, succeededCount: Int!, failedCount: Int!, errorCount: Int!, completedAt: DateTime! }
      type InventoryWorkspaceSummary { visibleCount: Int!, availableCount: Int!, agedCount: Int!, reconOpenCount: Int!, totalRetailValueCents: Int!, totalCostCents: Int }
      type InventoryPageInfo { limit: Int!, offset: Int!, hasMore: Boolean! }
      type InventoryWorkspaceResult { items: [InventoryStockResult!]!, acquisitions: [InventoryAcquisitionResult!]!, feedRuns: [InventoryFeedRunResult!]!, channels: [String!]!, intakeRooftops: [InventoryRooftopResult!]!, summary: InventoryWorkspaceSummary!, pageInfo: InventoryPageInfo! }
      type InventoryCommandResult { id: ID!, stockId: ID!, status: String, merchandisingStatus: String!, feedStatus: String!, updatedAt: DateTime!, reused: Boolean! }
      type InventoryIntakeResult { id: ID!, vehicleId: ID!, acquisitionId: ID!, stockId: ID!, status: String, merchandisingStatus: String!, feedStatus: String!, updatedAt: DateTime!, reused: Boolean! }
      type InventoryFeedCommandResult { id: ID!, rooftopId: ID!, channelKey: String!, status: String!, attemptedCount: Int!, succeededCount: Int!, failedCount: Int!, errorCount: Int!, completedAt: DateTime!, reused: Boolean! }

      input IntakeInventoryVehicleInput { rooftopId: ID!, idempotencyKey: String!, reason: String!, acquisitionSource: String!, sourceReference: String, vin: String!, stockNumber: String!, year: Int!, make: String!, model: String!, trim: String, exteriorColor: String, interiorColor: String, mileage: Int, purchasePriceCents: Int!, listPriceCents: Int!, priceCents: Int!, condition: String!, description: String, features: JSON, imagePath: String, locationCode: String!, locationLabel: String }
      input EstablishInventoryStockInput { vehicleId: ID!, acquisitionId: ID, stockNumber: String!, locationCode: String!, locationLabel: String, purchaseCostCents: Int, reason: String!, idempotencyKey: String! }
      input MoveInventoryStockInput { stockId: ID!, locationCode: String!, locationLabel: String, expectedUpdatedAt: DateTime!, reason: String!, idempotencyKey: String! }
      input RecordInventoryCostInput { stockId: ID!, costType: String!, amountCents: Int!, reference: String, reason: String!, idempotencyKey: String! }
      input CreateInventoryReconWorkInput { stockId: ID!, title: String!, category: String!, estimatedCostCents: Int, assignedToId: ID, dueAt: DateTime, reason: String!, idempotencyKey: String! }
      input TransitionInventoryReconWorkInput { id: ID!, toStatus: String!, actualCostCents: Int, expectedUpdatedAt: DateTime!, reason: String!, idempotencyKey: String! }
      input UpdateInventoryMerchandisingDraftInput { stockId: ID!, priceCents: Int!, listPriceCents: Int, mileage: Int, description: String!, imagePath: String, expectedUpdatedAt: DateTime!, reason: String!, idempotencyKey: String! }
      input AddInventoryVehiclePhotoInput { stockId: ID!, photo: ImageFieldInput, imageUrl: String, reason: String!, idempotencyKey: String! }
      input ArrangeInventoryVehiclePhotosInput { stockId: ID!, imageIds: [ID!]!, reason: String!, idempotencyKey: String! }
      input RemoveInventoryVehiclePhotoInput { stockId: ID!, imageId: ID!, reason: String!, idempotencyKey: String! }
      input SubmitInventoryMerchandisingInput { stockId: ID!, reason: String!, idempotencyKey: String! }
      input DecideInventoryMerchandisingInput { id: ID!, decision: String!, reason: String!, expectedUpdatedAt: DateTime!, idempotencyKey: String! }
      input InventoryFeedErrorInput { stockId: ID, errorCode: String!, message: String!, rowReference: String }
      input RecordInventoryFeedRunInput { channelKey: String!, stockIds: [ID!]!, errors: [InventoryFeedErrorInput!], startedAt: DateTime, completedAt: DateTime, idempotencyKey: String! }

      type StorefrontProfilePayload {
        configured: Boolean!
        rooftopId: ID!
        rooftopSlug: String!
        fullName: String!
        shortName: String!
        salesEmail: String!
        serviceEmail: String!
        phoneDisplay: String!
        phoneHref: String!
        addressLine1: String!
        addressLine2: String!
        hoursMonFri: String!
        hoursSaturday: String!
        hoursSunday: String!
        websiteUrl: String!
        currencyCode: String!
        homepageTitle: String!
        homepageDescription: String!
        logoIcon: String!
        logoColor: String!
        timezone: String!
      }

      type CustomerAccountResult { id: ID! }
      type CustomerRequest { id: ID!, kind: String!, scheduledAt: DateTime!, status: String!, timezone: String }
      type Query {
        customerRequestHistory: [CustomerRequest!]!
        redirectToInit: Boolean
        publicInventoryVehicles(where: JSON, orderBy: JSON, take: Int, skip: Int): PublicInventoryResult!
        publicInventoryVehicle(id: ID!): PublicInventoryVehicle
        publicInventoryCount(where: JSON): Int!
        storefrontProfile(rooftopSlug: String): StorefrontProfilePayload!
        domainTimeline(aggregateType: String!, aggregateId: ID!, limit: Int = 50): [DomainAuditEvent!]!
        inventoryWorkspace(status: String, search: String, limit: Int = 50, offset: Int = 0): InventoryWorkspaceResult!
        crmWorkspace(status: String, search: String, limit: Int = 50, offset: Int = 0): CRMWorkspaceResult!
        dealDeskWorkspace(status: String, limit: Int = 50, offset: Int = 0): DealDeskWorkspaceResult!
        dealWorkspace(id: ID!): DealWorkspaceResult!
        dealLenderOffers(dealId: ID!): [DealLenderOfferResult!]!
        financeWorkspace(status: String, limit: Int = 25, offset: Int = 0): FinanceWorkspaceResult!
        deliveryWorkspace(limit: Int = 50, offset: Int = 0): DeliveryWorkspaceResult!
        fixedOpsWorkspace(limit: Int = 50, offset: Int = 0): FixedOpsWorkspaceResult!
        accountingWorkspace(limit: Int = 50): AccountingWorkspaceResult!
        operationalReport: OperationalReportResult!
        auditSearch(aggregateType: String, aggregateId: ID, action: String, limit: Int = 50): [DomainAuditEvent!]!
        customerDuplicateCandidates(customerId: ID!, limit: Int = 20): [CustomerDuplicateCandidate!]!
      }

      type Mutation {
        registerCustomerAccount(name: String!, email: String!, password: String!): CustomerAccountResult!
        updateActiveUser(data: UserUpdateProfileInput!): ActiveUserProfile
        submitInquiry(data: SubmitInquiryInput!): SubmitInquiryPayload!
        submitTestDrive(data: SubmitTestDriveInput!): SubmitTestDrivePayload!
        submitTradeIn(data: SubmitTradeInInput!): SubmitTradeInPayload!
        submitFinancing(data: SubmitFinancingInput!): SubmitFinancingPayload!
        submitServiceBooking(data: SubmitServiceBookingInput!): SubmitServiceBookingPayload!
        transitionDeal(id: ID!, toStatus: String!, notes: String, idempotencyKey: String!): Deal
        transitionServiceOrder(id: ID!, toStatus: String!, idempotencyKey: String!): ServiceOrder
        queueFinancingApplication(applicationId: ID!, providerKey: String!, idempotencyKey: String!): LenderSubmission
        recordLenderDecision(data: RecordLenderDecisionInput!): LenderDecision
        changeDealerMembership(data: ChangeDealerMembershipInput!): DealerMembershipChangePayload!
        createDealPencil(data: CreateDealPencilInput!): Deal
        openServiceOrder(data: OpenServiceOrderInput!): ServiceOrder
        transitionLead(id: ID!, toStatus: String!, lostReasonCode: String, lostReasonDetails: String, idempotencyKey: String!): Lead
        recordLeadInteraction(data: RecordLeadInteractionInput!): LeadInteractionResult!
        updateTestDriveWorkflow(data: TestDriveWorkflowInput!): TestDrive
        transitionServiceAppointment(id: ID!, toStatus: String!, idempotencyKey: String!): ServiceAppointment
        recordTradeInAppraisal(data: RecordTradeInAppraisalInput!): TradeIn
        createLeadTask(data: CreateLeadTaskInput!): Task
        completeTask(id: ID!, idempotencyKey: String!): Task
        startInventoryAcquisition(data: StartInventoryAcquisitionInput!): InventoryAcquisition
        transitionInventoryAcquisition(
          id: ID!
          toStatus: String!
          expectedUpdatedAt: DateTime!
          reason: String!
          purchaseCents: Int
          reconEstimateCents: Int
          vehicleId: ID
          idempotencyKey: String!
        ): InventoryAcquisition
        transferLeadOwnership(data: TransferLeadOwnershipInput!): OperatorCommandResult!
        saveDealWorksheet(data: SaveDealWorksheetInput!): OperatorCommandResult!
        presentDealWorksheet(data: PresentDealWorksheetInput!): OperatorCommandResult!
        acceptDealWorksheet(data: AcceptDealWorksheetInput!): OperatorCommandResult!
        selectDealLenderOffer(data: SelectDealLenderOfferInput!): OperatorCommandResult!
        reopenDealWorksheet(data: ReopenDealWorksheetInput!): OperatorCommandResult!
        manageDeliveryCase(data: ManageDeliveryCaseInput!): DeliveryCase!
        manageWeOweItem(data: ManageWeOweItemInput!): WeOweItem!
        completeDealDelivery(data: CompleteDealDeliveryInput!): OperatorCommandResult!
        recordServiceOrderEvidence(data: RecordServiceOrderEvidenceInput!): ServiceOrder!
        manageLaborOperation(data: ManageLaborOperationInput!): ServiceLaborOperation!
        configurePart(data: ConfigurePartInput!): PartsInventory!
        recordPartsMovement(data: RecordPartsMovementInput!): PartsMovement!
        managePartsPurchaseOrder(data: ManagePartsPurchaseOrderInput!): PartsPurchaseOrder!
        configureAccountingMapping(data: ConfigureAccountingMappingInput!): AccountingMapping!
        stageAccountingBatch(data: StageAccountingBatchInput!): AccountingBatch!
        manageAccountingBatch(data: ManageAccountingBatchInput!): AccountingBatch!
        createPaymentCheckout(data: CreatePaymentCheckoutInput!): PaymentTransaction!
        requestPaymentRefund(data: RequestPaymentRefundInput!): PaymentRefund!
        reconcilePaymentTransaction(data: ReconcilePaymentInput!): PaymentTransaction!
        handlePaymentProviderWebhook(providerId: ID!, event: JSON!, headers: JSON!): WebhookResult!
        saveOperationalReport(data: SaveOperationalReportInput!): SavedReport!
        runSavedReport(data: RunSavedReportInput!): ReportRun!
        queueDueSavedReports: ScheduledReportDispatchResult!
        addServiceOrderLineItem(data: AddServiceOrderLineInput!): OperatorCommandResult!
        openFinanceFollowUp(data: OpenFinanceFollowUpInput!): OperatorCommandResult!
        configureFinanceProduct(data: ConfigureFinanceProductInput!): FinanceProduct!
        recordFinanceProductQuote(data: RecordFinanceProductQuoteInput!): FinanceProductQuote!
        presentFinanceMenu(data: PresentFinanceMenuInput!): FinanceMenuVersion!
        decideFinanceMenu(data: DecideFinanceMenuInput!): FinanceMenuVersion!
        recordFinanceComplianceCheck(data: RecordFinanceComplianceInput!): FinanceComplianceCheck!
        manageFinanceContractPackage(data: ManageFinanceContractInput!): FinanceContractPackage!
        reviewFinancePrerequisites(data: ReviewFinancePrerequisitesInput!): OperatorCommandResult!
        manageFinanceFundingCase(data: ManageFinanceFundingInput!): FinanceFundingCase!
        recordFinanceProductCancellation(data: RecordFinanceProductCancellationInput!): FinanceProductCancellation!
        intakeInventoryVehicle(data: IntakeInventoryVehicleInput!): InventoryIntakeResult!
        establishInventoryStock(data: EstablishInventoryStockInput!): InventoryCommandResult!
        moveInventoryStock(data: MoveInventoryStockInput!): InventoryCommandResult!
        recordInventoryCost(data: RecordInventoryCostInput!): InventoryCommandResult!
        openInventoryReconWorkItem(data: CreateInventoryReconWorkInput!): InventoryCommandResult!
        transitionInventoryReconWorkItem(data: TransitionInventoryReconWorkInput!): InventoryCommandResult!
        updateInventoryMerchandisingDraft(data: UpdateInventoryMerchandisingDraftInput!): InventoryCommandResult!
        submitInventoryMerchandising(data: SubmitInventoryMerchandisingInput!): InventoryCommandResult!
        decideInventoryMerchandising(data: DecideInventoryMerchandisingInput!): InventoryCommandResult!
        recordInventoryFeedRun(data: RecordInventoryFeedRunInput!): InventoryFeedCommandResult!
        addInventoryVehiclePhoto(data: AddInventoryVehiclePhotoInput!): InventoryCommandResult!
        arrangeInventoryVehiclePhotos(data: ArrangeInventoryVehiclePhotosInput!): InventoryCommandResult!
        removeInventoryVehiclePhoto(data: RemoveInventoryVehiclePhotoInput!): InventoryCommandResult!
        mergeCustomers(data: MergeCustomersInput!): CustomerMergeResult!
        configureLeadRoutingRule(data: ConfigureLeadRoutingRuleInput!): OperatorCommandResult!
        routeLead(data: RouteLeadInput!): OperatorCommandResult!
        updateCustomerCommunicationPreferences(data: UpdateCustomerCommunicationPreferencesInput!): OperatorCommandResult!
        enrollLeadCadence(data: EnrollLeadCadenceInput!): OperatorCommandResult!
        advanceLeadCadence(data: AdvanceLeadCadenceInput!): OperatorCommandResult!
        linkCustomerHousehold(data: LinkCustomerHouseholdInput!): OperatorCommandResult!
        manageSalesVisit(data: ManageSalesVisitInput!): OperatorCommandResult!
        ensureDealershipOnboardingRecord(entity: String!, data: JSON!): JSON!
      }
    `,
    resolvers: {
      OperatorCommandResult: {
        // context.query returns ISO text; Keystone's DateTime scalar expects Date.
        updatedAt: (result: { updatedAt: Date | string }) => new Date(result.updatedAt),
      },
      Query: {
        customerRequestHistory,
        redirectToInit,
        publicInventoryVehicles,
        publicInventoryVehicle,
        publicInventoryCount,
        storefrontProfile,
        domainTimeline,
        inventoryWorkspace,
        crmWorkspace,
        dealDeskWorkspace,
        dealWorkspace,
        dealLenderOffers,
        financeWorkspace,
        deliveryWorkspace,
        fixedOpsWorkspace,
        accountingWorkspace,
        operationalReport,
        auditSearch,
        customerDuplicateCandidates,
      },
      Mutation: {
        registerCustomerAccount,
        updateActiveUser,
        submitInquiry: publicSubmissionResolver(submitInquiry),
        submitTestDrive: publicSubmissionResolver(submitTestDrive),
        submitTradeIn: publicSubmissionResolver(submitTradeIn),
        submitFinancing: publicSubmissionResolver(submitFinancing),
        submitServiceBooking: publicSubmissionResolver(submitServiceBooking),
        transitionDeal,
        transitionServiceOrder,
        queueFinancingApplication: operatorCommand(queueFinancingApplication),
        recordLenderDecision: operatorCommand(recordLenderDecision),
        changeDealerMembership,
        startInventoryAcquisition,
        transitionInventoryAcquisition,
        createDealPencil,
        openServiceOrder,
        transitionLead,
        recordLeadInteraction,
        updateTestDriveWorkflow,
        transitionServiceAppointment,
        recordTradeInAppraisal,
        createLeadTask,
        completeTask,
        transferLeadOwnership,
        saveDealWorksheet,
        presentDealWorksheet,
        acceptDealWorksheet,
        selectDealLenderOffer,
        reopenDealWorksheet,
        manageDeliveryCase,
        manageWeOweItem,
        completeDealDelivery: operatorCommand(completeDealDelivery),
        recordServiceOrderEvidence,
        manageLaborOperation,
        configurePart,
        recordPartsMovement,
        managePartsPurchaseOrder,
        configureAccountingMapping,
        stageAccountingBatch,
        manageAccountingBatch,
        createPaymentCheckout,
        requestPaymentRefund,
        reconcilePaymentTransaction,
        handlePaymentProviderWebhook,
        saveOperationalReport,
        runSavedReport,
        queueDueSavedReports,
        addServiceOrderLineItem,
        openFinanceFollowUp: operatorCommand(openFinanceFollowUp),
        configureFinanceProduct,
        recordFinanceProductQuote,
        presentFinanceMenu: keystoneItemResult('FinanceMenuVersion', presentFinanceMenu),
        decideFinanceMenu: keystoneItemResult('FinanceMenuVersion', decideFinanceMenu),
        recordFinanceComplianceCheck: keystoneItemResult('FinanceComplianceCheck', recordFinanceComplianceCheck),
        manageFinanceContractPackage: keystoneItemResult('FinanceContractPackage', manageFinanceContractPackage),
        reviewFinancePrerequisites,
        manageFinanceFundingCase,
        recordFinanceProductCancellation,
        intakeInventoryVehicle,
        establishInventoryStock,
        moveInventoryStock,
        recordInventoryCost,
        openInventoryReconWorkItem,
        transitionInventoryReconWorkItem,
        updateInventoryMerchandisingDraft,
        submitInventoryMerchandising,
        decideInventoryMerchandising,
        recordInventoryFeedRun,
        addInventoryVehiclePhoto,
        arrangeInventoryVehiclePhotos,
        removeInventoryVehiclePhoto,
        mergeCustomers,
        configureLeadRoutingRule,
        routeLead,
        updateCustomerCommunicationPreferences,
        enrollLeadCadence,
        advanceLeadCadence,
        linkCustomerHousehold,
        manageSalesVisit,
        ensureDealershipOnboardingRecord,
      },
    },
  });
}
