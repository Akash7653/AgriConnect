import { z } from 'zod';

export interface ReverseGeocodeResult {
  city: string;
  district: string;
  state: string;
  pinCode: string;
  displayName: string;
  line1: string;
  locality: string;
  lat: number;
  lng: number;
  source: 'google' | 'nominatim';
  country?: string;
}

type ProviderName = ReverseGeocodeResult['source'];
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
    public readonly statusCode: 400 | 422 | 502 | 503,
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
const CACHE_TTL_MS = 15 * 60_000;
const CACHE_LIMIT = 500;
let nextNominatimRequestAt = 0;
const cache = new Map<string, { value: ReverseGeocodeResult; expiresAt: number }>();
const inFlight = new Map<string, Promise<ReverseGeocodeResult>>();

const nominatimResponseSchema = z.object({
  display_name: z.string().optional(),
  address: z.object({
    house_number: z.string().optional(),
    road: z.string().optional(),
    pedestrian: z.string().optional(),
    residential: z.string().optional(),
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

const googleResponseSchema = z.object({
  status: z.string(),
  error_message: z.string().optional(),
  results: z.array(z.object({
    formatted_address: z.string().optional(),
    address_components: z.array(z.object({
      long_name: z.string(),
      short_name: z.string().optional(),
      types: z.array(z.string()),
    })).optional(),
  })).optional(),
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
  statusCode: 400 | 422 | 502 | 503,
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

function providerChain(): ProviderName[] {
  const canonical = (value: string | undefined): string | undefined => {
    const normalized = value?.trim().toLowerCase();
    if (normalized === 'openstreetmap' || normalized === 'osm') return 'nominatim';
    return normalized;
  };
  const legacyPrimary = canonical(process.env.GEOCODING_PROVIDER);
  const primary = (canonical(process.env.GEOCODER_PRIMARY)
    || legacyPrimary
    || (process.env.GOOGLE_MAPS_API_KEY ? 'google' : 'nominatim')) as ProviderName;
  const fallback = (canonical(process.env.GEOCODER_FALLBACK)
    || (primary === 'google' ? 'nominatim' : '')) as ProviderName | '';
  const chain = [primary, fallback].filter((provider): provider is ProviderName => Boolean(provider));
  if (chain.some((provider) => provider !== 'google' && provider !== 'nominatim') || new Set(chain).size !== chain.length) {
    throw new GeocodingError(503, 'unsupported_provider', PROVIDER_FAILURE_MESSAGE);
  }
  return chain;
}

function normalizedResult(args: {
  provider: ProviderName;
  latitude: number;
  longitude: number;
  city?: string;
  district?: string;
  state?: string;
  pinCode?: string;
  displayName?: string;
  line1?: string;
  locality?: string;
  country?: string;
}): ReverseGeocodeResult {
  const city = args.city?.trim();
  const district = args.district?.trim() || city;
  const state = args.state?.trim();
  const pinCode = args.pinCode?.trim();
  if (!city || !district || !state || !pinCode || !/^\d{6}$/.test(pinCode)) {
    throw new GeocodingError(422, 'incomplete_result', INCOMPLETE_ADDRESS_MESSAGE);
  }
  const displayName = args.displayName?.trim() || [args.line1, args.locality, city, state, pinCode].filter(Boolean).join(', ');
  return {
    city,
    district,
    state,
    pinCode,
    displayName,
    line1: args.line1?.trim() || displayName,
    locality: args.locality?.trim() || city,
    lat: args.latitude,
    lng: args.longitude,
    source: args.provider,
    ...(args.country ? { country: args.country } : {}),
  };
}

async function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
  return fetch(url, { ...init, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
}

async function reverseWithNominatim(latitude: number, longitude: number, startedAt: number): Promise<ReverseGeocodeResult> {
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
        throw failure('nominatim', error.category, error.statusCode, startedAt, { retryAfterSeconds: error.retryAfterSeconds });
      }
      throw failure('nominatim', 'network_error', 502, startedAt);
    }
    try {
      const identity = process.env.APP_BASE_URL
        ? `AgriConnect/1.0 (${process.env.APP_BASE_URL}${process.env.GEOCODING_CONTACT_EMAIL ? `; ${process.env.GEOCODING_CONTACT_EMAIL}` : ''})`
        : `AgriConnect/1.0${process.env.GEOCODING_CONTACT_EMAIL ? ` (${process.env.GEOCODING_CONTACT_EMAIL})` : ''}`;
      response = await fetchWithTimeout(url, {
        headers: { 'User-Agent': identity, 'Accept-Language': 'en' },
      });
    } catch (error) {
      const category = error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')
        ? 'timeout'
        : 'network_error';
      throw failure('nominatim', category, 502, startedAt);
    }
    if (response.ok || response.status === 429 || response.status < 500 || attempt > 0) break;
    if (!await pauseBeforeRetry(retryAfterMilliseconds(response))) break;
  }
  if (!response) throw failure('nominatim', 'network_error', 502, startedAt);
  if (!response.ok) {
    const retryAfterMs = retryAfterMilliseconds(response);
    throw failure(
      'nominatim',
      response.status === 429 ? 'rate_limited' : response.status >= 500 ? 'provider_unavailable' : 'provider_error',
      response.status === 429 ? 503 : 502,
      startedAt,
      {
        status: response.status,
        requestId: requestIdFrom(response),
        ...(retryAfterMs === undefined ? {} : { retryAfterSeconds: Math.ceil(retryAfterMs / 1000) }),
      },
    );
  }
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw failure('nominatim', 'malformed_response', 502, startedAt, { status: response.status });
  }
  const parsed = nominatimResponseSchema.safeParse(payload);
  if (!parsed.success) throw failure('nominatim', 'malformed_response', 502, startedAt);
  const address = parsed.data.address;
  const city = address?.city || address?.town || address?.village || address?.municipality
    || address?.suburb || address?.neighbourhood;
  const district = address?.county || address?.state_district || city;
  const line1 = [address?.house_number, address?.road || address?.pedestrian || address?.residential]
    .filter(Boolean).join(' ');
  try {
    return normalizedResult({
      provider: 'nominatim',
      latitude,
      longitude,
      city,
      district,
      state: address?.state,
      pinCode: address?.postcode,
      displayName: parsed.data.display_name,
      line1,
      locality: address?.suburb || address?.neighbourhood || city,
      country: address?.country,
    });
  } catch {
    throw failure('nominatim', 'incomplete_result', 422, startedAt, { status: response.status });
  }
}

async function reverseWithGoogle(latitude: number, longitude: number, startedAt: number): Promise<ReverseGeocodeResult> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) throw failure('google', 'provider_unavailable', 503, startedAt);
  const params = new URLSearchParams({ latlng: `${latitude},${longitude}`, key: apiKey, language: 'en' });
  let response: Response;
  try {
    response = await fetchWithTimeout(`https://maps.googleapis.com/maps/api/geocode/json?${params}`, {});
  } catch (error) {
    const category = error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')
      ? 'timeout'
      : 'network_error';
    throw failure('google', category, 502, startedAt);
  }
  if (!response.ok) {
    throw failure('google', response.status === 429 ? 'rate_limited' : 'provider_unavailable', response.status === 429 ? 503 : 502, startedAt, {
      status: response.status,
      requestId: requestIdFrom(response),
      ...(retryAfterMilliseconds(response) === undefined ? {} : {
        retryAfterSeconds: Math.ceil(retryAfterMilliseconds(response)! / 1000),
      }),
    });
  }
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw failure('google', 'malformed_response', 502, startedAt);
  }
  const parsed = googleResponseSchema.safeParse(payload);
  if (!parsed.success) throw failure('google', 'malformed_response', 502, startedAt);
  if (parsed.data.status !== 'OK' || !parsed.data.results?.length) {
    const category = parsed.data.status === 'OVER_QUERY_LIMIT' ? 'rate_limited' : 'provider_unavailable';
    throw failure('google', category, category === 'rate_limited' ? 503 : 502, startedAt);
  }
  const components = parsed.data.results[0].address_components ?? [];
  const component = (type: string) => components.find((item) => item.types.includes(type))?.long_name;
  const locality = component('sublocality_level_1') || component('neighborhood') || component('locality');
  const city = component('locality') || component('postal_town') || component('administrative_area_level_2') || locality;
  const district = component('administrative_area_level_2') || component('administrative_area_level_3') || city;
  const state = component('administrative_area_level_1');
  const pinCode = component('postal_code');
  const line1 = [component('street_number'), component('route')].filter(Boolean).join(' ');
  try {
    return normalizedResult({
      provider: 'google',
      latitude,
      longitude,
      city,
      district,
      state,
      pinCode,
      displayName: parsed.data.results[0].formatted_address,
      line1,
      locality,
      country: component('country'),
    });
  } catch {
    throw failure('google', 'incomplete_result', 422, startedAt);
  }
}

async function resolveWithChain(latitude: number, longitude: number): Promise<ReverseGeocodeResult> {
  const startedAt = Date.now();
  const chain = providerChain();
  let lastError: GeocodingError | undefined;
  for (const provider of chain) {
    try {
      return provider === 'google'
        ? await reverseWithGoogle(latitude, longitude, startedAt)
        : await reverseWithNominatim(latitude, longitude, startedAt);
    } catch (error) {
      lastError = error instanceof GeocodingError
        ? error
        : failure(provider, 'provider_unavailable', 502, startedAt);
    }
  }
  throw lastError ?? failure('nominatim', 'provider_unavailable', 503, startedAt);
}

export async function reverseGeocode(latitude: number, longitude: number): Promise<ReverseGeocodeResult> {
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90
    || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    throw new GeocodingError(400, 'provider_error', 'Location coordinates are invalid.');
  }
  const key = `${latitude.toFixed(4)},${longitude.toFixed(4)}`;
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    cache.delete(key);
    cache.set(key, cached);
    return { ...cached.value, lat: latitude, lng: longitude };
  }
  if (cached) cache.delete(key);
  const existing = inFlight.get(key);
  if (existing) return existing;

  const lookup = resolveWithChain(latitude, longitude)
    .then((result) => {
      cache.set(key, { value: result, expiresAt: Date.now() + CACHE_TTL_MS });
      if (cache.size > CACHE_LIMIT) {
        const oldestKey = cache.keys().next().value;
        if (oldestKey) cache.delete(oldestKey);
      }
      return result;
    })
    .finally(() => inFlight.delete(key));
  inFlight.set(key, lookup);
  return lookup;
}

export function clearGeocodingCacheForTests(): void {
  cache.clear();
  inFlight.clear();
}
