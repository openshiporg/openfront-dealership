type CreatePaymentInput = {
  amount: number;
  currency: string;
};

type PaymentOperationInput = {
  paymentId: string;
  amount?: number;
  currency?: string;
  idempotencyKey?: string;
};

export async function handleWebhookFunction() {
  throw new Error('Manual payment providers do not accept webhook ingress');
}

export async function createPaymentFunction({ amount, currency }: CreatePaymentInput) {
  // Manual payments are collected in person and recorded by staff
  return {
    status: 'pending',
    data: {
      status: 'pending',
      amount,
      currency: currency.toLowerCase(),
    }
  };
}

export async function capturePaymentFunction({ amount = 0 }: PaymentOperationInput) {
  // Manual payments are considered captured immediately
  return {
    status: 'captured',
    amount,
    data: {
      status: 'captured',
      amount,
      captured_at: new Date().toISOString(),
    }
  };
}

export async function refundPaymentFunction({ amount = 0, currency = "USD" }: PaymentOperationInput) {
  // Manual refunds need to be tracked manually
  return {
    status: 'refunded',
    amount,
    currency,
    data: {
      status: 'refunded',
      amount,
      refunded_at: new Date().toISOString(),
    }
  };
}

export async function getPaymentStatusFunction() {
  // Manual payments are always considered successful unless manually marked otherwise
  return {
    status: 'succeeded',
    data: {
      status: 'succeeded',
    }
  };
}

export async function generatePaymentLinkFunction() {
  // Manual payments don't have external links
  return null;
}
