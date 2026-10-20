# Location and Serviceability

The marketplace accepts a delivery address during checkout. Browser geolocation resolves through `POST /api/location/reverse-geocode` with JSON coordinates (`latitude`/`longitude`, or `lat`/`lon`). The browser requests location only after the user chooses the detect-location action; logging in does not silently trigger another lookup.

The serviceability and storefront endpoints are available:

- `GET /api/serviceability?city=...&state=...&pinCode=...` checks an address.
- `GET /api/storefront/products` returns a limited, public-safe set of active listings from verified farmers for the mobile guest storefront. Order placement still requires buyer authentication.
- `GET /api/storefront/campaigns` returns configured, currently active campaigns.
- `GET /api/admin/service-zones` lists zones for admins.
- `POST /api/admin/service-zones` creates a zone.
- `PATCH /api/admin/service-zones/:id` updates a zone.
- `DELETE /api/admin/service-zones/:id` deactivates a zone and writes an audit record.

If no active zones exist, the lookup reports that serviceability is not configured and preserves the existing checkout. Once any zone is configured, checkout rejects unsupported postal codes before stock reservation or payment creation.

The reverse-geocoding endpoint returns 400 for invalid coordinates, 422 when the provider cannot supply a usable address, 502 for provider/network errors, and 503 when the configured provider is unsupported or rate-limited. All failures leave manual address entry available. Outbound Nominatim lookups are spaced to respect its public usage policy. Server logs record sanitized provider failure categories and HTTP status, never coordinates.

The default provider is Nominatim. Set `GEOCODING_PROVIDER=nominatim`, `APP_BASE_URL` to the public application URL, and optionally `GEOCODING_CONTACT_EMAIL` so the provider can identify the service. Do not expose provider credentials in Vite variables. Nominatim's public service has no production SLA; for sustained production traffic, configure an appropriately licensed geocoding provider and observe its usage policy.
