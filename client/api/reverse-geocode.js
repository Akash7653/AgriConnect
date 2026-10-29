const REQUEST_TIMEOUT_MS = 5000;

function validCoordinates(body) {
  return body
    && typeof body.latitude === 'number'
    && Number.isFinite(body.latitude)
    && body.latitude >= -90
    && body.latitude <= 90
    && typeof body.longitude === 'number'
    && Number.isFinite(body.longitude)
    && body.longitude >= -180
    && body.longitude <= 180;
}

function addressFromPhoton(payload, latitude, longitude) {
  const properties = payload?.features?.[0]?.properties;
  if (!properties) return undefined;
  const city = properties.city || properties.town || properties.village || properties.locality || properties.suburb;
  const district = properties.district || properties.county || city;
  const state = properties.state;
  const pinCode = properties.postcode;
  if (![city, district, state].every((value) => typeof value === 'string' && value.trim())
    || !/^\d{6}$/.test(String(pinCode || '').trim())) return undefined;
  const line1 = [properties.housenumber, properties.street || properties.name].filter(Boolean).join(' ');
  return {
    city: city.trim(),
    district: district.trim(),
    state: state.trim(),
    pinCode: String(pinCode).trim(),
    displayName: [line1, properties.suburb || properties.locality, city, state, pinCode].filter(Boolean).join(', '),
    line1,
    locality: properties.suburb || properties.locality || city,
    lat: latitude,
    lng: longitude,
    source: 'photon',
    ...(properties.country ? { country: properties.country } : {}),
  };
}

async function lookup(url, latitude, longitude, parser, headers = {}) {
  const response = await fetch(url, {
    headers: { 'Accept-Language': 'en', ...headers },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`Geocoding provider returned ${response.status}.`);
  const payload = await response.json();
  return parser(payload, latitude, longitude);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ success: false, message: 'Method not allowed.' });
  }
  if (!validCoordinates(req.body)) {
    return res.status(400).json({ success: false, message: 'Location coordinates are invalid.' });
  }

  const { latitude, longitude } = req.body;
  const coordinates = `lat=${encodeURIComponent(latitude)}&lon=${encodeURIComponent(longitude)}`;
  try {
    const address = await lookup(
      `https://photon.komoot.io/reverse?${coordinates}&lang=en`,
      latitude,
      longitude,
      addressFromPhoton,
      { 'User-Agent': 'AgriConnect/1.0' },
    );
    if (address) return res.status(200).json({ success: true, address });
  } catch (error) {
    console.warn('[location-proxy] Reverse-geocoding provider failed', {
      message: error instanceof Error ? error.message : 'Unknown provider error',
    });
  }
  return res.status(502).json({
    success: false,
    message: 'Address lookup is temporarily unavailable. Enter your delivery address manually or try again.',
  });
}
