# Security Notes

- Keep `.env`, `server/.env`, and `client/.env` out of Git.
- Keep Razorpay private keys, JWT secrets, MongoDB credentials, webhook secrets, and future Resend/geocoding keys server-side.
- Configure `CLIENT_URL` as a comma-separated allowlist of approved frontend origins. CORS is not wildcard-enabled.
- Production refuses to start with a missing or failed MongoDB Atlas connection and never falls back to in-memory MongoDB.
- Payment amounts, inventory, ownership, and payment signatures are validated server-side.
- Do not treat a browser callback as payment proof; only verified server state confirms payment.

Rotate any credential that has appeared in Git history or a public log. Removing a secret from the current tree does not remove it from Git history.
