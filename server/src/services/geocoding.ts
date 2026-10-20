import { z } from 'zod';

export interface ReverseGeocodeResult {
  city: string;
  district: string;
  state: string;
  pinCode: string;
  country?: string;
  displayName: string;
}

type GeocodingErrorCategory =
  | 'unsupported_provider'
  | 'provider_busy'
  | 'timeout'
  | 'network_error'
  | 'rate_limited'
  | 'provider_unavailable'
  | 'provider_error'
  | 'malformed_response'
  | 'incomplete_result';

export class GeocodingError extends Error {
  constructor(
    public readonly statusCode: 422 | 502 | 503,
    public readonly category: GeocodingErrorCategory,
    message: string,
    public readonly retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = 'GeocodingError';
  }
}

const PROVIDER_FAILURE_MESSAGE = 'Address lookup is temporarily unavailable. Enter your delivery address manually or try again.';
const INCOMPLETE_ADDRESS_MESSAGE = 'We could not identify a complete delivery address. Enter your city and PIN code manually.';
const MAX_QUEUE_WAIT_MS = 5_000;
const MAX_RETRY_AFTER_MS = 3_000;
const REQUEST_TIMEOUT_MS = 5_000;
let nextNominatimRequestAt = 0;

const nominatimResponseSchema = z.object({
  display_name: z.string().optional(),
  address: z.object({
    city: z.string().optional(),
    town: z.string().optional(),
    village: z.string().optional(),
    municipality: z.string().optional(),
    suburb: z.string().optional(),
    neighbourhood: z.string().optional(),
    county: z.string().optional(),
    state_district: z.string().optional(),
    state: z.string().optional(),
    postcode: z.string().optional(),
    country: z.string().optional(),
  }).optional(),
}).passthrough();

function logProviderFailure(details: {
  provider: string;
  category: GeocodingErrorCategory;
  status?: number;
  requestId?: string;
  durationMs: number;
}): void {
  console.warn('[location] Reverse-geocoding provider failure', details);
}

function requestIdFrom(response: Response): string | undefined {
  const value = response.headers.get('x-request-id') || response.headers.get('request-id');
  return value && /^[A-Za-z0-9._:-]{1,200}$/.test(value) ? value : undefined;
}

function retryAfterMilliseconds(response: Response): number | undefined {
  const value = response.headers.get('retry-after')?.trim();
  if (!value) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.ceil(seconds * 1000);
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? Math.max(0, timestamp - Date.now()) : undefined;
}

async function waitForNominatimSlot(): Promise<void> {
  const now = Date.now();
  const waitMs = Math.max(0, nextNominatimRequestAt - now);
  if (waitMs > MAX_QUEUE_WAIT_MS) {
    throw new GeocodingError(503, 'provider_busy', PROVIDER_FAILURE_MESSAGE, Math.ceil(waitMs / 1000));
  }
  nextNominatimRequestAt = Math.max(now, nextNominatimRequestAt) + 1100;
  if (waitMs > 0) await new Promise((resolve) => setTimeout(resolve, waitMs));
}

function failure(
  provider: string,
  category: GeocodingErrorCategory,
  statusCode: 422 | 502 | 503,
  startedAt: number,
  options: { status?: number; requestId?: string; retryAfterSeconds?: number; message?: string } = {},
): GeocodingError {
  logProviderFailure({
    provider,
    category,
    ...(options.status ? { status: options.status } : {}),
    ...(options.requestId ? { requestId: options.requestId } : {}),
    durationMs: Date.now() - startedAt,
  });
  return new GeocodingError(
    statusCode,
    category,
    category === 'incomplete_result' ? INCOMPLETE_ADDRESS_MESSAGE : options.message || PROVIDER_FAILURE_MESSAGE,
    options.retryAfterSeconds,
  );
}

async function pauseBeforeRetry(retryAfterMs?: number): Promise<boolean> {
  const delay = retryAfterMs ?? 150 + Math.floor(Math.random() * 251);
  if (delay > MAX_RETRY_AFTER_MS) return false;
  await new Promise((resolve) => setTimeout(resolve, delay));
  return true;
}

export async function reverseGeocode(latitude: number, longitude: number): Promise<ReverseGeocodeResult> {
  const startedAt = Date.now();
  const provider = (process.env.GEOCODING_PROVIDER || 'nominatim').trim().toLowerCase();
  if (!['nominatim', 'openstreetmap', 'osm'].includes(provider)) {
    throw failure(provider, 'unsupported_provider', 503, startedAt);
  }

  const params = new URLSearchParams({
    format: 'jsonv2',
    addressdetails: '1',
    lat: latitude.toString(),
    lon: longitude.toString(),
  });
  const url = `https://nominatim.openstreetmap.org/reverse?${params}`;
  let response: Response | undefined;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      await waitForNominatimSlot();
    } catch (error) {
      if (error instanceof GeocodingError) {
        throw failure(provider, error.category, error.statusCode, startedAt, { retryAfterSeconds: error.retryAfterSeconds });
      }
      throw failure(provider, 'network_error', 502, startedAt);
    }

    try {
      response = await fetch(url, {
        headers: {
          'User-Agent': process.env.APP_BASE_URL
            ? `AgriConnect/1.0 (${process.env.APP_BASE_URL}${process.env.GEOCODING_CONTACT_EMAIL ? `; ${process.env.GEOCODING_CONTACT_EMAIL}` : ''})`
            : `AgriConnect/1.0${process.env.GEOCODING_CONTACT_EMAIL ? ` (${process.env.GEOCODING_CONTACT_EMAIL})` : ''}`,
          'Accept-Language': 'en',
        },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (error) {
      const category = error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')
        ? 'timeout'
        : 'network_error';
      throw failure(provider, category, 502, startedAt);
    }

    if (response.ok || response.status === 429 || response.status < 500 || attempt > 0) break;
    if (!await pauseBeforeRetry(retryAfterMilliseconds(response))) break;
  }

  if (!response) throw failure(provider, 'network_error', 502, startedAt);

  if (!response.ok) {
    const requestId = requestIdFrom(response);
    if (response.status === 429) {
      const retryAfterMs = retryAfterMilliseconds(response);
      throw failure(provider, 'rate_limited', 503, startedAt, {
        status: response.status,
        requestId,
        ...(retryAfterMs === undefined ? {} : { retryAfterSeconds: Math.ceil(retryAfterMs / 1000) }),
      });
    }
    const temporary = response.status >= 500;
    const retryAfterMs = retryAfterMilliseconds(response);
    throw failure(provider, temporary ? 'provider_unavailable' : 'provider_error', 502, startedAt, {
      status: response.status,
      requestId,
      ...(retryAfterMs === undefined ? {} : { retryAfterSeconds: Math.ceil(retryAfterMs / 1000) }),
    });
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw failure(provider, 'malformed_response', 502, startedAt, {
      status: response.status,
      requestId: requestIdFrom(response),
    });
  }

  const parsed = nominatimResponseSchema.safeParse(payload);
  if (!parsed.success) {
    throw failure(provider, 'malformed_response', 502, startedAt, {
      status: response.status,
      requestId: requestIdFrom(response),
    });
  }

  const address = parsed.data.address;
  const city = address?.city || address?.town || address?.village || address?.municipality || address?.suburb || address?.neighbourhood;
  const district = address?.county || address?.state_district || city;

  if (!city || !district || !address?.state || !address.postcode) {
    throw failure(provider, 'incomplete_result', 422, startedAt, { status: response.status });
  }

  return {
    city,
    district,
    state: address.state,
    pinCode: address.postcode,
    ...(address.country ? { country: address.country } : {}),
    displayName: parsed.data.display_name || `${city}, ${address.state}`,
  };
}
