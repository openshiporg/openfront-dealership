"use server";

import { createHash } from "node:crypto";
import { handleWebhook } from "../utils/paymentProviderAdapter";
import { processVerifiedPaymentWebhook } from "./paymentOperations";

function normalizedHeaders(headers: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(headers || {}).map(([key, value]) => [
      key.toLowerCase(),
      Array.isArray(value) ? String(value[0] || "") : String(value || ""),
    ])
  );
}

function signatureTimestamp(headers: Record<string, string>, fallbackSeconds: number) {
  const timestamp = (headers["stripe-signature"] || "")
    .split(",")
    .map((part) => part.trim().split("=", 2))
    .find(([key]) => key === "t")?.[1];
  const seconds = timestamp && /^\d+$/.test(timestamp) ? Number(timestamp) : fallbackSeconds;
  return new Date(seconds * 1000);
}

const HANDLED_EVENTS = ["checkout.session.completed", "checkout.session.expired", "payment_intent.succeeded", "payment_intent.payment_failed", "payment_intent.canceled", "refund.created", "refund.updated"];

async function handlePaymentProviderWebhook(
  root: any,
  { providerId, event, headers }: { providerId: string; event: any; headers: Record<string, unknown> },
  context: any
) {
  const sudo = context.sudo();
  const provider = await sudo.query.PaymentProvider.findOne({
    where: { code: providerId },
    query: `
      id code isInstalled handleWebhookFunction credentials
    `,
  });
  if (!provider?.isInstalled) throw new Error("Payment provider not found");

  // Provider verification is the authorization boundary for this external
  // callback. Stripe receives the exact raw body from the thin HTTP ingress.
  const { __rawBody, ...forwardedHeaders } = headers || {};
  const requestHeaders = {
    ...normalizedHeaders(forwardedHeaders),
    ...(typeof __rawBody === "string" ? { __rawBody } : {}),
  };
  const verified = await handleWebhook({
    provider,
    event,
    headers: requestHeaders,
  });
  const verifiedEvent = verified.event || event || {};
  const type = String(verified.type || verifiedEvent.type || "");
  const resource = verified.resource || {};
  const providerEventId = String(verifiedEvent.id || "");
  const transactionId = String(resource.metadata?.openfront_transaction_id || "");
  if (!providerEventId || !type) throw new Error("Provider event ID is required");
  // The Stripe account is shared with other stores: a verified event that is not one of this store's
  // payments is acknowledged and ignored, so Stripe does not retry it or disable the endpoint.
  const ignored = (reason: string) => ({ success: true, ignored: true, message: `Event acknowledged, not for this store (${reason})` });
  if (!HANDLED_EVENTS.includes(type)) return ignored("event type");
  if (!transactionId) return ignored("no transaction");
  const owned = await sudo.prisma.paymentTransaction.findUnique({ where: { id: transactionId }, select: { providerKey: true } }).catch(() => null);
  if (!owned || owned.providerKey !== provider.code) return ignored("unknown transaction");

  const createdSeconds = Number(verifiedEvent.created || Math.floor(Date.now() / 1000));
  const result = await processVerifiedPaymentWebhook({
    id: providerEventId,
    type,
    providerKey: provider.code,
    createdAt: new Date(createdSeconds * 1000),
    signatureTimestamp: signatureTimestamp(requestHeaders, createdSeconds),
    transactionId,
    providerTransactionId: resource.payment_intent
      ? String(typeof resource.payment_intent === "string" ? resource.payment_intent : resource.payment_intent.id)
      : resource.object === "payment_intent" ? String(resource.id) : undefined,
    providerSessionId: resource.object === "checkout.session" ? String(resource.id) : undefined,
    providerRefundId: resource.object === "refund" ? String(resource.id) : undefined,
    amountCents: Number(resource.amount_received ?? resource.amount_total ?? resource.amount ?? 0) || undefined,
    providerStatus: resource.payment_status
      ? String(resource.payment_status)
      : resource.status ? String(resource.status) : undefined,
    rawDigest: createHash("sha256").update(requestHeaders.__rawBody || JSON.stringify(event)).digest("hex"),
  }, sudo);

  return {
    success: true,
    message: result.duplicate ? "Duplicate event acknowledged" : "Provider event reconciled",
  };
}

export default handlePaymentProviderWebhook;
