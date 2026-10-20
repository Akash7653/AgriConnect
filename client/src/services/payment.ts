import { request } from './api';
import type { AuthSession, CartItem } from '@/types';

export interface DeliveryAddress {
  recipientName: string;
  phone: string;
  addressLine1: string;
  city: string;
  district: string;
  state: string;
  pinCode: string;
}

interface PaymentOrderResponse {
  orderId: string;
  orderNumber: string;
  razorpayOrderId: string;
  amountPaise: number;
  currency: string;
  keyId: string;
}

export interface PaymentHistoryEntry {
  orderNumber: string;
  amount: number;
  currency: string;
  paidAt: string;
  buyerEmail: string;
  status: 'captured';
}

interface RazorpayResult {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

interface RazorpayOptions {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  order_id: string;
  handler: (result: RazorpayResult) => void;
  modal: { ondismiss: () => void };
  theme: { color: string };
}

interface RazorpayConstructor {
  new (options: RazorpayOptions): {
    open: () => void;
    on: (event: 'payment.failed', handler: (response: { error?: { description?: string } }) => void) => void;
  };
}

declare global {
  interface Window {
    Razorpay?: RazorpayConstructor;
    webkitAudioContext?: typeof AudioContext;
  }
}

export function playPaymentSuccessSound() {
  const AudioContextConstructor = window.AudioContext ?? window.webkitAudioContext;
  if (!AudioContextConstructor) return;

  const context = new AudioContextConstructor();
  void context.resume().then(() => {
    const gain = context.createGain();
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.08, context.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.55);
    gain.connect(context.destination);

    [659.25, 783.99].forEach((frequency, index) => {
      const oscillator = context.createOscillator();
      oscillator.type = 'sine';
      oscillator.frequency.value = frequency;
      oscillator.connect(gain);
      oscillator.start(context.currentTime + index * 0.12);
      oscillator.stop(context.currentTime + 0.55);
    });

    window.setTimeout(() => void context.close(), 700);
  });
}

async function loadRazorpay(): Promise<RazorpayConstructor> {
  if (window.Razorpay) return window.Razorpay;

  await new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Could not load the Razorpay checkout.'));
    document.body.appendChild(script);
  });

  if (!window.Razorpay) throw new Error('Razorpay checkout is unavailable.');
  return window.Razorpay;
}

export const PaymentService = {
  async createOrder(session: AuthSession, items: CartItem[], deliveryAddress: DeliveryAddress) {
    return request<PaymentOrderResponse>('/payment/create-order', {
      method: 'POST',
      token: session.token,
      body: JSON.stringify({
        items: items.map((item) => ({ listingId: item.productId, quantity: item.quantity })),
        deliveryAddress,
        deliverySlot: {
          date: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
          timeWindow: '07:00 AM - 11:00 AM',
        },
      }),
    });
  },

  async verifyPayment(session: AuthSession, orderId: string, result: RazorpayResult) {
    return request<{ orderNumber: string }>('/payment/verify', {
      method: 'POST',
      token: session.token,
      body: JSON.stringify({
        orderId,
        razorpayOrderId: result.razorpay_order_id,
        razorpayPaymentId: result.razorpay_payment_id,
        razorpaySignature: result.razorpay_signature,
      }),
    });
  },

  async openCheckout(
    order: PaymentOrderResponse,
    session: AuthSession,
    onSuccess: (orderNumber: string, amount: number) => void,
    onError: (message: string) => void
  ) {
    try {
      const Razorpay = await loadRazorpay();
      const checkout = new Razorpay({
        key: import.meta.env.VITE_RAZORPAY_KEY_ID || order.keyId,
        amount: order.amountPaise,
        currency: order.currency,
        name: 'AgriConnect',
        description: `Produce order ${order.orderNumber}`,
        order_id: order.razorpayOrderId,
        theme: { color: '#38A169' },
        handler: async (result) => {
          try {
            const verified = await PaymentService.verifyPayment(session, order.orderId, result);
            onSuccess(verified.orderNumber, order.amountPaise);
          } catch (error) {
            onError(error instanceof Error ? error.message : 'Payment verification failed.');
          }
        },
        modal: {
          ondismiss: () => onError('Payment cancelled.')
        },
      });
      checkout.on('payment.failed', (response) => {
        onError(response.error?.description || 'Payment failed. Please try again.');
      });
      checkout.open();
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Unable to open payment checkout.');
    }
  },

  recordPayment(entry: PaymentHistoryEntry) {
    const key = 'agriconnect_payment_history';
    const history = PaymentService.getPaymentHistory(entry.buyerEmail);
    localStorage.setItem(key, JSON.stringify([entry, ...history].slice(0, 50)));
  },

  getPaymentHistory(buyerEmail: string): PaymentHistoryEntry[] {
    try {
      const raw = localStorage.getItem('agriconnect_payment_history');
      const history = raw ? (JSON.parse(raw) as PaymentHistoryEntry[]) : [];
      return history.filter((entry) => entry.buyerEmail === buyerEmail);
    } catch {
      return [];
    }
  },
};