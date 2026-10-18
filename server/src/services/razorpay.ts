import Razorpay from 'razorpay';
import crypto from 'crypto';

let razorpayInstance: Razorpay | null = null;

export function getRazorpayClient(): Razorpay | null {
  const key_id = process.env.RAZORPAY_KEY_ID;
  const key_secret = process.env.RAZORPAY_KEY_SECRET;

  if (!key_id || !key_secret) {
    console.warn('⚠️ Razorpay credentials not configured. Payment services will run in offline sandbox mode.');
    return null;
  }

  if (!razorpayInstance) {
    razorpayInstance = new Razorpay({
      key_id,
      key_secret,
    });
    console.log('💳 Razorpay Test Mode client initialized successfully.');
  }

  return razorpayInstance;
}

export async function createRazorpayOrder(options: {
  amountPaise: number;
  currency?: string;
  receipt: string;
  notes?: Record<string, string>;
}): Promise<{ id: string; amount: number; currency: string } | null> {
  const rzp = getRazorpayClient();
  if (!rzp) {
    // Development simulated fallback if credentials missing
    return {
      id: `order_sbx_${Date.now()}`,
      amount: options.amountPaise,
      currency: options.currency || 'INR',
    };
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
    throw new Error(`Razorpay Order Creation Failed: ${err.message}`);
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
