import { expect, test, type BrowserContext } from '@playwright/test';

const apiOrigin = 'https://agriconnect-api-ajoq.onrender.com';

async function prepareMarketplace(
  context: BrowserContext,
  reverseGeocodeStatus: number | (() => number) = 200,
  initialAddress?: { street: string; villageOrCity: string; district: string; state: string; pinCode: string },
  reverseGeocodeAddress = {
    city: 'Pune',
    district: 'Pune',
    state: 'Maharashtra',
    pinCode: '411001',
    displayName: 'Pune, Maharashtra',
  },
  serviceabilityResult = {
    configured: true,
    serviceable: true,
    zone: { estimatedDeliveryDays: 2 },
  }
) {
  await context.addInitScript((address) => {
    localStorage.setItem('agriconnect_session', JSON.stringify({
      user: {
        id: 'browser-test-buyer',
        email: 'buyer@example.test',
        fullName: 'Test Buyer',
        role: 'buyer',
        ...(address ? { address } : {}),
      },
      token: 'browser-test-token',
    }));
  }, initialAddress);
  const page = await context.newPage();
  await page.route(`${apiOrigin}/api/crops**`, (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      listings: [{
        _id: 'browser-test-crop',
        cropName: 'Browser Test Tomatoes',
        category: 'Vegetables',
        unit: 'kg',
        pricePerUnitPaise: 5000,
        availableQuantity: 8,
        location: { district: 'Pune', state: 'Maharashtra' },
        farmerId: { name: 'Test Farmer' },
      }],
    }),
  }));
  await context.route('**/socket.io/**', (route) => route.abort());
  const profileUpdates: unknown[] = [];
  let reverseGeocodeRequests = 0;
  await context.route(`${apiOrigin}/api/auth/profile`, async (route) => {
    profileUpdates.push(JSON.parse(route.request().postData() ?? '{}'));
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) });
  });
  await context.route(`${apiOrigin}/api/serviceability**`, (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(serviceabilityResult),
  }));
  await context.route(`${apiOrigin}/api/location/reverse-geocode`, (route) => {
    reverseGeocodeRequests += 1;
    const status = typeof reverseGeocodeStatus === 'function' ? reverseGeocodeStatus() : reverseGeocodeStatus;
    return route.fulfill({
      status,
      contentType: 'application/json',
      body: JSON.stringify(status === 200
        ? {
            success: true,
            address: reverseGeocodeAddress,
          }
        : { message: 'Location lookup is temporarily unavailable.' }),
    });
  });
  await page.goto('/dashboard/marketplace');
  await page.getByRole('button', { name: 'Add Browser Test Tomatoes to cart' }).waitFor();
  await page.getByRole('button', { name: 'Add Browser Test Tomatoes to cart' }).click();
  if (await page.getByRole('button', { name: 'Open cart' }).isVisible()) {
    await page.getByRole('button', { name: 'Open cart' }).click();
  } else {
    await page.getByRole('button', { name: /Cart/ }).first().click();
  }
  await page.getByRole('button', { name: 'Continue to payment' }).click();
  await page.getByRole('button', { name: 'Detect my location' }).waitFor();
  return { page, profileUpdates, getReverseGeocodeRequests: () => reverseGeocodeRequests };
}

test('granted geolocation automatically fills checkout and saves the buyer address', async ({ browser }) => {
  const context = await browser.newContext({
    permissions: ['geolocation'],
    geolocation: { latitude: 18.5204, longitude: 73.8567 },
  });
  try {
    const { page, profileUpdates } = await prepareMarketplace(context);
    await page.getByRole('button', { name: 'Detect my location' }).click();
    await expect(page.getByText('Location found. Confirm your delivery address.')).toBeVisible();
    await expect(page.getByText(/GPS estimates your position within about \d+ m/)).toBeVisible();
    expect(profileUpdates).toHaveLength(0);
    await page.getByRole('button', { name: 'Confirm and save address' }).click();
    await expect(page.getByText('Delivery address confirmed: Pune, Maharashtra.')).toBeVisible();
    await expect(page.getByLabel('City').first()).toHaveValue('Pune');
    await expect(page.getByLabel('District').first()).toHaveValue('Pune');
    await expect(page.getByLabel('State')).toHaveValue('Maharashtra');
    await expect(page.getByLabel('PIN code')).toHaveValue('411001');
    expect(profileUpdates).toEqual([{
      address: {
        street: 'Pune, Maharashtra',
        villageOrCity: 'Pune',
        district: 'Pune',
        state: 'Maharashtra',
        pinCode: '411001',
      },
    }]);
  } finally {
    await context.close();
  }
});

test('uses the same-origin Vercel geocoder before the Render API', async ({ browser }) => {
  const context = await browser.newContext({
    permissions: ['geolocation'],
    geolocation: { latitude: 17.629, longitude: 78.481 },
  });
  try {
    const { page, getReverseGeocodeRequests } = await prepareMarketplace(context);
    await page.route('**/api/reverse-geocode', (route) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        address: {
          city: 'Medchal',
          district: 'Medchal mandal',
          state: 'Telangana',
          pinCode: '501400',
          displayName: 'Medchal Station, Medchal, Telangana, 501400',
          source: 'photon',
        },
      }),
    }));

    await page.getByRole('button', { name: 'Detect my location' }).click();
    await expect(page.getByText('Location found. Confirm your delivery address.')).toBeVisible();
    expect(getReverseGeocodeRequests()).toBe(0);
  } finally {
    await context.close();
  }
});

test('location detection requests a fresh high-accuracy position', async ({ browser }) => {
  const context = await browser.newContext({
    permissions: ['geolocation'],
    geolocation: { latitude: 18.5204, longitude: 73.8567 },
  });
  try {
    const { page } = await prepareMarketplace(context);
    await page.evaluate(() => {
      const geolocation = navigator.geolocation;
      const getCurrentPosition = geolocation.getCurrentPosition.bind(geolocation);
      Object.defineProperty(navigator, 'geolocation', {
        configurable: true,
        value: {
          getCurrentPosition(
            success: PositionCallback,
            error?: PositionErrorCallback | null,
            options?: PositionOptions,
          ) {
            document.documentElement.dataset.geolocationOptions = JSON.stringify(options);
            getCurrentPosition(success, error, options);
          },
        },
      });
    });

    await page.getByRole('button', { name: 'Detect my location' }).click();
    await expect(page.getByText('Location found. Confirm your delivery address.')).toBeVisible();
    const options = await page.locator('html').getAttribute('data-geolocation-options');
    expect(JSON.parse(options ?? '{}')).toEqual({
      enableHighAccuracy: true,
      timeout: 30000,
      maximumAge: 0,
    });
  } finally {
    await context.close();
  }
});

test('location detection keeps manual entry available when the API geocoder is rate-limited', async ({ browser }) => {
  const context = await browser.newContext({
    permissions: ['geolocation'],
    geolocation: { latitude: 17.629, longitude: 78.481 },
  });
  try {
    const { page } = await prepareMarketplace(context);
    let photonRequests = 0;
    await page.route(`${apiOrigin}/api/location/reverse-geocode`, (route) => route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({
        code: 'LOCATION_RATE_LIMITED',
        message: 'Address lookup is temporarily unavailable.',
      }),
    }));
    await page.route('https://photon.komoot.io/reverse**', async (route) => {
      photonRequests += 1;
      await route.fulfill({ status: 200, body: '{}' });
    });

    await page.getByRole('button', { name: 'Detect my location' }).click();
    await expect(page.getByText(/Address lookup is temporarily busy/)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Enter address manually' })).toBeVisible();
    expect(photonRequests).toBe(0);
  } finally {
    await context.close();
  }
});

test('checkout stays disabled while delivery coverage is not configured', async ({ browser }) => {
  const context = await browser.newContext();
  try {
    const { page } = await prepareMarketplace(
      context,
      200,
      {
        street: 'Medchal Station',
        villageOrCity: 'Medchal',
        district: 'Medchal',
        state: 'Telangana',
        pinCode: '501401',
      },
      undefined,
      { configured: false, serviceable: null }
    );
    await expect(page.getByText(/Delivery coverage has not been configured yet/)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Delivery unavailable' })).toBeDisabled();
  } finally {
    await context.close();
  }
});

test('denied geolocation keeps manual address entry available', async ({ browser }) => {
  const context = await browser.newContext();
  const cdp = await browser.newBrowserCDPSession();
  try {
    const { page } = await prepareMarketplace(context);
    await cdp.send('Browser.setPermission', {
      permission: { name: 'geolocation' },
      setting: 'denied',
      origin: 'http://127.0.0.1:4173',
    });
    await page.getByRole('button', { name: 'Detect my location' }).click();
    await expect(page.getByText('Location permission was denied. Enter your address manually or allow location access.')).toBeVisible();
    await page.getByLabel('City').first().fill('Pune');
    await expect(page.getByLabel('City').first()).toHaveValue('Pune');
    await expect(page.getByRole('button', { name: 'Continue to secure payment' })).toBeVisible();
    await expect(page.getByText('Calculated by server')).toBeVisible();
  } finally {
    await cdp.detach();
    await context.close();
  }
});

test('reverse-geocoding errors preserve the confirmed address and allow retry or manual entry', async ({ browser }) => {
  const context = await browser.newContext({
    permissions: ['geolocation'],
    geolocation: { latitude: 18.5204, longitude: 73.8567 },
  });
  try {
    let requests = 0;
    const { page, profileUpdates } = await prepareMarketplace(
      context,
      () => (++requests === 1 ? 503 : 200),
      {
        street: 'Old delivery road',
        villageOrCity: 'Old City',
        district: 'Old District',
        state: 'Old State',
        pinCode: '111111',
      }
    );
    await page.getByRole('button', { name: 'Detect my location' }).click();
    await expect(page.getByText('Couldn’t fetch your address automatically. Enter your PIN code and locality to continue.')).toBeVisible();
    await expect(page.getByLabel('City').first()).toHaveValue('Old City');
    await expect(page.getByLabel('PIN code')).toHaveValue('111111');
    await page.getByRole('button', { name: 'Try location again' }).click();
    await expect(page.getByText('Location found. Confirm your delivery address.')).toBeVisible();
    await page.getByRole('button', { name: 'Confirm and save address' }).click();
    await expect(page.getByLabel('City').first()).toHaveValue('Pune');
    expect(profileUpdates).toHaveLength(1);
  } finally {
    await context.close();
  }
});

test('manual address entry remains available when reverse-geocoding is unavailable', async ({ browser }) => {
  const context = await browser.newContext({
    permissions: ['geolocation'],
    geolocation: { latitude: 18.5204, longitude: 73.8567 },
  });
  try {
    const { page } = await prepareMarketplace(context, 503);
    await page.getByRole('button', { name: 'Detect my location' }).click();
    await expect(page.getByText('Couldn’t fetch your address automatically. Enter your PIN code and locality to continue.')).toBeVisible();
    await expect(page.getByLabel('City').first()).toHaveValue('');
    await page.getByLabel('City').first().fill('Pune');
    await expect(page.getByLabel('City').first()).toHaveValue('Pune');
  } finally {
    await context.close();
  }
});

test('location selector fits mobile and tablet viewports', async ({ browser }) => {
  test.setTimeout(60_000);
  for (const width of [360, 390, 768]) {
    const context = await browser.newContext({
      viewport: { width, height: 844 },
      permissions: ['geolocation'],
      geolocation: { latitude: 18.5204, longitude: 73.8567 },
    });
    try {
      const { page } = await prepareMarketplace(context);
      await page.getByRole('button', { name: 'Detect my location' }).click();
      await expect(page.getByText('Location found. Confirm your delivery address.')).toBeVisible();
      await page.getByRole('button', { name: 'Confirm and save address' }).click();
      const bodyWidth = await page.locator('body').evaluate((element) => element.scrollWidth);
      expect(bodyWidth).toBeLessThanOrEqual(width);
    } finally {
      await context.close();
    }
  }
});

test('missing PIN remains a required editable confirmation field', async ({ browser }) => {
  const context = await browser.newContext({
    permissions: ['geolocation'],
    geolocation: { latitude: 18.5204, longitude: 73.8567 },
  });
  try {
    const { page, profileUpdates } = await prepareMarketplace(context, 200, undefined, {
      city: 'Pune',
      district: 'Pune',
      state: 'Maharashtra',
      pinCode: '',
      displayName: 'Pune, Maharashtra',
    });
    await page.getByRole('button', { name: 'Detect my location' }).click();
    await expect(page.getByLabel('Confirm PIN code')).toHaveValue('');
    await expect(page.getByRole('button', { name: 'Confirm and save address' })).toBeDisabled();
    await page.getByLabel('Confirm PIN code').fill('411001');
    await page.getByRole('button', { name: 'Confirm and save address' }).click();
    await expect.poll(() => profileUpdates).toHaveLength(1);
  } finally {
    await context.close();
  }
});

test('manual locality and PIN entry uses the same confirm-and-save action', async ({ browser }) => {
  const context = await browser.newContext({
    permissions: ['geolocation'],
    geolocation: { latitude: 18.5204, longitude: 73.8567 },
  });
  try {
    const { page, profileUpdates } = await prepareMarketplace(context, 503);
    await page.getByRole('button', { name: 'Detect my location' }).click();
    await expect(page.getByText('Couldn’t fetch your address automatically. Enter your PIN code and locality to continue.')).toBeVisible();
    await page.getByRole('button', { name: 'Enter address manually' }).click();
    await page.getByLabel('Locality').fill('Kothrud');
    await page.getByRole('textbox', { name: 'City' }).first().fill('Pune');
    await page.getByLabel('District').first().fill('Pune');
    await page.getByRole('textbox', { name: 'State' }).first().fill('Maharashtra');
    await page.getByLabel('Confirm PIN code').fill('411038');
    await page.getByRole('button', { name: 'Confirm and save address' }).click();
    await expect.poll(() => profileUpdates).toHaveLength(1);
    expect(profileUpdates[0]).toMatchObject({
      address: {
        villageOrCity: 'Pune',
        district: 'Pune',
        state: 'Maharashtra',
        pinCode: '411038',
      },
    });
  } finally {
    await context.close();
  }
});

test('browser geolocation timeout exposes manual entry', async ({ browser }) => {
  const context = await browser.newContext();
  try {
    const { page } = await prepareMarketplace(context);
    await page.evaluate(() => {
      Object.defineProperty(navigator, 'geolocation', {
        configurable: true,
        value: {
          getCurrentPosition: (_success: unknown, error: (value: { code: number }) => void) => error({ code: 3 }),
        },
      });
    });
    await page.getByRole('button', { name: 'Detect my location' }).click();
    await expect(page.getByText('Location detection timed out. Try again or enter your address manually.')).toBeVisible();
    await expect(page.getByLabel('City')).toBeVisible();
  } finally {
    await context.close();
  }
});

test('rapid repeated detection taps issue one reverse-geocode request', async ({ browser }) => {
  const context = await browser.newContext({
    permissions: ['geolocation'],
    geolocation: { latitude: 18.5204, longitude: 73.8567 },
  });
  try {
    const { page, getReverseGeocodeRequests } = await prepareMarketplace(context);
    await page.evaluate(() => {
      const button = [...document.querySelectorAll('button')].find((candidate) => candidate.textContent?.includes('Detect my location'));
      button?.click();
      button?.click();
    });
    await expect(page.getByText('Location found. Confirm your delivery address.')).toBeVisible();
    expect(getReverseGeocodeRequests()).toBe(1);
  } finally {
    await context.close();
  }
});
