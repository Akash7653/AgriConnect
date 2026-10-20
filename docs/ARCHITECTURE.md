# AgriConnect Architecture

AgriConnect currently uses a React 18 + Vite + TypeScript client and an Express + TypeScript API. MongoDB Atlas is the production database through Mongoose. The server also supports an in-memory MongoDB fallback for development and tests only.

The client calls the API under `/api`, authenticates with the existing JWT flow, and uses Socket.IO for realtime notifications. Payment creation and verification remain server-owned; the browser receives only the Razorpay public key ID and a server-calculated order amount.

The repository is intentionally not being migrated to Next.js or Expo in this phase. A disruptive framework migration would risk the working marketplace, dashboards, and payment integration.
