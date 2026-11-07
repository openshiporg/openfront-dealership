-- Record invariants the commands relied on but the database never enforced.
-- Every constraint was checked against production data first (0 violations).

ALTER TABLE "Vehicle" ADD CONSTRAINT "Vehicle_nonnegative_check" CHECK ("priceCents" >= 0 AND "listPriceCents" >= 0 AND "purchasePriceCents" >= 0 AND "mileage" >= 0);
ALTER TABLE "PriceHistory" ADD CONSTRAINT "PriceHistory_nonnegative_check" CHECK ("newPriceCents" >= 0 AND "previousPriceCents" >= 0);
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_nonnegative_check" CHECK ("vehiclePriceCents" >= 0 AND "tradeInValueCents" >= 0 AND "downPaymentCents" >= 0 AND "financingAmountCents" >= 0 AND "monthlyPaymentCents" >= 0 AND "taxAmountCents" >= 0 AND "residualValueCents" >= 0 AND "loanTerm" >= 0 AND "apr" >= 0 AND "moneyFactorBasisPoints" >= 0);
ALTER TABLE "TradeIn" ADD CONSTRAINT "TradeIn_nonnegative_check" CHECK ("kbbValueCents" >= 0 AND "offerAmountCents" >= 0 AND "mileage" >= 0);
ALTER TABLE "ServiceAppointment" ADD CONSTRAINT "ServiceAppointment_nonnegative_check" CHECK ("estimatedDuration" >= 0 AND "mileageIn" >= 0);
ALTER TABLE "ServiceOrder" ADD CONSTRAINT "ServiceOrder_nonnegative_check" CHECK ("laborTotalCents" >= 0 AND "partsTotalCents" >= 0 AND "taxCents" >= 0 AND "grandTotalCents" >= 0);
ALTER TABLE "RepairOrderLineItem" ADD CONSTRAINT "RepairOrderLineItem_nonnegative_check" CHECK ("unitPriceCents" >= 0 AND "priceCents" >= 0 AND "costCents" >= 0);
ALTER TABLE "ServicePackage" ADD CONSTRAINT "ServicePackage_nonnegative_check" CHECK ("priceCents" >= 0 AND "estimatedDuration" >= 0);
ALTER TABLE "PartsInventory" ADD CONSTRAINT "PartsInventory_nonnegative_check" CHECK ("priceCents" >= 0 AND "costCents" >= 0 AND "minimumQuantity" >= 0);
ALTER TABLE "FinancingApplication" ADD CONSTRAINT "FinancingApplication_nonnegative_check" CHECK ("annualIncomeCents" >= 0 AND "requestedAmountCents" >= 0 AND "plannedMonthlyPaymentCents" >= 0 AND "plannedDownPaymentCents" >= 0 AND "tradeInValueCents" >= 0 AND "aprBasisPoints" >= 0);
ALTER TABLE "LenderDecision" ADD CONSTRAINT "LenderDecision_nonnegative_check" CHECK ("approvedAmountCents" >= 0 AND "aprBasisPoints" >= 0 AND "monthlyPaymentCents" >= 0);
ALTER TABLE "InventoryAcquisition" ADD CONSTRAINT "InventoryAcquisition_nonnegative_check" CHECK ("odometer" >= 0 AND "appraisalCents" >= 0 AND "purchaseCents" >= 0 AND "reconEstimateCents" >= 0);
ALTER TABLE "InventoryStock" ADD CONSTRAINT "InventoryStock_nonnegative_check" CHECK ("purchaseCostCents" >= 0 AND "reconCostCents" >= 0 AND "otherCostCents" >= 0 AND "totalCostCents" >= 0);
ALTER TABLE "InventoryReconWorkItem" ADD CONSTRAINT "InventoryReconWorkItem_nonnegative_check" CHECK ("estimatedCostCents" >= 0 AND "actualCostCents" >= 0);
ALTER TABLE "ServiceOrder" ADD CONSTRAINT "ServiceOrder_total_matches_parts_check" CHECK ("grandTotalCents" = COALESCE("laborTotalCents", 0) + COALESCE("partsTotalCents", 0) + COALESCE("taxCents", 0));
ALTER TABLE "RepairOrderLineItem" ADD CONSTRAINT "RepairOrderLineItem_quantity_positive_check" CHECK ("quantity" > 0);
ALTER TABLE "RepairOrderLineItem" ADD CONSTRAINT "RepairOrderLineItem_line_total_check" CHECK (abs("priceCents" - "quantity" * "unitPriceCents") <= 0.5);
ALTER TABLE "InventoryStock" ADD CONSTRAINT "InventoryStock_total_cost_check" CHECK ("totalCostCents" = COALESCE("purchaseCostCents", 0) + COALESCE("reconCostCents", 0) + COALESCE("otherCostCents", 0));
ALTER TABLE "FinancingApplication" ADD CONSTRAINT "FinancingApplication_term_positive_check" CHECK ("loanTermMonths" > 0);
ALTER TABLE "LenderDecision" ADD CONSTRAINT "LenderDecision_term_positive_check" CHECK ("termMonths" > 0);
ALTER TABLE "User" ADD CONSTRAINT "User_commissionRate_range_check" CHECK ("commissionRate" >= 0 AND "commissionRate" <= 100);
ALTER TABLE "DealershipProfile" ADD CONSTRAINT "DealershipProfile_pricing_check" CHECK ("salesTaxRateBps" BETWEEN 0 AND 10000 AND "docFeeCents" >= 0);

-- One primary photo per vehicle; the photo commands demote the old primary first.
CREATE UNIQUE INDEX "VehicleImage_single_primary_key" ON "VehicleImage"("vehicle") WHERE "isPrimary";
-- One live deal per vehicle: two submitted/approved/financed deals would sell one car twice.
CREATE UNIQUE INDEX "Deal_single_active_per_vehicle_key" ON "Deal"("vehicle") WHERE "status" IN ('submitted', 'approved', 'financed');
-- A finance product on an accepted menu can be cancelled (and refunded) once.
CREATE UNIQUE INDEX "FinanceProductCancellation_single_completed_key" ON "FinanceProductCancellation"("menu", "productCode") WHERE "status" = 'completed';
