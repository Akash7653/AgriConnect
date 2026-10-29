import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import handler from './reverse-geocode.js';

function responseRecorder() {
  return {
    statusCode: 200,
    headers: {},
    body: undefined,
    setHeader(name, value) {
      this.headers[name] = value;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

afterEach(() => {
  delete globalThis.fetch;
});

test('rejects invalid coordinates before contacting providers', async () => {
  globalThis.fetch = () => {
    throw new Error('Unexpected provider request');
  };
  const res = responseRecorder();

  await handler({ method: 'POST', body: { latitude: 91, longitude: 78 } }, res);

  assert.equal(res.statusCode, 400);
  assert.equal(res.body.success, false);
});

test('resolves a valid address from Photon', async () => {
  globalThis.fetch = async (url) => {
    assert.match(String(url), /^https:\/\/photon\.komoot\.io\/reverse\?/);
    return Response.json({
      features: [{
        properties: {
          city: 'Medchal',
          county: 'Medchal mandal',
          state: 'Telangana',
          postcode: '501400',
          country: 'India',
          street: 'Medchal Station',
        },
      }],
    });
  };
  const res = responseRecorder();

  await handler({ method: 'POST', body: { latitude: 17.629, longitude: 78.481 } }, res);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body.address, {
    city: 'Medchal',
    district: 'Medchal mandal',
    state: 'Telangana',
    pinCode: '501400',
    displayName: 'Medchal Station, Medchal, Telangana, 501400',
    line1: 'Medchal Station',
    locality: 'Medchal',
    lat: 17.629,
    lng: 78.481,
    source: 'photon',
    country: 'India',
  });
});
