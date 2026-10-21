ALTER TABLE "PaymentTransaction" ADD CONSTRAINT "PaymentTransaction_status_check" CHECK ("status" IN ('creating','pending','authorized','captured','failed','canceled','partially-refunded','refunded'));
ALTER TABLE "PaymentTransaction" ADD CONSTRAINT "PaymentTransaction_provider_currency_check" CHECK ("providerKey" = 'stripe' AND "currency" = 'usd');
ALTER TABLE "PaymentRefund" ADD CONSTRAINT "PaymentRefund_status_check" CHECK ("status" IN ('creating','pending','succeeded','failed','canceled'));
ALTER TABLE "PaymentProviderEvent" ADD CONSTRAINT "PaymentProviderEvent_provider_digest_check" CHECK ("providerKey" = 'stripe' AND "payloadDigest" ~ '^[0-9a-f]{64}$');
ALTER TABLE "SavedReport" ADD CONSTRAINT "SavedReport_configuration_check" CHECK ("reportType" IN ('operations','audit','accounting-exceptions','payment-reconciliation') AND "exportFormat" IN ('json','csv') AND "schedule" IN ('manual','daily','weekly','monthly'));
ALTER TABLE "ReportRun" ADD CONSTRAINT "ReportRun_status_format_check" CHECK ("status" IN ('queued','completed','failed','expired') AND "exportFormat" IN ('json','csv'));
