# AgriConnect — From Farm to Every Table
> **Full-Stack Real-Time SaaS Agricultural Marketplace Platform**  
> *Founder: Nandhu • Startup Proposal & Problem Statement Implementation (2026)*

[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18.3-61dafb.svg)](https://reactjs.org/)
[![Vite](https://img.shields.io/badge/Vite-6.1-646cff.svg)](https://vitejs.dev/)
[![Node.js](https://img.shields.io/badge/Node.js-20+-green.svg)](https://nodejs.org/)
[![Socket.IO](https://img.shields.io/badge/Socket.IO-4.8-black.svg)](https://socket.io/)
[![Tailwind CSS](https://img.shields.io/badge/TailwindCSS-3.4-38bdf8.svg)](https://tailwindcss.com/)
[![MongoDB](https://img.shields.io/badge/MongoDB-Atlas%20Ready-47A248.svg)](https://www.mongodb.com/)
[![Tests](https://img.shields.io/badge/Tests-Vitest%20Passing-brightgreen.svg)](https://vitest.dev/)

---

## 1. Executive Summary & Product Vision

India’s agricultural supply chain has historically been fragmented: farmers routinely depend on 4 to 5 layers of intermediaries, retaining barely **33% (tomatoes) to 37% (potatoes)** of the consumer rupee (RBI / PIB study benchmarks cited in the proposal).

**AgriConnect** directly connects farmers and Farmer Producer Organizations (FPOs) with households, restaurants, hotels, retail supermarkets, institutions, and cold-chain delivery fleets into a unified real-time SaaS commerce ecosystem.

### Core Principles
- **Radical Transparency**: 90% direct farmer payout share, 8% platform fee, 2% operations reserve, separate customer-paid delivery.
- **Real-Time Concurrency**: Atomic MongoDB stock reservations prevent overselling across concurrent buyers.
- **Multilingual Farm Co-Pilot**: Integrated AI Agricultural Advisor answering agronomic, pest, and mandi questions in **English**, **Telugu (తెలుగు)**, and **Hindi (हिंदी)**.
- **Ecosystem Portals**: Role-specific workflows for Farmers, Household Consumers, B2B Commercial Buyers (RFQs), Logistics Partners, and Platform Administrators.

---

## 2. Technology Stack

### Frontend
- **Framework**: React 18 + Vite + TypeScript
- **Styling**: Tailwind CSS + Custom Design System (Forest Green `#1b4332`, Emerald `#16a34a`, Warm Cream `#faf8f5`, and Dark Mode)
- **Icons**: Lucide React
- **Animations**: Framer Motion & Canvas Confetti
- **State & Context**: Custom React Contexts (Auth, Cart, Language, Theme)
- **Real-Time Client**: Socket.IO Client

### Backend
- **Runtime**: Node.js + Express + TypeScript
- **Database**: MongoDB Atlas + Mongoose ODM (with automatic fallback to in-memory MongoDB for instant zero-dependency local runs)
- **Real-Time Synchronization**: Socket.IO with role-restricted and user-private rooms
- **Security & Auth**: JWT (JSON Web Tokens), bcryptjs password hashing, helmet, cors
- **Validation**: Zod schema validation
- **Documentation**: OpenAPI 3.0 / Swagger UI at `/api-docs`
- **Testing**: Vitest + Supertest integration test suite

---

## 4. Transparent 90/8/2 Pricing Model

AgriConnect uses integer **paise** for all financial calculations to prevent floating point inaccuracies. An immutable pricing snapshot is committed with every order:

```typescript
// Example: ₹1,000 produce sale
Gross Product Value:       100,000 paise  (₹1,000.00)
------------------------------------------------------
Farmer / FPO Payout (90%):   90,000 paise  (₹900.00)  -> Direct Bank / UPI
AgriConnect Platform (8%):    8,000 paise    (₹80.00)  -> Platform, AI & operations
Payment / Ops Reserve (2%):   2,000 paise    (₹20.00)  -> Gateway fees & dispute buffer
Delivery Fee:                 4,000 paise    (₹40.00)  -> Free on orders > ₹500
------------------------------------------------------
Customer Final Payable:     104,000 paise  (₹1,040.00)
```

## Role access and combined-order fulfilment

| Account role | Dashboard and capabilities |
| --- | --- |
| Buyer | Browse the marketplace, manage the cart, check out, and view their own orders. |
| Business buyer | Use the buyer shopping and order workflow for business purchases. |
| Farmer | Overview, Crop Listings, Orders, Payouts, and Insights. Farmers manage only their own listings and stock; the farmer navigation does not include Marketplace. |
| Delivery partner | View and update only assigned delivery tasks, record pickup/dispatch, and submit recipient confirmation. |
| Admin | Review requested roles, monitor platform data, advance administrative order states, and assign or reassign eligible deliveries. |
| Applicant awaiting approval | Has buyer-level access until an admin approves the requested Farmer, Business, or Logistics role. The applicant must sign in again after approval to refresh the role in the client session. |

Guests can browse the public marketing page at `/` and the live catalogue at `/shop`; signing in is required to check out. A guest cart is carried into the buyer account at sign-in. Buyers get Home, Categories, Orders, and Cart in the mobile bottom navigation, while other roles keep their role-specific dashboard navigation.

### Order lifecycle

- Checkout validates catalogue stock, serviceability, and prices on the server. Razorpay orders reserve inventory while payment is pending; COD orders are not marked paid until cash collection is confirmed at delivery.
- A checkout containing items from multiple farmers remains one buyer order, one payment, and one combined delivery task.
- Each farmer can advance preparation only for their own items: `confirmed` → `accepted` → `preparing` → `ready_for_pickup`. The buyer-facing order advances through preparation only as the least-advanced seller group advances. A delivery partner can be assigned only after all seller groups are ready.
- The assigned delivery partner claims pickup, marks the order out for delivery, and completes it with recipient confirmation. COD completion additionally requires explicit confirmation that cash was collected. The current confirmation is not an OTP verification.
- Captured online orders accrue seller payout ledger entries and become eligible for automated settlement after delivery, subject to payout configuration and provider availability. COD settlement remains `on_hold` for manual settlement.
- Pending payment expiry releases reserved inventory. Refunds are initiated through the admin refund workflow and reconciled against provider confirmation; paid orders cannot be cancelled through the ordinary status endpoint.
- Older multi-farmer orders without seller-level preparation records are conservatively reconciled when a farmer loads their orders: preparation restarts from `confirmed` and requires each seller to confirm readiness before a new delivery assignment. Existing orders and records are retained.

---

## 5. Quick Start (Local Development)

### Prerequisites
- Node.js v18+ (tested on Node v20/v26)
- npm v9+

### 1. Installation
Clone the repository and install all dependencies:
```bash
git clone <repo-url>
cd AgriConnect

# Install server and client packages
npm run install:all
```

### 2. Environment Configuration
In development and tests, the server can use an in-memory MongoDB instance when `MONGODB_URI` is omitted or unavailable. Production requires MongoDB Atlas and will fail startup if it cannot connect. Seed data is development-only and is never automatically created in production.
To configure external services:
```bash
cp server/.env.example server/.env
```
Set `SEED_PASSWORD` in that local file before first startup if you want development seed accounts. Production never runs the seed script.
For first production admin provisioning, register the operator as a customer and run `ADMIN_BOOTSTRAP_EMAIL=<existing-account-email> npm --prefix server run bootstrap:admin` once in a trusted environment with production `MONGODB_URI` and `JWT_SECRET` available.

### Password recovery

The sign-in page provides a password reset flow. Configure the backend with a valid
`RESEND_API_KEY`, a verified `RESEND_FROM_EMAIL`, and `CLIENT_URL` set to the
deployed frontend origin (for example,
`https://agri-connect-seven-snowy.vercel.app`). Reset links expire after 30
minutes and can be used once. The API returns the same request message whether
or not an account exists for the submitted email. Never put Resend credentials
in `VITE_*` variables.

### Email verification

New accounts must verify their email before signing in. Configure backend-only
`RESEND_API_KEY`, `RESEND_FROM_EMAIL` (from a domain verified in Resend), and
`FRONTEND_URL` on Render. For production, set `FRONTEND_URL` to
`https://agri-connect-seven-snowy.vercel.app`. A phone number is optional and is
not part of account verification. See [deployment setup](./docs/DEPLOYMENT.md)
for cooldowns, sender restrictions, and safe legacy-account defaults.

### Destructive production data reset

This operation permanently deletes every document in the selected production database except the `User` record whose email is `akash@admin.com` and whose role is `admin`. It removes orders, crops, payments, payout ledgers, user accounts, audit logs, settings, and all other collection data. It does not drop collection indexes. Take and verify an Atlas backup first. Do not run this during normal deployment or unless the database name and retained admin account have been confirmed.

Run from the Render backend service shell after confirming the backup and exact Atlas database name. The service environment must already provide `MONGODB_URI`; never paste or print the URI. Replace `<exact-database-name>` in both values with the database name from the MongoDB URI:

```bash
NODE_ENV=production \
DATA_RESET_DATABASE_NAME='<exact-database-name>' \
DATA_RESET_CONFIRMATION='DELETE_ALL_NON_ADMIN_DATA:<exact-database-name>:akash@admin.com' \
npm --prefix server run reset:production-data
```

The command refuses to proceed if it is not in production mode, if the connected database name differs, if `akash@admin.com` is not an admin, or if the exact confirmation string is missing. It reports the number of records scheduled for deletion before acting and verifies the remaining database afterward. If this workspace has no production `MONGODB_URI`, the reset has not been run; use the Render shell with the service's configured environment after taking the backup.

### 3. Run Development Servers
```bash
# Concurrently launch Express backend on port 5000 and Vite frontend on port 3000
npm run dev
```

- **Frontend Application**: [http://localhost:3000](http://localhost:3000)
- **Backend API**: [http://localhost:5000/api](http://localhost:5000/api)
- **Interactive Swagger Docs**: [http://localhost:5000/api-docs](http://localhost:5000/api-docs)

### Storefront campaigns and delivery estimates

The mobile storefront has a swipeable campaign carousel backed by the public
`GET /api/storefront/campaigns` endpoint. Configure up to 10 campaigns in the
backend's `STOREFRONT_CAMPAIGNS_JSON` environment variable. Use valid, approved
campaign copy and HTTPS-hosted imagery; omit expired campaigns or set their
`startsAt` / `endsAt` timestamps in ISO 8601 format. The API filters campaigns
outside their configured date range. The storefront only displays a campaign
when its category has current catalogue listings. If no active campaigns are
configured, it shows a carousel built from real available listings instead.

Example Render backend environment value:

```json
[
  {
    "id": "vegetable-feature",
    "title": "Explore this week's vegetables",
    "description": "Browse current vegetables listed by AgriConnect farmers.",
    "imageUrl": "https://cdn.example.com/campaigns/vegetables.webp",
    "category": "vegetables",
    "ctaLabel": "Browse vegetables",
    "startsAt": "2026-10-01T00:00:00.000Z",
    "endsAt": "2026-11-01T00:00:00.000Z"
  }
]
```

The supported category values are `vegetables`, `fruits`, `grains`, `pulses`,
`spices`, `herbs`, `dairy`, and `organic-special`. Invalid campaign JSON or
fields cause the campaigns endpoint to return an error rather than silently
displaying malformed content. Campaign copy is operator-configured; do not
claim a discount, stock level, seller endorsement, or delivery promise unless
the corresponding information is verified.

Delivery estimates are configured per service zone using the existing
administrator API. Include `estimatedDeliveryDays` (an integer from 1 to 30)
when creating or updating a zone, for example:

```json
{
  "name": "Hyderabad Central",
  "city": "Hyderabad",
  "state": "Telangana",
  "postalCodes": ["500081"],
  "active": true,
  "estimatedDeliveryDays": 2,
  "fulfilmentMethods": ["supplier_delivery"]
}
```

The public `GET /api/serviceability?city=...&state=...&pinCode=...` response
includes the estimate only for a matching active zone. The storefront and
checkout describe it as an estimate after order confirmation, not a guarantee.
If a zone has no estimate configured, no delivery time is promised. Service
zone availability and order creation continue to be verified by the backend.

---

## 6. Razorpay Payment Integration

AgriConnect integrates official Razorpay Standard Checkout with cryptographic server-side HMAC SHA256 payment verification and concurrency-safe atomic inventory reservation. Development may use Test Mode; production requires Live Mode credentials.

### Backend Environment Variables
```env
MONGODB_URI=mongodb+srv://<username>:<password>@<cluster>.mongodb.net/<database>
PORT=5000
JWT_SECRET=replace_with_at_least_32_random_characters
CLIENT_URL=http://localhost:3000
NODE_ENV=development

# Razorpay Live Credentials (kept strictly on the backend)
RAZORPAY_KEY_ID=your_live_key_id
RAZORPAY_KEY_SECRET=your_live_key_secret
RAZORPAY_WEBHOOK_SECRET=your_webhook_secret
```

### Enable live payments on Render

Live payments can charge real customers. Keep local development on Razorpay Test
Mode and change only the production backend after confirming the Razorpay live
account, website checkout, order fulfilment, refund process, and support
contacts are ready.

1. In the Razorpay Dashboard, switch to **Live Mode** and copy the Live Key ID
   and Key Secret. Live Key IDs start with `rzp_live_`. Never use Test Mode
   credentials for this deployment.
2. In the Render dashboard, open the production backend service's **Environment**
   settings. Set:

   ```env
   NODE_ENV=production
   RAZORPAY_KEY_ID=rzp_live_<your_live_key_id>
   RAZORPAY_KEY_SECRET=<your_live_key_secret>
   RAZORPAY_WEBHOOK_SECRET=<the_live_webhook_secret_configured_below>
   ```

   Add the real values directly in Render's secret environment-variable form;
   do not commit them, put them in Vite/`VITE_*` variables, paste them into
   source files, or share them in chat. `RAZORPAY_KEY_ID` is sent by the
   backend to Razorpay Checkout as its public identifier; the Key Secret and
   Webhook Secret must remain backend-only.
3. In the Razorpay Dashboard, still in **Live Mode**, configure the webhook
   URL as `https://<your-production-api-host>/api/payment/webhook`. Generate a
   dedicated webhook secret, enter that exact secret as
   `RAZORPAY_WEBHOOK_SECRET` in Render, and enable the payment events used by
   the application (`payment.captured`, `payment.failed`, and `order.paid`).
   Test-mode and live-mode webhook secrets are different.
4. Save the Render environment changes and allow the production service to
   redeploy/restart. The backend initializes its Razorpay client from these
   variables at runtime. In `NODE_ENV=production`, payment operations refuse
   a key ID that does not begin with `rzp_live_`.
5. Confirm the Render deployment is healthy, then place one low-value,
   authorized real order and verify its captured status and webhook
   reconciliation in the Razorpay Dashboard and AgriConnect order record.
   Verify the refund workflow with an appropriate real refund before promoting
   broader traffic. Refunds reverse real money and should be performed only
   with authorization.

The app does not need the Key Secret or Webhook Secret in Vercel. Do not switch
the frontend to a live key manually: it receives the Checkout Key ID from the
backend when an order is created. To return production to Test Mode, first
disable real checkout, replace the backend credentials with the matching Test
credentials only in a non-production environment, and do not set production
`NODE_ENV` with Test credentials—the server intentionally rejects that
combination.

### Payment Lifecycle & Concurrency Protection
1. **Pay Now & Order Creation (`POST /api/payment/create-order`)**:
   - Calculates total amount on the server from DB-persisted prices, delivery fees, and platform splits in integer **paise**.
   - Concurrency-safe atomic stock reservation (`$inc: { availableQuantity: -qty, reservedQuantity: +qty }`).
   - Generates a Razorpay order using development Test Mode or production Live Mode credentials.
2. **Standard Razorpay Modal**:
   - Pops up official Razorpay Modal (`checkout.js`) with the server-configured public key ID.
3. **Server-Side Cryptographic Verification (`POST /api/payment/verify`)**:
   - Computes `crypto.createHmac('sha256', secret).update(order_id + '|' + payment_id).digest('hex')`.
   - Compares with constant-time equality check (`crypto.timingSafeEqual`).
   - If invalid or cancelled, atomically releases reserved stock back to available inventory.
   - If valid, updates order to `confirmed`, creates transparent 90/8/2 farmer Payout Ledgers, and emits real-time Socket.IO notifications to farmer and buyer.
   - Fully idempotent: duplicate verification calls return success safely without double charges.

### Implemented Webhook Endpoint (Deferred Setup)
- **Endpoint Route**: `POST /api/payment/webhook`
- **Current Behavior**: Fails closed (returns `503 Service Unavailable`) when `RAZORPAY_WEBHOOK_SECRET` is placeholder (`your_webhook_secret`), preventing unauthorized execution while keeping development completely unblocked.
- **Raw Body Handling**: Express JSON middleware extracts raw request buffer into `req.rawBody` for cryptographic signature verification.
- **Event Deduplication**: Webhook events are deduplicated via MongoDB `WebhookEvent` model.
- **Supported Events**: `payment.captured`, `payment.failed`, `order.paid`.

### How to Configure Webhook After Backend Deployment
1. Deploy your backend to your cloud host (Render, Railway, AWS).
2. Obtain your production backend URL (e.g. `https://api.agriconnect.in`).
3. In the Razorpay Dashboard, select the same mode as the deployed backend and open Settings -> Webhooks:
   - **Webhook URL**: `https://api.agriconnect.in/api/payment/webhook`
   - **Secret**: Generate a strong random secret.
   - **Active Events**: Check `payment.captured`, `payment.failed`, and `order.paid`.
4. Add the generated secret to your deployed backend environment as `RAZORPAY_WEBHOOK_SECRET`.
5. Trigger test webhook events in the dashboard to verify end-to-end reconciliation.

---

## 7. Cinematic 3D Website & Mobile Down-Nav

AgriConnect features a world-class, cinematic 3D digital experience:
- **3D Hero Scene**: Procedural green rolling hills, terraced crop rows, animated windmill with rotating blades, meandering river with specular reflections, floating produce with mouse parallax, and floating golden pollen particles.
- **Interactive Supply Chain Transformation**: Interactive 3D scene comparing traditional fragmented mandi chains (5 middlemen, 40% loss) vs AgriConnect's direct connected network.
- **Freshness in Motion**: 360° interactive 3D produce inspector for Alphonso Mango, Heirloom Tomato, Crisp Pepper, and Sharbati Wheat with GI-tag quality metadata.
- **Mobile buyer navigation**: A fixed, safe-area-aware bottom bar provides Home, Categories, Orders, and Cart with the current cart count. The account/profile menu remains in the top header; farmers, administrators, and delivery partners use role-specific dashboard navigation.

---

## 8. Automated Testing

Run the full integration test suite:
```bash
npm test
# Or inside the server directory:
cd server && npm test
```
**Test Coverage (11 Tests Across 2 Suites)**:
1. `src/tests/agriconnect.test.ts`:
   - Role authentication & JWT tokens
   - Crop inventory publication
   - Atomic reservation preventing overselling
   - Transparent 90/8/2 fee splits & Admin analytics
   - Multilingual AI advisor responses
2. `src/tests/payment.test.ts`:
   - Server-side order amount calculation in integer paise
   - Concurrency-safe atomic stock reservation
   - Cryptographic signature rejection & stock release
   - Genuine HMAC SHA256 payment verification & idempotent reconciliation
   - Fail-closed webhook security verification

---

## 9. Verification Summary

- [x] **Razorpay Checkout**: Test Mode integration with server order creation & cryptographic HMAC verification.
- [x] **Stock Safety**: Atomic stock reservation and rollback on failure.
- [x] **Webhook Security**: Fail-closed raw body verification and deduplication implemented.
- [x] **Cinematic 3D Transformation**: Three.js / React Three Fiber interactive farm environment.
- [x] **Mobile Responsiveness**: Dedicated Liquid Glass bottom down-nav bar with live cart badge.
- [x] **Full-Stack SaaS Preservation**: Marketplaces, dashboards, cart, real-time Socket.IO, and transparent payouts intact.
- [x] **11 Automated Tests Passing**: Verified with Vitest.

---
*AgriConnect — One Connected Network. Every Farm. Every Buyer. Fresher Food. Fairer Value.*
