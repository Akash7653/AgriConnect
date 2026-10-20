import { expect, test } from '@playwright/test';

const apiOrigin = 'https://agriconnect-api-ajoq.onrender.com';

const listings = [
  {
    _id: 'tomato-listing',
    cropName: 'Tomatoes',
    category: 'Vegetables',
    unit: 'kg',
    pricePerUnitPaise: 4200,
    availableQuantity: 12,
    minOrderQuantity: 1,
    images: ['https://images.test/tomatoes.jpg'],
    location: { village: 'Green Village', district: 'Hyderabad', state: 'Telangana' },
    farmerId: { name: 'Green Farm' },
    description: 'Fresh tomatoes from a verified farm.',
  },
  {
    _id: 'grain-listing',
    cropName: 'Millet',
    category: 'Grains & Cereals',
    unit: 'kg',
    pricePerUnitPaise: 6500,
    availableQuantity: 8,
    minOrderQuantity: 1,
    images: [],
    location: { village: 'Green Village', district: 'Hyderabad', state: 'Telangana' },
    farmerId: { name: 'Green Farm' },
    description: 'Millet harvested by a verified farm.',
  },
];

test('mobile storefront and buyer shopping flow work across common widths', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 320, height: 740 } });
  await context.addInitScript(() => {
    if (location.origin !== 'http://127.0.0.1:4173') return;
    localStorage.setItem('agriconnect_session', JSON.stringify({
      token: 'storefront-test-token',
      user: {
        id: 'storefront-buyer',
        email: 'buyer@example.test',
        fullName: 'Storefront Buyer',
        role: 'buyer',
        address: { villageOrCity: 'Hyderabad', district: 'Hyderabad', state: 'Telangana', pinCode: '500081' },
      },
    }));
  });
  await context.route('**/socket.io/**', (route) => route.abort());
  await context.route('https://images.test/tomatoes.jpg', (route) => route.fulfill({
    status: 200,
    contentType: 'image/svg+xml',
    body: '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="200"><rect width="300" height="200" fill="#246B45"/></svg>',
  }));
  await context.route(`${apiOrigin}/api/storefront/campaigns`, (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      success: true,
      campaigns: [{
        id: 'verified-tomato-campaign',
        title: 'Verified tomato campaign',
        description: 'A seller-configured campaign for available tomatoes.',
        imageUrl: 'https://images.test/tomatoes.jpg',
        category: 'vegetables',
        ctaLabel: 'Browse vegetables',
      }],
    }),
  }));
  await context.route(`${apiOrigin}/api/crops**`, async (route) => {
    const url = new URL(route.request().url());
    const search = (url.searchParams.get('search') ?? '').toLowerCase();
    const category = url.searchParams.get('category');
    const result = listings.filter((listing) =>
      (!search || listing.cropName.toLowerCase().includes(search)) &&
      (!category || category === listing.category)
    );
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, listings: result, pagination: { page: 1, limit: 100, total: result.length, totalPages: 1 } }),
    });
  });
  let savedAddress: Record<string, string> | undefined;
  await context.route(`${apiOrigin}/api/serviceability**`, (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ configured: true, serviceable: true, zone: { estimatedDeliveryDays: 2 } }),
  }));
  await context.route(`${apiOrigin}/api/auth/profile`, async (route) => {
    savedAddress = route.request().postDataJSON().address;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true }),
    });
  });

  try {
    const page = await context.newPage();
    await page.goto('/');
    await expect(page.getByRole('img', { name: 'AgriConnect animated logo' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Fresh listings from verified farms.' })).toBeVisible();
    await expect(page.locator('footer')).toBeHidden();
    const topMenu = page.getByRole('button', { name: 'Toggle menu' });
    await expect(topMenu).toBeVisible();
    await topMenu.click();
    await expect(page.getByRole('link', { name: 'Shop categories' })).toBeVisible();
    await page.getByRole('button', { name: 'Toggle menu' }).click();
    await expect(page.getByText('Hyderabad, Hyderabad, Telangana')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Offers and campaigns' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Verified tomato campaign' })).toBeVisible();
    await page.getByRole('button', { name: 'Browse vegetables' }).click();
    await expect(page).toHaveURL(/category=vegetables/);
    await page.getByRole('navigation', { name: 'Buyer navigation' }).getByRole('link', { name: 'Home' }).click();

    await page.getByRole('button', { name: 'Change delivery location' }).click();
    const locationDialog = page.getByRole('dialog', { name: 'Delivery location' });
    await locationDialog.getByLabel('City / locality').fill('Pune');
    await locationDialog.getByLabel('District').fill('Pune');
    await locationDialog.getByLabel('State').fill('Maharashtra');
    await locationDialog.getByLabel('PIN code').fill('411001');
    await locationDialog.getByRole('button', { name: 'Save delivery location' }).click();
    await expect(page.getByText('Pune, Pune, Maharashtra')).toBeVisible();
    await expect(page.getByText('Estimated delivery within 2 days after order confirmation. Timing may vary.')).toBeVisible();
    await expect.poll(() => savedAddress).toMatchObject({
      villageOrCity: 'Pune',
      district: 'Pune',
      state: 'Maharashtra',
      pinCode: '411001',
    });

    for (const width of [320, 375, 390, 430, 768]) {
      await page.setViewportSize({ width, height: 820 });
      await expect(page.getByRole('heading', { name: 'Fresh listings from verified farms.' })).toBeVisible();
      const documentWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      expect(documentWidth, `horizontal overflow at ${width}px`).toBeLessThanOrEqual(width);
    }
    await page.setViewportSize({ width: 390, height: 820 });

    const search = page.getByRole('searchbox', { name: 'Search available products' });
    await search.fill('Tomato');
    await expect(page.getByRole('button', { name: 'Add Tomatoes to cart' })).toBeVisible();
    await expect(page.getByText('Millet', { exact: true })).toHaveCount(0);
    await expect(page.locator('img[alt="Tomatoes"]')).toBeVisible();
    await page.locator('article').getByRole('button', { name: 'Tomatoes', exact: true }).click();
    const productDetails = page.getByRole('dialog', { name: 'Tomatoes details' });
    await expect(productDetails).toBeVisible();
    await productDetails.getByLabel('Quantity for Tomatoes').fill('2');
    await productDetails.getByRole('button', { name: 'Add to cart' }).click();
    await expect(page.getByRole('button', { name: 'Open cart, 2 items' })).toBeVisible();

    await page.getByRole('button', { name: 'Clear search' }).click();
    await expect(page.getByText('Millet', { exact: true })).toBeVisible();

    const bottomNav = page.getByRole('navigation', { name: 'Buyer navigation' });
    await expect(bottomNav.getByRole('link', { name: 'Home' })).toBeVisible();
    await expect(bottomNav.getByRole('link', { name: 'Categories' })).toBeVisible();
    await expect(bottomNav.getByRole('link', { name: 'Search' })).toBeVisible();
    await expect(bottomNav.getByRole('link', { name: 'Orders' })).toBeVisible();
    await expect(bottomNav.getByRole('link', { name: 'Account' })).toBeVisible();

    await page.reload();
    await expect(page.getByRole('button', { name: 'Open cart, 2 items' })).toBeVisible();
    await bottomNav.getByRole('link', { name: 'Categories' }).click();
    await expect(page).toHaveURL(/\/dashboard\/marketplace#categories$/);
    await expect(page.getByRole('heading', { name: 'Marketplace' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Grains & cereals' })).toBeVisible();
    await page.getByRole('button', { name: 'Grains & cereals' }).click();
    await expect(page).toHaveURL(/category=grains/);
    await expect(page.getByText('Millet', { exact: true })).toBeVisible();
    await bottomNav.getByRole('link', { name: 'Search' }).click();
    await expect(page).toHaveURL(/#product-search$/);
    await expect(page.locator('#product-search')).toBeVisible();

    const openCart = page.getByRole('button', { name: /Open cart/ });
    await openCart.click();
    await expect(page.getByRole('heading', { name: 'Your Cart' })).toBeVisible();
    const cart = page.locator('aside');
    await expect(cart.getByText('Tomatoes', { exact: true })).toBeVisible();
    await cart.getByRole('button', { name: 'Increase Tomatoes quantity' }).click();
    await expect(cart.getByText('3', { exact: true })).toBeVisible();
    await cart.getByRole('button', { name: 'Remove item' }).click();
    await expect(cart.getByText('Your cart is empty.')).toBeVisible();

    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /A clearer way/ })).toBeVisible();
    await expect(page.locator('footer')).toBeVisible();
    const desktopWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(desktopWidth).toBeLessThanOrEqual(1280);
  } finally {
    await context.close();
  }
});

test('guest mobile landing shows live catalogue products instead of an empty sign-in screen', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route('**/socket.io/**', (route) => route.abort());
  await page.route(`${apiOrigin}/api/storefront/campaigns`, (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ success: true, campaigns: [] }),
  }));
  await page.route(`${apiOrigin}/api/storefront/products**`, (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      success: true,
      listings: [{
        _id: 'guest-tomato-listing',
        cropName: 'Farm Fresh Tomatoes',
        category: 'Vegetables',
        unit: 'kg',
        pricePerUnitPaise: 4200,
        availableQuantity: 12,
        minOrderQuantity: 1,
        images: [],
        location: { district: 'Hyderabad', state: 'Telangana' },
        farmerId: { name: 'Green Farm' },
        description: 'Fresh tomatoes listed by a verified farm.',
      }],
      pagination: { page: 1, limit: 24, total: 1, totalPages: 1 },
    }),
  }));

  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Your daily market, grown nearby.' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Shop by category' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Available produce' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Add Farm Fresh Tomatoes to cart' })).toBeVisible();
  await expect(page.getByText('by Green Farm', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});
