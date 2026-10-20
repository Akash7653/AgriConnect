# Location and Serviceability

The current marketplace accepts a delivery address during checkout. Browser geolocation now resolves through the server endpoint `GET /api/location/reverse-geocode?latitude=...&longitude=...` using the configured geocoding provider. Delivery ETA calculation is not yet implemented.

The first serviceability slice is now available:

- `GET /api/serviceability?city=...&state=...&pinCode=...` checks an address.
- `GET /api/admin/service-zones` lists zones for admins.
- `POST /api/admin/service-zones` creates a zone.
- `PATCH /api/admin/service-zones/:id` updates a zone.
- `DELETE /api/admin/service-zones/:id` deactivates a zone and writes an audit record.

If no active zones exist, the lookup reports that serviceability is not configured and preserves the existing checkout. Once any zone is configured, checkout rejects unsupported postal codes before stock reservation or payment creation.

Until those workflows are implemented, the API must not claim location-derived coverage or delivery promises. The next implementation should add a server-side geocoding adapter, manual PIN/city fallback, service-zone records, and tests for denied permission, geocoding failure, unsupported zones, and confirmed addresses.

The default provider is Nominatim. Configure `GEOCODING_PROVIDER` and `APP_BASE_URL`; do not expose a provider key in Vite variables. Respect the provider's rate limits and usage policy before production traffic.
