import { User } from './User';
import { Role } from './Role';
import { Make } from './Make';
import { Model } from './Model';
import { Vehicle } from './Vehicle';
import { VehicleImage } from './VehicleImage';
import { VehicleConditionReport } from './VehicleConditionReport';
import { VehicleHistory } from './VehicleHistory';
import { PriceHistory } from './PriceHistory';
import { Lead } from './Lead';
import { CustomerInteraction } from './CustomerInteraction';
import { Task } from './Task';
import { TestDrive } from './TestDrive';
import { Deal } from './Deal';
import { DealApproval } from './DealApproval';
import { TradeIn } from './TradeIn';
import { ServiceAppointment } from './ServiceAppointment';
import { ServiceOrder } from './ServiceOrder';
import { RepairOrderLineItem } from './RepairOrderLineItem';
import { ServicePackage } from './ServicePackage';
import { PartsInventory } from './PartsInventory';
import { DealershipProfile } from './DealershipProfile';
import { FinancingApplication } from './FinancingApplication';
import { LenderSubmission } from './LenderSubmission';
import { LenderDecision } from './LenderDecision';
import { DealerGroup } from './DealerGroup';
import { Rooftop } from './Rooftop';
import { DealerGroupMembership } from './DealerGroupMembership';
import { RooftopMembership } from './RooftopMembership';
import { MembershipAuditEvent } from './MembershipAuditEvent';
import { InventoryAcquisition } from './InventoryAcquisition';
import { InventoryAcquisitionEvent } from './InventoryAcquisitionEvent';
import { DomainAuditEvent } from './DomainAuditEvent';
import { InventoryStock } from './InventoryStock';
import { InventoryStockEvent } from './InventoryStockEvent';
import { InventoryReconWorkItem } from './InventoryReconWorkItem';
import { InventoryMerchandisingVersion } from './InventoryMerchandisingVersion';
import { InventoryFeedRun } from './InventoryFeedRun';
import { InventoryFeedError } from './InventoryFeedError';
import { Customer } from './Customer';
import { CustomerMergeEvent } from './CustomerMergeEvent';
import { LeadAssignmentEvent } from './LeadAssignmentEvent';
import { LeadRoutingRule } from './LeadRoutingRule';
import { CustomerContactPreferenceEvent } from './CustomerContactPreferenceEvent';
import { CustomerHousehold } from './CustomerHousehold';
import { SalesVisit } from './SalesVisit';
import { FinanceProduct } from './FinanceProduct';
import { FinanceMenuVersion } from './FinanceMenuVersion';
import { FinanceComplianceCheck } from './FinanceComplianceCheck';
import { FinanceContractPackage } from './FinanceContractPackage';
import { FinanceFundingCase } from './FinanceFundingCase';
import { FinanceProductQuote } from './FinanceProductQuote';
import { FinanceProductCancellation } from './FinanceProductCancellation';
import { DeliveryCase } from './DeliveryCase';
import { WeOweItem } from './WeOweItem';
import { ServiceLaborOperation } from './ServiceLaborOperation';
import { PartsMovement } from './PartsMovement';
import { PartsPurchaseOrder } from './PartsPurchaseOrder';
import { AccountingMapping } from './AccountingMapping';
import { AccountingBatch } from './AccountingBatch';
import { AccountingProviderResponse } from './AccountingProviderResponse';
import { PaymentTransaction } from './PaymentTransaction';
import { PaymentRefund } from './PaymentRefund';
import { PaymentProviderEvent } from './PaymentProviderEvent';
import { PaymentProvider } from './PaymentProvider';
import { SavedReport } from './SavedReport';
import { ReportRun } from './ReportRun';
import { RetentionPolicy } from './RetentionPolicy';
import { AuthenticationThrottle } from './AuthenticationThrottle';
import { ApiKey } from './ApiKey';

const rawModels = {
  User,
  Role,
  Make,
  Model,
  Vehicle,
  VehicleImage,
  VehicleConditionReport,
  VehicleHistory,
  PriceHistory,
  Lead,
  CustomerInteraction,
  Task,
  TestDrive,
  Deal,
  DealApproval,
  TradeIn,
  ServiceAppointment,
  ServiceOrder,
  RepairOrderLineItem,
  ServicePackage,
  PartsInventory,
  DealershipProfile,
  FinancingApplication,
  LenderSubmission,
  LenderDecision,
  DealerGroup,
  Rooftop,
  DealerGroupMembership,
  RooftopMembership,
  MembershipAuditEvent,
  InventoryAcquisition,
  InventoryAcquisitionEvent,
  DomainAuditEvent,
  InventoryStock,
  InventoryStockEvent,
  InventoryReconWorkItem,
  InventoryMerchandisingVersion,
  InventoryFeedRun,
  InventoryFeedError,
  Customer,
  CustomerMergeEvent,
  LeadAssignmentEvent,
  LeadRoutingRule,
  CustomerContactPreferenceEvent,
  CustomerHousehold,
  SalesVisit,
  FinanceProduct,
  FinanceMenuVersion,
  FinanceComplianceCheck,
  FinanceContractPackage,
  FinanceFundingCase,
  FinanceProductQuote,
  FinanceProductCancellation,
  DeliveryCase,
  WeOweItem,
  ServiceLaborOperation,
  PartsMovement,
  PartsPurchaseOrder,
  AccountingMapping,
  AccountingBatch,
  AccountingProviderResponse,
  PaymentTransaction,
  PaymentRefund,
  PaymentProviderEvent,
  PaymentProvider,
  SavedReport,
  ReportRun,
  RetentionPolicy,
  AuthenticationThrottle,
  ApiKey,
};

// Sidebar visibility follows the role: a list whose query access denies the session is hidden from navigation
// (Keystone evaluates ui.isHidden per session in admin meta). Explicit isHidden settings are kept.
export const models = Object.fromEntries(Object.entries(rawModels).map(([key, config]: [string, any]) => {
  const operationQuery = config?.access?.operation?.query;
  const filterQuery = config?.access?.filter?.query;
  if (typeof operationQuery !== 'function' && typeof filterQuery !== 'function') return [key, config];
  const existing = config?.ui?.isHidden;
  const isHidden = (args: any) => {
    if (existing === true || (typeof existing === 'function' && existing(args))) return true;
    if (typeof operationQuery === 'function' && !operationQuery(args)) return true;
    return typeof filterQuery === 'function' && filterQuery(args) === false;
  };
  return [key, { ...config, ui: { ...(config.ui ?? {}), isHidden } }];
})) as typeof rawModels;

export default models;