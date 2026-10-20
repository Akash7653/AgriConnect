# Security Notes

- Keep `.env`, `server/.env`, and `client/.env` out of Git.
- Keep Grok, Razorpay private keys, JWT secrets, MongoDB credentials, webhook secrets, Resend, and geocoding keys server-side.
- Configure `CLIENT_URL` as a comma-separated allowlist of approved frontend origins. CORS is not wildcard-enabled.
- Production refuses to start with a missing or failed MongoDB Atlas connection and never falls back to in-memory MongoDB.
- Payment amounts, inventory, ownership, and payment signatures are validated server-side.
- Do not treat a browser callback as payment proof; only verified server state confirms payment.
- Web access tokens are currently stored in `localStorage` and expire after 15 minutes. A successful XSS could steal an active token; migrate to HTTP-only, Secure, SameSite cookies with CSRF protection and a refresh flow before treating this as hardened production auth.
- The in-memory rate-limit store is per process. Multi-instance production deployments need a shared rate-limit store.

Rotate any credential that has appeared in Git history or a public log. Removing a secret from the current tree does not remove it from Git history.
