import Razorpay from 'razorpay';
import crypto from 'crypto';

let razorpayInstance: Razorpay | null = null;

export function getRazorpayClient(): Razorpay | null {
  const key_id = process.env.RAZORPAY_KEY_ID;
  const key_secret = process.env.RAZORPAY_KEY_SECRET;

  if (!key_id || !key_secret) {
    console.error('Razorpay live credentials are not configured.');
    return null;
  }

  const isLiveMode = key_id.startsWith('rzp_live_');
  if (process.env.NODE_ENV === 'production' && !isLiveMode) {
    const error = new Error('Live Razorpay credentials are required in production.') as Error & { statusCode: number };
    error.statusCode = 500;
    throw error;
  }

  if (!razorpayInstance) {
    razorpayInstance = new Razorpay({
      key_id,
      key_secret,
    });
    console.log(`💳 Razorpay ${isLiveMode ? 'Live' : 'Test'} Mode client initialized successfully.`);
  }

  return razorpayInstance;
}

export async function createRazorpayOrder(options: {
  amountPaise: number;
  currency?: string;
  receipt: string;
  notes?: Record<string, string>;
}): Promise<{ id: string; amount: number; currency: string }> {
  const rzp = getRazorpayClient();
  if (!rzp) {
    const error = new Error('Razorpay credentials are not configured.') as Error & { statusCode: number };
    error.statusCode = 500;
    throw error;
  }

  try {
    const order = await rzp.orders.create({
      amount: Math.round(options.amountPaise),
      currency: options.currency || 'INR',
      receipt: options.receipt.slice(0, 40),
      notes: options.notes,
    });
    return {
      id: order.id,
      amount: Number(order.amount),
      currency: order.currency,
    };
  } catch (err: any) {
    console.error('Failed to create Razorpay order:', err);
    const description = err?.error?.description || err?.message || 'Unknown Razorpay API error';
    const error = new Error(`Razorpay Order Creation Failed: ${description}`) as Error & { statusCode: number };
    error.statusCode = err?.statusCode || err?.status || 500;
    throw error;
  }
}

export function verifyPaymentSignature(params: {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
}): boolean {
  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!secret || !params.razorpaySignature) {
    console.warn('Cannot verify signature: RAZORPAY_KEY_SECRET or signature missing');
    return false;
  }

  const generatedSignature = crypto
    .createHmac('sha256', secret)
    .update(`${params.razorpayOrderId}|${params.razorpayPaymentId}`)
    .digest('hex');

  const bufGen = Buffer.from(generatedSignature, 'utf8');
  const bufSig = Buffer.from(params.razorpaySignature, 'utf8');

  if (bufGen.length !== bufSig.length) {
    return false;
  }

  try {
    return crypto.timingSafeEqual(bufGen, bufSig);
  } catch {
    return false;
  }
}

export function verifyWebhookSignature(
  rawBody: string | Buffer,
  signature: string,
  webhookSecret: string
): boolean {
  if (!webhookSecret) return false;

  const expectedSignature = crypto
    .createHmac('sha256', webhookSecret)
    .update(rawBody)
    .digest('hex');

  try {
    return crypto.timingSafeEqual(
      Buffer.from(expectedSignature),
      Buffer.from(signature)
    );
  } catch {
    return false;
  }
}

export async function fetchPaymentFromRazorpay(paymentId: string): Promise<any | null> {
  const rzp = getRazorpayClient();
  if (!rzp) return null;

  try {
    const payment = await rzp.payments.fetch(paymentId);
    return payment;
  } catch (err: any) {
    console.warn(`Could not fetch payment ${paymentId} from Razorpay:`, err.message);
    return null;
  }
}

export async function createRazorpayRefund(params: {
  paymentId: string;
  amountPaise: number;
  receipt: string;
}): Promise<{ id: string; status: string; amount: number; currency: string }> {
  const client = getRazorpayClient();
  if (!client) throw new Error('Razorpay is not configured.');
  const refund = await client.payments.refund(params.paymentId, {
    amount: params.amountPaise,
    notes: { receipt: params.receipt.slice(0, 40) },
  });
  return {
    id: refund.id,
    status: refund.status,
    amount: Number(refund.amount),
    currency: refund.currency,
  };
}

export async function createRazorpayRouteTransfer(params: {
  paymentId: string;
  accountId: string;
  amountPaise: number;
  ledgerId: string;
}): Promise<{ id: string; status: string }> {
  const client = getRazorpayClient();
  if (!client) throw new Error('Razorpay is not configured.');
  const result = await client.payments.transfer(params.paymentId, {
    transfers: [{
      account: params.accountId,
      amount: params.amountPaise,
      currency: 'INR',
      notes: { payout_ledger_id: params.ledgerId },
    }],
  });
  const transfer = result.items.find((item) => item.notes?.payout_ledger_id === params.ledgerId);
  if (!transfer) throw new Error('Razorpay did not return the requested Route transfer.');
  return { id: transfer.id, status: transfer.status };
}

export async function findRazorpayRouteTransfer(params: {
  paymentId: string;
  ledgerId: string;
}): Promise<{ id: string; status: string } | null> {
  const client = getRazorpayClient();
  if (!client) throw new Error('Razorpay is not configured.');
  const transfers = await client.payments.fetchTransfer(params.paymentId);
  const transfer = transfers.items.find((item) => item.notes?.payout_ledger_id === params.ledgerId);
  return transfer ? { id: transfer.id, status: transfer.status } : null;
}

export async function fetchRazorpayRouteTransfer(transferId: string): Promise<{ id: string; status: string }> {
  const client = getRazorpayClient();
  if (!client) throw new Error('Razorpay is not configured.');
  const transfer = await client.transfers.fetch(transferId);
  return { id: transfer.id, status: transfer.status };
}
