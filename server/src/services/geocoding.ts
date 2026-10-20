export interface ReverseGeocodeResult {
  city: string;
  district: string;
  state: string;
  pinCode: string;
  country: string;
  displayName: string;
}

export class GeocodingError extends Error {
  constructor(
    public readonly statusCode: 422 | 502 | 503,
    message: string,
  ) {
    super(message);
    this.name = 'GeocodingError';
  }
}

let nextNominatimRequestAt = 0;

async function waitForNominatimSlot(): Promise<void> {
  const now = Date.now();
  const waitMs = Math.max(0, nextNominatimRequestAt - now);
  nextNominatimRequestAt = Math.max(now, nextNominatimRequestAt) + 1100;
  if (waitMs > 0) await new Promise((resolve) => setTimeout(resolve, waitMs));
}

function logProviderFailure(provider: string, category: string, status?: number, requestId?: string): void {
  console.warn('[location] Reverse-geocoding provider failure', {
    provider,
    category,
    ...(status ? { status } : {}),
    ...(requestId ? { requestId } : {}),
  });
}

export async function reverseGeocode(latitude: number, longitude: number): Promise<ReverseGeocodeResult> {
  const provider = (process.env.GEOCODING_PROVIDER || 'nominatim').trim().toLowerCase();
  if (!['nominatim', 'openstreetmap', 'osm'].includes(provider)) {
    logProviderFailure(provider, 'unsupported_provider');
    throw new GeocodingError(503, 'Location lookup is temporarily unavailable. Enter your address manually.');
  }

  await waitForNominatimSlot();
  const params = new URLSearchParams({
    format: 'jsonv2',
    addressdetails: '1',
    lat: latitude.toString(),
    lon: longitude.toString(),
  });
  let response: Response;
  try {
    response = await fetch(`https://nominatim.openstreetmap.org/reverse?${params}`, {
      headers: {
        'User-Agent': process.env.APP_BASE_URL
          ? `AgriConnect/1.0 (${process.env.APP_BASE_URL}${process.env.GEOCODING_CONTACT_EMAIL ? `; ${process.env.GEOCODING_CONTACT_EMAIL}` : ''})`
          : `AgriConnect/1.0${process.env.GEOCODING_CONTACT_EMAIL ? ` (${process.env.GEOCODING_CONTACT_EMAIL})` : ''}`,
        'Accept-Language': 'en',
      },
      signal: AbortSignal.timeout(8000),
    });
  } catch (error) {
    logProviderFailure('nominatim', error instanceof Error && error.name === 'TimeoutError' ? 'timeout' : 'network_error');
    throw new GeocodingError(502, 'Location lookup is temporarily unavailable. Enter your address manually.');
  }

  if (!response.ok) {
    const requestId = response.headers.get('x-request-id') || undefined;
    logProviderFailure('nominatim', response.status === 429 ? 'rate_limited' : 'http_error', response.status, requestId);
    const statusCode = response.status === 429 ? 503 : 502;
    throw new GeocodingError(statusCode, 'Location lookup is temporarily unavailable. Enter your address manually.');
  }

  const data = (await response.json()) as {
    display_name?: string;
    address?: {
      city?: string;
      town?: string;
      village?: string;
      municipality?: string;
      suburb?: string;
      neighbourhood?: string;
      county?: string;
      state_district?: string;
      state?: string;
      postcode?: string;
      country?: string;
    };
  };
  const address = data.address;
  const city = address?.city || address?.town || address?.village || address?.municipality || address?.suburb || address?.neighbourhood;
  const district = address?.county || address?.state_district || city;

  if (!city || !district || !address?.state || !address?.postcode) {
    throw new GeocodingError(
      422,
      'We could not find a complete address for this location. Enter your city and PIN code manually.',
    );
  }

  const result = {
    city,
    district,
    state: address.state,
    pinCode: address.postcode,
    country: address.country || 'India',
    displayName: data.display_name || `${city}, ${address.state}`,
  };
  return result;
}
