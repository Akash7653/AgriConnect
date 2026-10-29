# AgriConnect Client

This folder contains both the Vite web client and Expo native app. The web app lives in `src/`; the Expo entry point is `App.tsx`.

## Web

Run the web client with `npm run dev`, type-check it with `npm run typecheck`, and build it with `npm run build`. Set `VITE_API_BASE_URL` to the API URL including `/api` when it differs from the configured deployment.

On Vercel, the web app uses `api/reverse-geocode.js` as a same-origin Photon proxy for location lookup, then falls back to the configured backend. Product images use Cloudinary when all three Cloudinary credentials are configured on the backend; otherwise they are stored persistently in MongoDB GridFS.

## Expo native app

1. Copy `.env.example` to `.env`. The native app defaults to the deployed AgriConnect API; set `EXPO_PUBLIC_API_BASE_URL` to another backend URL including `/api` when needed.
2. Install dependencies in this folder with `npm install`.
3. Start Expo with `npm run start:native`.
4. Create native project files with `npm run native:prebuild`, then use `npm run ios` or `npm run android`.

Run `npm run typecheck:native` to check the Expo app. Razorpay requires its native iOS/Android module, so checkout is not available in Expo Go. Test payments with Razorpay test credentials before using production keys. Location access is optional; users can enter a delivery address manually.

Only public API URLs belong in `EXPO_PUBLIC_*` variables. Grok, Razorpay secret, MongoDB, JWT, and webhook credentials stay on the server.
