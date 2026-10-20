# Deployment

## Backend on Render

Set `NODE_ENV=production`, `MONGODB_URI`, `JWT_SECRET`, `CLIENT_URL`, `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, and `RAZORPAY_WEBHOOK_SECRET` in the backend service. The server trusts one Render proxy hop so rate limiting uses the forwarded client IP. `CLIENT_URL` must contain the full frontend origin, without a path or trailing slash (for example, `https://agri-connect-seven-snowy.vercel.app`). Multiple approved origins can be comma-separated. The deployed AgriConnect Vercel origin is also explicitly allowed by the server. Use a matching Razorpay mode pair; production requires `rzp_live_`.

For the agricultural assistant, set `GROK_API_KEY` as a backend-only secret. `GROK_MODEL` defaults to `grok-3-mini`. The assistant uses a multilingual general-guidance fallback if Grok is not configured or unavailable.

To enable automated farmer transfers, first have Razorpay activate Route and create/verify a linked account for each farmer. Set `RAZORPAY_ROUTE_ENABLED=true` only after a successful test-mode and production-mode review, then link each provider `acc_...` ID to the farmer with the verified admin endpoint `PATCH /api/admin/farmers/:farmerId/razorpay-account`. The worker only considers newly delivered orders marked eligible by the application; older ledger entries are not backfilled or paid automatically. Configure Razorpay webhooks as described in [Payments](./PAYMENTS.md).

For order-confirmation email, set `RESEND_API_KEY` and a verified `RESEND_FROM_EMAIL`. If absent, checkout still succeeds and email remains queued; configure the variables to start the outbox worker.

After deployment, check `/api/health`. It must report `Configured (Live Mode)` before accepting real payments. Configure the Razorpay webhook URL as `/api/payment/webhook` using the same mode as the API. Also verify the Render service is awake and returns `/api/health`; a sleeping or unavailable service can cause browser CORS errors even when its origin allowlist is correct.

For the first operations administrator, register a normal customer account, then run the one-time CLI with `ADMIN_BOOTSTRAP_EMAIL` set to that account email and the production `MONGODB_URI`/`JWT_SECRET` available to the command environment:

```bash
ADMIN_BOOTSTRAP_EMAIL=operator@example.com npm --prefix server run bootstrap:admin
```

This promotes an existing account, writes an audit entry, refuses seeded demo accounts, and does not create or delete account data.

## Frontend on Vercel

Build the `client` directory with `npm run build` and configure `VITE_API_BASE_URL` to the deployed API URL including `/api`. `client/vercel.json` rewrites client-side routes to `index.html` for BrowserRouter deep links.

Do not put private server secrets in Vite variables. The client obtains the public Razorpay key ID from the authenticated order-creation response.

## Expo mobile app

The Expo app is in `mobile/`. Copy `mobile/.env.example` to `mobile/.env`, set `EXPO_PUBLIC_API_BASE_URL` to the API URL including `/api`, then run `npm install` and `npx expo prebuild` from `mobile/`. Razorpay uses a native module and therefore requires an iOS/Android development build; it does not run inside Expo Go. Build and validate with the Razorpay test environment before configuring production credentials.
