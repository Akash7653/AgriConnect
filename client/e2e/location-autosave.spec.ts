import { expect, test } from '@playwright/test';

const apiOrigin = 'https://agriconnect-api-ajoq.onrender.com';

test('detects and saves location once, then reuses the saved account address', async ({ browser }) => {
  const context = await browser.newContext({
    permissions: ['geolocation'],
    geolocation: { latitude: 18.5204, longitude: 73.8567 },
  });
  let reverseGeocodeRequests = 0;
  let savedAddress: Record<string, string> | undefined;

  try {
    const page = await context.newPage();
    await page.route(`${apiOrigin}/api/auth/login`, (route) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        token: 'browser-test-token',
        user: { id: 'location-test-user', email: 'buyer@example.test', name: 'Test Buyer', role: 'buyer' },
      }),
    }));
    await page.route(`${apiOrigin}/api/location/reverse-geocode`, (route) => {
      reverseGeocodeRequests += 1;
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          address: { city: 'Pune', district: 'Pune', state: 'Maharashtra', pinCode: '411001' },
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

    await page.goto('/login');
    await page.getByLabel('Email').fill('buyer@example.test');
    await page.getByLabel('Password').fill('test-password');
    await page.getByRole('button', { name: 'Sign in' }).click();

    await expect.poll(() => savedAddress).toEqual({
      villageOrCity: 'Pune',
      district: 'Pune',
      state: 'Maharashtra',
      pinCode: '411001',
    });
    await expect(page.getByText('Location saved as Pune, Maharashtra.')).toBeVisible();

    await page.reload();
    await page.waitForTimeout(300);
    expect(reverseGeocodeRequests).toBe(1);
  } finally {
    await context.close();
  }
});
