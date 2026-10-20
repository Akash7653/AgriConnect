# AgriConnect Architecture

AgriConnect uses a React 18 + Vite + TypeScript web client, an Expo/React Native mobile app, and an Express + TypeScript API. MongoDB Atlas is the production database through Mongoose. The server also supports an in-memory MongoDB fallback for development and tests only.

The client calls the API under `/api`, authenticates with the existing JWT flow, and uses Socket.IO for realtime notifications. Payment creation and verification remain server-owned; the browser receives only the Razorpay public key ID and a server-calculated order amount.

The web client remains on Vite; the separate `mobile/` Expo app provides native authentication, marketplace browsing, cart, address assistance, order history, and Razorpay checkout. Native checkout requires an Expo development build rather than Expo Go.
