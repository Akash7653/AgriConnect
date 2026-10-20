# Deployment

## Backend on Render

Set `NODE_ENV=production`, `MONGODB_URI`, `JWT_SECRET`, `CLIENT_URL`, `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, and `RAZORPAY_WEBHOOK_SECRET` in the backend service. Use a matching Razorpay mode pair; production requires `rzp_live_`.

After deployment, check `/api/health`. It must report `Configured (Live Mode)` before accepting real payments. Configure the Razorpay webhook URL as `/api/payment/webhook` using the same mode as the API.

For the first operations administrator, register a normal customer account, then run the one-time CLI with `ADMIN_BOOTSTRAP_EMAIL` set to that account email and the production `MONGODB_URI`/`JWT_SECRET` available to the command environment:

```bash
ADMIN_BOOTSTRAP_EMAIL=operator@example.com npm --prefix server run bootstrap:admin
```

This promotes an existing account, writes an audit entry, refuses seeded demo accounts, and does not create or delete account data.

## Frontend on Vercel

Build the `client` directory with `npm run build` and configure `VITE_API_BASE_URL` to the deployed API URL including `/api`. `client/vercel.json` rewrites client-side routes to `index.html` for BrowserRouter deep links.

Do not put private server secrets in Vite variables. The client obtains the public Razorpay key ID from the authenticated order-creation response.
