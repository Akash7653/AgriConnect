import { expect, test, type BrowserContext } from '@playwright/test';

const apiOrigin = 'https://agriconnect-api-ajoq.onrender.com';

async function prepareMarketplace(
  context: BrowserContext,
  reverseGeocodeStatus: number | (() => number) = 200,
  initialAddress?: { street: string; villageOrCity: string; district: string; state: string; pinCode: string }
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
  await context.route(`${apiOrigin}/api/auth/profile`, async (route) => {
    profileUpdates.push(JSON.parse(route.request().postData() ?? '{}'));
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) });
  });
  await context.route(`${apiOrigin}/api/serviceability**`, (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ configured: false, serviceable: false }),
  }));
  await context.route(`${apiOrigin}/api/location/reverse-geocode`, (route) => {
    const status = typeof reverseGeocodeStatus === 'function' ? reverseGeocodeStatus() : reverseGeocodeStatus;
    return route.fulfill({
      status,
      contentType: 'application/json',
      body: JSON.stringify(status === 200
        ? {
            success: true,
            address: { city: 'Pune', district: 'Pune', state: 'Maharashtra', pinCode: '411001', displayName: 'Pune, Maharashtra' },
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
  await page.getByRole('button', { name: 'Use my current location' }).waitFor();
  return { page, profileUpdates };
}

test('granted geolocation automatically fills checkout and saves the buyer address', async ({ browser }) => {
  const context = await browser.newContext({
    permissions: ['geolocation'],
    geolocation: { latitude: 18.5204, longitude: 73.8567 },
  });
  try {
    const { page, profileUpdates } = await prepareMarketplace(context);
    await page.getByRole('button', { name: 'Use my current location' }).click();
    await expect(page.getByText('Delivery location updated to Pune, Maharashtra.')).toBeVisible();
    await expect(page.getByLabel('City')).toHaveValue('Pune');
    await expect(page.getByLabel('District')).toHaveValue('Pune');
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
    await page.getByRole('button', { name: 'Use my current location' }).click();
    await expect(page.getByText('Location permission was denied. Enter your address manually.')).toBeVisible();
    await page.getByLabel('City').fill('Pune');
    await expect(page.getByLabel('City')).toHaveValue('Pune');
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
    await page.getByRole('button', { name: 'Use my current location' }).click();
    await expect(page.getByText('Address lookup is temporarily unavailable. Enter your locality or PIN code manually, or try again.')).toBeVisible();
    await expect(page.getByLabel('City')).toHaveValue('Old City');
    await expect(page.getByLabel('PIN code')).toHaveValue('111111');
    await page.getByRole('button', { name: 'Try location again' }).click();
    await expect(page.getByText('Delivery location updated to Pune, Maharashtra.')).toBeVisible();
    await expect(page.getByLabel('City')).toHaveValue('Pune');
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
    await page.getByRole('button', { name: 'Use my current location' }).click();
    await expect(page.getByText('Address lookup is temporarily unavailable. Enter your locality or PIN code manually, or try again.')).toBeVisible();
    await expect(page.getByLabel('City')).toHaveValue('');
    await page.getByLabel('City').fill('Pune');
    await expect(page.getByLabel('City')).toHaveValue('Pune');
  } finally {
    await context.close();
  }
});

test('location permission UX fits a narrow mobile viewport', async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 375, height: 812 },
    permissions: ['geolocation'],
    geolocation: { latitude: 18.5204, longitude: 73.8567 },
  });
  try {
    const { page } = await prepareMarketplace(context);
    await page.getByRole('button', { name: 'Use my current location' }).click();
    await expect(page.getByText('Delivery location updated to Pune, Maharashtra.')).toBeVisible();
    const bodyWidth = await page.locator('body').evaluate((element) => element.scrollWidth);
    expect(bodyWidth).toBeLessThanOrEqual(375);
  } finally {
    await context.close();
  }
});
