# Payments

The web checkout uses Razorpay Standard Checkout.

## Flow

1. An authenticated buyer submits cart items and delivery details to `POST /api/payment/create-order`.
2. The server loads prices and inventory from MongoDB, reserves stock, calculates fees in paise, and creates the Razorpay order.
3. The browser opens `checkout.js` with the returned public key ID and Razorpay order ID.
4. The browser sends the three Razorpay result fields to `POST /api/payment/verify`.
5. The server verifies HMAC-SHA256 over `razorpay_order_id|razorpay_payment_id` before confirming the order.

Test credentials are permitted in development. Production requires a key beginning with `rzp_live_`. `RAZORPAY_KEY_SECRET` and `RAZORPAY_WEBHOOK_SECRET` must never be sent to the client.

The webhook endpoint is `POST /api/payment/webhook`. Configure a webhook secret and the `payment.captured`, `payment.failed`, and `order.paid` events before production use. Payment events are deduplicated by event ID.

The current seller payout model is an internal ledger. Razorpay does not automatically split marketplace funds between farmers.
