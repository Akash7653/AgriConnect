# Database

MongoDB Atlas is the sole production application database. Mongoose models cover users, profiles, crop listings, orders, payments, payouts, notifications, disputes, RFQs, audit logs, and webhook events.

Prices are stored as integer paise. Order items freeze product, seller, unit, quantity, and unit price values. Production requires `MONGODB_URI`; the in-memory fallback is restricted to development and tests.

Before adding migrations, use additive, idempotent scripts and verify indexes against a staging Atlas database. Never delete production data as part of startup or seeding.
