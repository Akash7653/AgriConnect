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

export async function reverseGeocode(latitude: number, longitude: number): Promise<ReverseGeocodeResult> {
  const provider = process.env.GEOCODING_PROVIDER || 'nominatim';
  if (provider !== 'nominatim') {
    throw new GeocodingError(503, 'Location lookup is temporarily unavailable. Enter your address manually.');
  }

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
          ? `AgriConnect/1.0 (${process.env.APP_BASE_URL})`
          : 'AgriConnect/1.0',
      },
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    throw new GeocodingError(502, 'Location lookup is temporarily unavailable. Enter your address manually.');
  }

  if (!response.ok) {
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

  return {
    city,
    district,
    state: address.state,
    pinCode: address.postcode,
    country: address.country || 'India',
    displayName: data.display_name || `${city}, ${address.state}`,
  };
}
