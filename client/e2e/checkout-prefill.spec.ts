import { expect, test } from '@playwright/test';

const apiOrigin = 'https://agriconnect-api-ajoq.onrender.com';

test('location fills checkout delivery fields and offers cash on delivery', async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    permissions: ['geolocation'],
    geolocation: { latitude: 18.5204, longitude: 73.8567 },
  });

  try {
    await context.addInitScript(() => {
      localStorage.setItem('agriconnect_session', JSON.stringify({
        token: 'checkout-test-token',
        user: {
          id: 'checkout-test-buyer',
          email: 'buyer@example.test',
          fullName: 'Checkout Buyer',
          phone: '9123456789',
          role: 'buyer',
          address: { villageOrCity: 'Old City', district: 'Old District', state: 'Old State', pinCode: '111111' },
        },
      }));
    });
    await context.route('**/socket.io/**', (route) => route.abort());
    await context.route(`${apiOrigin}/api/crops**`, (route) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        listings: [{
          _id: 'checkout-test-crop',
          cropName: 'Fresh Tomatoes',
          category: 'Vegetables',
          unit: 'kg',
          pricePerUnitPaise: 1000,
          availableQuantity: 20,
          location: { district: 'Pune', state: 'Maharashtra' },
          farmerId: { name: 'Test Farmer' },
        }],
      }),
    }));
    await context.route(`${apiOrigin}/api/location/reverse-geocode`, (route) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        address: {
          city: 'Pune',
          district: 'Pune',
          state: 'Maharashtra',
          pinCode: '411001',
          displayName: 'Farm Road, Pune, Maharashtra, 411001',
        },
      }),
    }));
    await context.route(`${apiOrigin}/api/auth/profile`, (route) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true }),
    }));
    await context.route(`${apiOrigin}/api/serviceability**`, (route) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        configured: true,
        serviceable: true,
        zone: { estimatedDeliveryDays: 2 },
      }),
    }));

    const page = await context.newPage();
    await page.goto('/dashboard/marketplace');
    await page.getByRole('button', { name: 'Add Fresh Tomatoes to cart' }).click();
    await page.getByRole('button', { name: /^Cart/ }).first().click();
    await page.getByRole('button', { name: 'Continue to payment' }).click();
    await page.getByRole('button', { name: 'Detect my location' }).click();
    await page.getByRole('button', { name: 'Confirm and save address' }).click();
    await expect(page.getByText(/Delivery address confirmed: Farm Road/)).toBeVisible();

    await expect(page.getByLabel('Full name')).toHaveValue('Checkout Buyer');
    await expect(page.getByLabel('Phone')).toHaveValue('9123456789');
    await expect(page.getByLabel('Address')).toHaveValue('Farm Road, Pune, Maharashtra, 411001');
    await expect(page.getByLabel('City')).toHaveValue('Pune');
    await expect(page.getByLabel('District')).toHaveValue('Pune');
    await expect(page.getByLabel('State')).toHaveValue('Maharashtra');
    await expect(page.getByLabel('PIN code')).toHaveValue('411001');
    await expect(page.getByText('Estimated delivery within 2 days after order confirmation. Timing may vary.')).toBeVisible();

    await page.getByRole('radio', { name: /Cash on delivery/ }).check();
    await expect(page.getByRole('button', { name: 'Place cash-on-delivery order' })).toBeVisible();
  } finally {
    await context.close();
  }
});
