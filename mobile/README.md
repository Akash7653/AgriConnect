# AgriConnect Mobile

The Expo app provides account registration and login, product search, cart management, optional location-based delivery-address suggestions, buyer order history, and native Razorpay checkout.

New accounts must verify their email before signing in. Phone is optional and is not used for account verification. Open the Resend link in a browser, then return to the app to sign in; the verification email can be resent from the verification screen.

## Local setup

1. Copy `.env.example` to `.env` and set `EXPO_PUBLIC_API_BASE_URL` to the API origin including `/api`.
2. Install dependencies with `npm install`.
3. Start the Metro bundler with `npm start`.
4. Create a native development build with `npx expo prebuild` and the `ios`/`android` scripts.

Razorpay requires its native iOS/Android module, so checkout is not available in Expo Go. Test payments with Razorpay test credentials and a test order before using production keys. Location access is optional; users can always enter their delivery address manually.

Only public API URLs belong in `EXPO_PUBLIC_*` variables. Grok, Razorpay secret, MongoDB, JWT, and webhook credentials stay on the server.
