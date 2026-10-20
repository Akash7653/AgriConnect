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

Not yet covered: location permission/serviceability flows, refund transitions, reservation expiry jobs, Resend notification delivery, B2B quote lifecycle end to end, and mobile/Expo flows.
