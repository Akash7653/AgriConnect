export interface ReverseGeocodeResult {
  city: string;
  district: string;
  state: string;
  pinCode: string;
  country: string;
  displayName: string;
}

export async function reverseGeocode(latitude: number, longitude: number): Promise<ReverseGeocodeResult> {
  const provider = process.env.GEOCODING_PROVIDER || 'nominatim';
  if (provider !== 'nominatim') {
    throw new Error(`Unsupported geocoding provider: ${provider}`);
  }

  const params = new URLSearchParams({
    format: 'jsonv2',
    addressdetails: '1',
    lat: latitude.toString(),
    lon: longitude.toString(),
  });
  const response = await fetch(`https://nominatim.openstreetmap.org/reverse?${params}`, {
    headers: {
      'User-Agent': process.env.APP_BASE_URL
        ? `AgriConnect/1.0 (${process.env.APP_BASE_URL})`
        : 'AgriConnect/1.0',
    },
    signal: AbortSignal.timeout(8000),
  });

  if (!response.ok) {
    throw new Error(`Geocoding provider returned ${response.status}.`);
  }

  const data = (await response.json()) as {
    display_name?: string;
    address?: {
      city?: string;
      town?: string;
      village?: string;
      municipality?: string;
      county?: string;
      state_district?: string;
      state?: string;
      postcode?: string;
      country?: string;
    };
  };
  const address = data.address;
  const city = address?.city || address?.town || address?.village || address?.municipality;
  const district = address?.county || address?.state_district || city;

  if (!city || !district || !address?.state || !address?.postcode) {
    throw new Error('The location provider returned an incomplete address.');
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
