export async function executeAdapterFunction({ provider, functionName, args }: { provider: Record<string, any>; functionName: string; args: Record<string, unknown> }) {
  const functionPath = provider[functionName];

  if (functionPath.startsWith("http")) {
    const response = await fetch(functionPath, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider, ...args }),
    });

    if (!response.ok) {
      throw new Error(`HTTP request failed: ${response.statusText}`);
    }
    return response.json();
  }

  const adapter = await import(
    `../../integrations/payment/${functionPath}.ts`
  );

  const fn = adapter[functionName];
  if (!fn) {
    throw new Error(
      `Function ${functionName} not found in adapter ${functionPath}`
    );
  }

  try {
    return await fn({ provider, ...args });
  } catch (error) {
    throw new Error(
      `Error executing ${functionName} for provider ${functionPath}: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

// Helper functions for common payment operations
type PaymentOperationArgs = {
  provider: Record<string, any>;
  paymentId: string;
  amount: number;
  currency: string;
  idempotencyKey: string;
};

export async function createPayment({ provider, cart, amount, currency }: {
  provider: Record<string, any>;
  cart: Record<string, any>;
  amount: number;
  currency: string;
}) {
  return executeAdapterFunction({
    provider,
    functionName: "createPaymentFunction",
    args: { cart, amount, currency },
  });
}

export async function capturePayment({ provider, paymentId, amount, currency, idempotencyKey }: PaymentOperationArgs) {
  return executeAdapterFunction({
    provider,
    functionName: "capturePaymentFunction",
    args: { paymentId, amount, currency, idempotencyKey },
  });
}

export async function refundPayment({ provider, paymentId, amount, currency, idempotencyKey }: PaymentOperationArgs) {
  return executeAdapterFunction({
    provider,
    functionName: "refundPaymentFunction",
    args: { paymentId, amount, currency, idempotencyKey },
  });
}

export async function getPaymentStatus({ provider, paymentId }: { provider: Record<string, any>; paymentId: string }) {
  return executeAdapterFunction({
    provider,
    functionName: "getPaymentStatusFunction",
    args: { paymentId },
  });
}

export async function generatePaymentLink({ provider, paymentId }: { provider: Record<string, any>; paymentId: string }) {
  return executeAdapterFunction({
    provider,
    functionName: "generatePaymentLinkFunction",
    args: { paymentId },
  });
}

export async function handleWebhook({ provider, event, headers }: { provider: Record<string, any>; event: unknown; headers: Record<string, string> }) {
  return executeAdapterFunction({
    provider,
    functionName: "handleWebhookFunction",
    args: { event, headers },
  });
}
