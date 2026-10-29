import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearGeocodingCacheForTests, reverseGeocode } from '../services/geocoding.js';

const googleAddress = {
  status: 'OK',
  results: [{
    formatted_address: 'Pune, Maharashtra 411001, India',
    address_components: [
      { long_name: '411001', types: ['postal_code'] },
      { long_name: 'Pune', types: ['locality'] },
      { long_name: 'Pune', types: ['administrative_area_level_2'] },
      { long_name: 'Maharashtra', types: ['administrative_area_level_1'] },
      { long_name: 'India', types: ['country'] },
    ],
  }],
};

describe('reverse geocoding service', () => {
  beforeEach(() => {
    clearGeocodingCacheForTests();
    vi.stubEnv('GEOCODER_PRIMARY', 'google');
    vi.stubEnv('GEOCODER_FALLBACK', '');
    vi.stubEnv('GEOCODING_PROVIDER', '');
    vi.stubEnv('GOOGLE_MAPS_API_KEY', 'test-key');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('normalizes a Google response with the provider and coordinates', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json(googleAddress)));
    const result = await reverseGeocode(18.5204, 73.8567);
    expect(result).toMatchObject({
      city: 'Pune',
      district: 'Pune',
      state: 'Maharashtra',
      pinCode: '411001',
      lat: 18.5204,
      lng: 73.8567,
      source: 'google',
    });
  });

  it('falls back from a rate-limited Google response to Nominatim', async () => {
    vi.stubEnv('GEOCODER_FALLBACK', 'nominatim');
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(Response.json({ status: 'OVER_QUERY_LIMIT', results: [] }))
      .mockResolvedValueOnce(Response.json({
        display_name: 'Pune, Maharashtra, 411001',
        address: {
          city: 'Pune',
          county: 'Pune',
          state: 'Maharashtra',
          postcode: '411001',
          country: 'India',
        },
      }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await reverseGeocode(18.5204, 73.8567);
    expect(result.source).toBe('nominatim');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('prefers the administrative district over county in Nominatim results', async () => {
    vi.stubEnv('GEOCODER_PRIMARY', 'nominatim');
    vi.stubEnv('GEOCODER_FALLBACK', '');
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({
      display_name: 'Locality, District, State, 411001',
      address: {
        suburb: 'Locality',
        state_district: 'District',
        county: 'County',
        state: 'State',
        postcode: '411001',
        country: 'India',
      },
    })));

    await expect(reverseGeocode(18.5204, 73.8567)).resolves.toMatchObject({
      city: 'Locality',
      district: 'District',
      locality: 'Locality',
    });
  });

  it('caches successful results for rounded coordinate keys', async () => {
    const fetchMock = vi.fn(async () => Response.json(googleAddress));
    vi.stubGlobal('fetch', fetchMock);

    const first = await reverseGeocode(18.52041, 73.85671);
    const second = await reverseGeocode(18.52042, 73.85672);
    expect(second).toMatchObject({ city: first.city, pinCode: first.pinCode, source: first.source, lat: 18.52042, lng: 73.85672 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('coalesces simultaneous lookups for the same rounded coordinates', async () => {
    let release: ((response: Response) => void) | undefined;
    const fetchMock = vi.fn(() => new Promise<Response>((resolve) => { release = resolve; }));
    vi.stubGlobal('fetch', fetchMock);

    const first = reverseGeocode(18.52041, 73.85671);
    const second = reverseGeocode(18.52042, 73.85672);
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    release?.(Response.json(googleAddress));
    const results = await Promise.all([first, second]);
    expect(results[0]).toEqual(results[1]);
  });

  it('rejects out-of-range coordinates before contacting a provider', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await expect(reverseGeocode(91, 0)).rejects.toMatchObject({ statusCode: 400 });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
