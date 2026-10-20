import { expect, test } from '@playwright/test';

const apiOrigin = 'https://agriconnect-api-ajoq.onrender.com';

test('detects and saves location once, then reuses the saved account address', async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    permissions: ['geolocation'],
    geolocation: { latitude: 18.5204, longitude: 73.8567 },
  });
  let reverseGeocodeRequests = 0;
  let savedAddress: Record<string, string> | undefined;

  try {
    await context.addInitScript(() => {
      if (localStorage.getItem('agriconnect_session')) return;
      localStorage.setItem('agriconnect_session', JSON.stringify({
        token: 'browser-test-token',
        user: {
          id: 'location-test-user',
          email: 'buyer@example.test',
          fullName: 'Test Buyer',
          role: 'buyer',
        },
      }));
    });
    const page = await context.newPage();
    await page.route(`${apiOrigin}/api/crops**`, (route) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ listings: [] }),
    }));
    await page.route(`${apiOrigin}/api/storefront/campaigns`, (route) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ campaigns: [] }),
    }));
    await page.route(`${apiOrigin}/api/serviceability**`, (route) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ configured: false, serviceable: false }),
    }));
    await page.route('**/socket.io/**', (route) => route.abort());
    await page.route(`${apiOrigin}/api/location/reverse-geocode`, (route) => {
      reverseGeocodeRequests += 1;
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          address: {
            city: 'Pune',
            district: 'Pune',
            state: 'Maharashtra',
            pinCode: '411001',
            displayName: 'Pune, Maharashtra',
          },
        }),
      });
    });
    await page.route(`${apiOrigin}/api/auth/profile`, async (route) => {
      savedAddress = route.request().postDataJSON().address;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, message: 'Profile updated successfully' }),
      });
    });

    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Fresh listings from verified farms.' })).toBeVisible();
    await page.getByRole('button', { name: 'Change delivery location' }).click();
    await page.getByRole('button', { name: 'Use my current location' }).click();

    await expect.poll(() => savedAddress).toMatchObject({
      villageOrCity: 'Pune',
      district: 'Pune',
      state: 'Maharashtra',
      pinCode: '411001',
    });
    await expect(page.getByText('Pune, Pune, Maharashtra')).toBeVisible();

    await page.reload();
    await expect(page.getByText('Pune, Pune, Maharashtra')).toBeVisible();
    expect(reverseGeocodeRequests).toBe(1);
  } finally {
    await context.close();
  }
});
