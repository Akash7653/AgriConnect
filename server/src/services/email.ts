import { EmailOutbox } from '../models/EmailOutbox.js';
import { Order } from '../models/Order.js';
import { User } from '../models/User.js';

export async function queueOrderConfirmation(orderId: string): Promise<void> {
  await EmailOutbox.updateOne(
    { eventKey: `order-confirmation:${orderId}` },
    { $setOnInsert: { eventKey: `order-confirmation:${orderId}`, type: 'order_confirmation', orderId, status: 'queued', attempts: 0, nextAttemptAt: new Date() } },
    { upsert: true }
  );
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character] || character));
}

export async function processEmailOutbox(now = new Date()): Promise<number> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !from) return 0;

  let sent = 0;
  for (let batch = 0; batch < 20; batch++) {
    const item = await EmailOutbox.findOneAndUpdate(
      {
        $or: [
          { status: 'queued', nextAttemptAt: { $lte: now } },
          { status: 'sending', leaseUntil: { $lte: now } },
        ],
      },
      { $set: { status: 'sending', leaseUntil: new Date(now.getTime() + 60_000) } },
      { new: true, sort: { createdAt: 1 } }
    );
    if (!item) break;

    try {
      const [order, buyer] = await Promise.all([
        Order.findById(item.orderId).select('orderNumber pricing.finalPayablePaise items'),
        Order.findById(item.orderId).select('buyerId').then((value) => value ? User.findById(value.buyerId).select('email name') : null),
      ]);
      if (!order || !buyer?.email) throw new Error('Order recipient could not be resolved.');

      const orderNumber = escapeHtml(order.orderNumber);
      const name = escapeHtml(buyer.name);
      const total = (order.pricing.finalPayablePaise / 100).toFixed(2);
      const itemSummary = order.items.map((entry) => `${escapeHtml(entry.cropName)} × ${entry.quantity} ${escapeHtml(entry.unit)}`).join(', ');
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'Idempotency-Key': item.eventKey,
        },
        body: JSON.stringify({
          from,
          to: [buyer.email],
          subject: `AgriConnect order confirmed: ${orderNumber}`,
          html: `<p>Hello ${name},</p><p>Your payment is verified and order <strong>${orderNumber}</strong> is confirmed.</p><p>${itemSummary}</p><p>Total paid: INR ${total}</p>`,
          text: `Hello ${buyer.name}. Your payment is verified and order ${order.orderNumber} is confirmed. Items: ${itemSummary}. Total paid: INR ${total}.`,
        }),
        signal: AbortSignal.timeout(10_000),
      });
      const result = await response.json().catch(() => ({})) as { id?: string };
      if (!response.ok) throw new Error(`Resend request failed with status ${response.status}.`);

      await EmailOutbox.updateOne({ _id: item._id, status: 'sending' }, { $set: { status: 'sent', providerId: result.id, leaseUntil: null, lastError: null } });
      sent++;
    } catch (error) {
      const attempts = item.attempts + 1;
      const retryAt = new Date(now.getTime() + Math.min(60, 2 ** attempts) * 60_000);
      await EmailOutbox.updateOne(
        { _id: item._id, status: 'sending' },
        { $set: { status: attempts >= 6 ? 'dead' : 'queued', attempts, nextAttemptAt: retryAt, leaseUntil: null, lastError: error instanceof Error ? error.message.slice(0, 300) : 'Email delivery failed.' } }
      );
    }
  }
  return sent;
}
