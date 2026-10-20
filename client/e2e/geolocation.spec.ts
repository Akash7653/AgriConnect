import { expect, test, type BrowserContext } from '@playwright/test';

const apiOrigin = 'https://agriconnect-api-ajoq.onrender.com';

async function prepareMarketplace(context: BrowserContext) {
  await context.addInitScript(() => {
    localStorage.setItem('agriconnect_session', JSON.stringify({
      user: { id: 'browser-test-buyer', email: 'buyer@example.test', fullName: 'Test Buyer', role: 'buyer' },
      token: 'browser-test-token',
    }));
  });
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
  await context.route(`${apiOrigin}/api/location/reverse-geocode`, (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      success: true,
      address: { city: 'Pune', district: 'Pune', state: 'Maharashtra', pinCode: '411001', displayName: 'Pune, Maharashtra' },
    }),
  }));
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
  return page;
}

test('granted geolocation suggests an address only after user confirmation', async ({ browser }) => {
  const context = await browser.newContext({
    permissions: ['geolocation'],
    geolocation: { latitude: 18.5204, longitude: 73.8567 },
  });
  try {
    const page = await prepareMarketplace(context);
    await page.getByRole('button', { name: 'Detect my location' }).click();
    await expect(page.getByText('Location found. Confirm it before continuing.')).toBeVisible();
    await expect(page.getByLabel('City')).toHaveValue('');
    await page.getByRole('button', { name: /Pune, Maharashtra/ }).click();
    await expect(page.getByLabel('City')).toHaveValue('Pune');
    await expect(page.getByLabel('PIN code')).toHaveValue('411001');
  } finally {
    await context.close();
  }
});

test('denied geolocation keeps manual address entry available', async ({ browser }) => {
  const context = await browser.newContext();
  try {
    const page = await prepareMarketplace(context);
    const cdp = await context.newCDPSession(page);
    await cdp.send('Browser.setPermission', {
      permission: { name: 'geolocation' },
      setting: 'denied',
      origin: 'http://127.0.0.1:4173',
    });
    await page.getByRole('button', { name: 'Detect my location' }).click();
    await expect(page.getByText('Location permission was denied. Enter your address manually.')).toBeVisible();
    await page.getByLabel('City').fill('Pune');
    await expect(page.getByLabel('City')).toHaveValue('Pune');
    await expect(page.getByRole('button', { name: 'Continue to secure payment' })).toBeVisible();
    await expect(page.getByText('Calculated by server')).toBeVisible();
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
    const page = await prepareMarketplace(context);
    await page.getByRole('button', { name: 'Detect my location' }).click();
    await expect(page.getByText('Location found. Confirm it before continuing.')).toBeVisible();
    const bodyWidth = await page.locator('body').evaluate((element) => element.scrollWidth);
    expect(bodyWidth).toBeLessThanOrEqual(375);
  } finally {
    await context.close();
  }
});
