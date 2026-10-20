# Testing

Run the full backend suite:

```bash
npm test
```

Run compile checks:

```bash
npm --prefix server run build
npm --prefix client run typecheck
npm --prefix client run build
```

The current suite covers authentication, role access, inventory reservation, payment order creation, invalid signature rejection with stock release, valid HMAC verification, idempotency, webhook signature rejection, admin role approval, and delivery assignment/completion. Tests use isolated in-memory MongoDB and per-process test seed credentials.

Run automated browser checks for browser geolocation permission and mobile-width fallback behavior with:

```bash
npm --prefix client run test:e2e
```

Install Playwright's Chromium binary once with `npx playwright install chromium` if the runner reports it missing. These tests mock only the crop and reverse-geocoding API calls and verify both granted and denied permission flows.

Run the Expo type check after installing the mobile dependencies with `npm --prefix mobile install`:

```bash
npm --prefix mobile run typecheck
```

Refund provider/webhook reconciliation, Resend delivery against the live provider, and native iOS/Android checkout still require provider credentials and device/development-build validation. Do not run live provider actions against production records during tests.
