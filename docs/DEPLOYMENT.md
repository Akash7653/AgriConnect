# Deployment

## Backend on Render

Set `NODE_ENV=production`, `MONGODB_URI`, `JWT_SECRET`, `CLIENT_URL`, `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, and `RAZORPAY_WEBHOOK_SECRET` in the backend service. The server trusts one Render proxy hop so rate limiting uses the forwarded client IP. `CLIENT_URL` must contain the full frontend origin, without a path or trailing slash (for example, `https://agri-connect-seven-snowy.vercel.app`). Multiple approved origins can be comma-separated. The deployed AgriConnect Vercel origin is also explicitly allowed by the server. Use a matching Razorpay mode pair; production requires `rzp_live_`.

For the agricultural assistant, set `XAI_API_KEY` as a backend-only Render secret. `XAI_MODEL` defaults to `grok-4.7` (listed in xAI's current model documentation); the server also accepts the legacy `GROK_API_KEY` variable during migration. The integration uses xAI's recommended `POST /v1/responses` endpoint with `max_output_tokens` and `store: false` so prompts and model outputs are not retained by the provider. Never use a `VITE_` or `EXPO_PUBLIC_` variable for the key. Check `/api/ai/status` after deployment to confirm backend configuration without making a paid inference request; this does not validate the key or billing access. The advisor endpoint is `/api/ai/advisor`; provider failures return a friendly retryable fallback rather than provider diagnostics, while server logs contain only sanitized provider status/category details.

Reverse geocoding uses Nominatim by default. Keep `GEOCODING_PROVIDER=nominatim`, set `APP_BASE_URL` to the deployed API base, and optionally set `GEOCODING_CONTACT_EMAIL` so the provider can identify the application. The API validates coordinates, limits concurrent provider calls to a bounded queue, applies a single delayed retry to temporary upstream 5xx responses, respects `Retry-After`, and returns manual-entry guidance when lookup fails. Geocoding failure does not imply that delivery service is available; serviceability remains a separate checkout check.

Registration can immediately create buyer access or submit a farmer, business-buyer, or delivery-partner access request. These requests remain buyer accounts until an administrator approves the requested role in the operations dashboard; admin access cannot be requested through public registration. Farmer approval also requires the administrator to enter farm details.

To enable automated farmer transfers, first have Razorpay activate Route and create/verify a linked account for each farmer. Set `RAZORPAY_ROUTE_ENABLED=true` only after a successful test-mode and production-mode review, then link each provider `acc_...` ID to the farmer with the verified admin endpoint `PATCH /api/admin/farmers/:farmerId/razorpay-account`. The worker only considers newly delivered orders marked eligible by the application; older ledger entries are not backfilled or paid automatically. Configure Razorpay webhooks as described in [Payments](./PAYMENTS.md).

For order-confirmation and account-verification email, set `RESEND_API_KEY` and a verified `RESEND_FROM_EMAIL`. Set `FRONTEND_URL` to the frontend origin used in verification links (for production, `https://agri-connect-seven-snowy.vercel.app`). Keep all three values on the Render backend; never expose the API key through Vercel/Vite variables. `CLIENT_URL` remains the CORS allowlist setting and is separate from `FRONTEND_URL`.

New registrations require email verification only; the registration phone field is optional. Verification links expire after 30 minutes, are stored only as hashes, and can be consumed once. Resend requests use a 60-second per-account cooldown and an IP-based authentication rate limit. Resend responses do not reveal whether an email address has an account. Existing records with no `emailVerified` value remain treated as verified by the schema default to avoid locking out existing users; new registrations explicitly start unverified. The legacy `phoneVerified` field is retained for existing data but is not used to permit or deny sign-in.

Before production delivery, verify the sending domain in Resend and use a `RESEND_FROM_EMAIL` address on that verified domain. Resend's test sender can only deliver to permitted test recipients; it is not a substitute for verifying your own domain for general production recipients. A provider outage leaves the new account unverified and allows a retry from the verification page. Configure the variables in Render and redeploy before claiming production email delivery works.

For farmer product photos, create a Cloudinary account and set `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET` as backend-only Render environment variables. Never put the API secret in a Vite or Expo variable. Uploads are signed by the API, limited to JPEG/PNG/WebP images up to 5 MB, and attached to farmer-owned listings. Removing a listing archives it; order item snapshots remain intact.

After deployment, check `/api/health`. It must report `Configured (Live Mode)` before accepting real payments. Configure the Razorpay webhook URL as `/api/payment/webhook` using the same mode as the API. Also verify the Render service is awake and returns `/api/health`; a sleeping or unavailable service can cause browser CORS errors even when its origin allowlist is correct.

To provision the designated operations administrator, register a normal account for `akashkoravena@gmail.com`, complete email verification, then run the one-time CLI with the production `MONGODB_URI`/`JWT_SECRET` available to the operator's command environment:

```bash
ADMIN_BOOTSTRAP_EMAIL=akashkoravena@gmail.com npm --prefix server run bootstrap:admin
```

This operator-only command promotes that existing verified account, writes an audit entry, refuses seeded demo accounts, and does not create or delete account data. The application never grants administrator access based on a submitted email address.

## Frontend on Vercel

Build the `client` directory with `npm run build` and configure `VITE_API_BASE_URL` to the deployed API URL including `/api`. `client/vercel.json` rewrites client-side routes to `index.html` for BrowserRouter deep links.

Do not put private server secrets in Vite variables. The client obtains the public Razorpay key ID from the authenticated order-creation response.

## Optional Cloudflare domain preparation

No domain or DNS changes are made by this repository. First use a domain you own and add it to Cloudflare. Add the frontend domain in Vercel and copy the exact DNS records Vercel provides into Cloudflare; do not guess A/CNAME targets. Follow Vercel's current guidance for whether those records may be proxied, and validate the domain in Vercel before switching production traffic. If using `api.<your-domain>`, first add and validate that custom domain in Render, then update `VITE_API_BASE_URL`, backend `CLIENT_URL`/allowed origins, and the frontend Content Security Policy to match. Verify HTTPS, API health, CORS preflight, and Socket.IO before any DNS cutover. Leave the existing production DNS and service URLs unchanged until the domain owner explicitly approves a migration.

## Expo mobile app

The Expo app is in `mobile/`. Copy `mobile/.env.example` to `mobile/.env`, set `EXPO_PUBLIC_API_BASE_URL` to the API URL including `/api`, then run `npm install` and `npx expo prebuild` from `mobile/`. Razorpay uses a native module and therefore requires an iOS/Android development build; it does not run inside Expo Go. Build and validate with the Razorpay test environment before configuring production credentials.
