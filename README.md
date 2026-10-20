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

## 3. Demo Accounts & One-Click Role Switcher

The application includes a **Top Demo Quick-Switcher** that allows instant switching between all 5 roles without typing passwords:

| Role | Demo Email | Password | Primary Feature Highlights |
| :--- | :--- | :--- | :--- |
| **👑 Admin** | `admin@agriconnect.in` | `AgriConnect2026!` | GMV tracking, 90/8/2 fee configuration, Farmer KYC approval, Audit logs |
| **🌾 Farmer (FPO Lead)** | `farmer@agriconnect.in` | `AgriConnect2026!` | Publish crop batches, concurrency inventory, order fulfillment, 90% transparent payout ledger |
| **🛒 Household Buyer** | `buyer@agriconnect.in` | `AgriConnect2026!` | Fresh produce catalog, real-time cart, slot checkout, live delivery stepper, tax invoices |
| **🏨 B2B Buyer** | `business@agriconnect.in` | `AgriConnect2026!` | Commercial bulk purchasing, RFQ quote requests, recurring schedules, GST invoices |
| **🚚 Logistics Partner** | `logistics@agriconnect.in` | `AgriConnect2026!` | Farm gate collections, transit dispatch, proof of delivery (signature/OTP), status broadcasts |

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
The server automatically falls back to an in-memory MongoDB instance for instant local development if `MONGODB_URI` is omitted.
To configure external services:
```bash
cp server/.env.example server/.env
```

### 3. Run Development Servers
```bash
# Concurrently launch Express backend on port 5000 and Vite frontend on port 3000
npm run dev
```

- **Frontend Application**: [http://localhost:3000](http://localhost:3000)
- **Backend API**: [http://localhost:5000/api](http://localhost:5000/api)
- **Interactive Swagger Docs**: [http://localhost:5000/api-docs](http://localhost:5000/api-docs)

---

## 6. Razorpay Payment Integration

AgriConnect integrates official Razorpay Standard Checkout with cryptographic server-side HMAC SHA256 payment verification and concurrency-safe atomic inventory reservation. Development may use Test Mode; production requires Live Mode credentials.

### Backend Environment Variables
```env
MONGODB_URI=mongodb+srv://rajeshamkoravena111_db_user:lhPRX2lVqtyQLZOK@cluster0.acyhioz.mongodb.net/?appName=Cluster0
PORT=5000
JWT_SECRET=agriconnect_super_secret_jwt_key_2026_production
CLIENT_URL=http://localhost:3000
NODE_ENV=development

# Razorpay Live Credentials (kept strictly on the backend)
RAZORPAY_KEY_ID=your_live_key_id
RAZORPAY_KEY_SECRET=your_live_key_secret
RAZORPAY_WEBHOOK_SECRET=your_webhook_secret
```

### Payment Lifecycle & Concurrency Protection
1. **Pay Now & Order Creation (`POST /api/payment/create-order`)**:
   - Calculates total amount on the server from DB-persisted prices, delivery fees, and platform splits in integer **paise**.
   - Concurrency-safe atomic stock reservation (`$inc: { availableQuantity: -qty, reservedQuantity: +qty }`).
   - Generates authentic Razorpay test order.
2. **Standard Razorpay Modal**:
   - Pops up official Razorpay Modal (`checkout.js`) with public Test Key ID.
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
3. In the Razorpay Dashboard (Test Mode -> Settings -> Webhooks):
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
- **Mobile Down-Nav**: Liquid Glass bottom navigation bar visible on mobile viewports with quick access to Home, Market, Cart (with live badge), B2B, and Profile.

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
