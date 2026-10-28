-- Payment transactions store the installed provider's code (e.g. pp_stripe_stripe) since
-- 20261024200000; provider events copy that key, so their check follows the same rule.
ALTER TABLE "PaymentProviderEvent" DROP CONSTRAINT "PaymentProviderEvent_provider_digest_check";
ALTER TABLE "PaymentProviderEvent" ADD CONSTRAINT "PaymentProviderEvent_provider_digest_check" CHECK ("providerKey" <> '' AND "payloadDigest" ~ '^[0-9a-f]{64}$');
