# Payments

The web checkout uses Razorpay Standard Checkout.

## Flow

1. An authenticated buyer submits cart items and delivery details to `POST /api/payment/create-order`.
2. The server loads prices and inventory from MongoDB, reserves stock, calculates fees in paise, and creates the Razorpay order.
3. The browser opens `checkout.js` with the returned public key ID and Razorpay order ID.
4. The browser sends the three Razorpay result fields to `POST /api/payment/verify`.
5. The server verifies HMAC-SHA256 over `razorpay_order_id|razorpay_payment_id` before confirming the order.

Test credentials are permitted in development. Production requires a key beginning with `rzp_live_`. `RAZORPAY_KEY_SECRET` and `RAZORPAY_WEBHOOK_SECRET` must never be sent to the client.

The webhook endpoint is `POST /api/payment/webhook` (for the current Render deployment: `https://agriconnect-api-ajoq.onrender.com/api/payment/webhook`). In Razorpay Dashboard → Account & Settings → Webhooks, configure that exact URL, choose the same test/live mode as the API, and set a long random webhook secret in both Razorpay and the Render environment variable `RAZORPAY_WEBHOOK_SECRET`. Subscribe to `payment.captured`, `payment.failed`, `order.paid`, `refund.created`, `refund.processed`, `refund.failed`, `transfer.processed`, `transfer.failed`, and `transfer.reversed`. Events are verified against the raw request body and deduplicated by `x-razorpay-event-id`; failed processing is retryable by Razorpay.

The current seller payout model is an internal ledger. Razorpay does not automatically split marketplace funds between farmers.

Admin refunds are limited to captured, unfulfilled orders. Refund state is reported as successful only after Razorpay reports `processed`; pending provider refunds are reconciled from webhooks. Refunds restore reserved inventory transactionally and append negative ledger adjustments without rewriting sale entries.

## Automated farmer payouts (Razorpay Route)

Automated transfers are disabled unless `RAZORPAY_ROUTE_ENABLED=true`. Razorpay Route activation and a verified linked account (`acc_...`) for each farmer are prerequisites. A verified admin can link the ID using `PATCH /api/admin/farmers/:farmerId/razorpay-account` with `{ "razorpayAccountId": "acc_..." }`. The transfer worker only considers ledger entries explicitly marked eligible when an order is delivered after the feature is enabled. It reconciles existing transfers before creating a new transfer and holds failed/reversed transfers for manual review. Transfer webhooks update eligible ledgers; the worker also polls Route as a recovery path. This feature must be tested with Razorpay Route test accounts before production activation.
