import { expect, test, type BrowserContext } from '@playwright/test';

const apiOrigin = 'https://agriconnect-api-ajoq.onrender.com';

async function addSession(context: BrowserContext, role: 'farmer' | 'buyer') {
  await context.addInitScript((userRole) => {
    localStorage.setItem('agriconnect_session', JSON.stringify({
      token: 'dashboard-test-token',
      user: {
        id: `dashboard-test-${userRole}`,
        email: `${userRole}@example.test`,
        fullName: 'Dashboard Test',
        role: userRole,
        address: { villageOrCity: 'Test Village', district: 'Test District', state: 'Test State', pinCode: '123456' },
      },
    }));
  }, role);
  await context.route('**/socket.io/**', (route) => route.abort());
}

test('farmer listing page uses saved farm location and does not expose the buyer marketplace', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 375, height: 812 } });
  try {
    await addSession(context, 'farmer');
    await context.route(`${apiOrigin}/api/crops/my-crops`, (route) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ listings: [] }),
    }));
    await context.route(`${apiOrigin}/api/orders/farmer`, (route) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ orders: [] }),
    }));

    const page = await context.newPage();
    await page.goto('/dashboard/listings');
    await expect(page.getByRole('heading', { name: 'Crop listings' })).toBeVisible();
    await expect(page.getByLabel('Village')).toHaveValue('Test Village');
    await expect(page.locator('nav.fixed.bottom-0').getByRole('link', { name: 'Marketplace' })).toHaveCount(0);
    await page.goto('/dashboard/marketplace');
    await expect(page).toHaveURL(/\/dashboard$/);
  } finally {
    await context.close();
  }
});

test('buyer has the four-item shopping bar, account menu, and mobile theme toggle', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 375, height: 812 } });
  try {
    await addSession(context, 'buyer');
    await context.route(`${apiOrigin}/api/crops**`, (route) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ listings: [] }),
    }));

    const page = await context.newPage();
    await page.goto('/dashboard/marketplace');
    const mobileNav = page.locator('nav.fixed.bottom-0');
    await expect(mobileNav.getByRole('link', { name: 'Home' })).toHaveCount(1);
    await expect(mobileNav.getByRole('link', { name: 'Categories' })).toHaveCount(1);
    await expect(mobileNav.getByRole('link', { name: 'Orders' })).toHaveCount(1);
    await expect(mobileNav.getByRole('link', { name: /^Cart, 0 items$/ })).toHaveCount(1);
    await expect(mobileNav.getByRole('link', { name: 'Search' })).toHaveCount(0);
    await expect(mobileNav.getByRole('link', { name: 'Marketplace' })).toHaveCount(0);
    await expect(mobileNav.getByRole('link', { name: 'Crop Listings' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Open account' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Switch to dark mode' })).toBeVisible();
    await expect(page.getByText(/live account/i)).toHaveCount(0);
  } finally {
    await context.close();
  }
});

test('all registration roles persist the selected role and explain approval requirements', async ({ browser }) => {
  for (const role of ['buyer', 'farmer', 'business', 'logistics'] as const) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    let submittedRole = '';
    let submittedFarmName = '';
    let submittedPhone: string | undefined;
    try {
      await context.route(`${apiOrigin}/api/**`, (route) => route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({}),
      }));
      await context.route(`${apiOrigin}/api/auth/register`, async (route) => {
        const registration = route.request().postDataJSON();
        submittedRole = registration.role;
        submittedFarmName = registration.farm?.farmName ?? '';
        submittedPhone = registration.phone;
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            verification: { emailSent: true },
          }),
        });
      });
      await context.route('**/socket.io/**', (route) => route.abort());
      const page = await context.newPage();
      await page.goto(`/register?role=${role}`);
      await expect(page.getByLabel('Register as')).toHaveValue(role);
      await page.getByLabel('Full name').fill(`${role} Applicant`);
      await page.getByLabel('Email').fill(`${role}@example.test`);
      if (role === 'farmer') {
        await page.getByLabel('Farm name').fill('Applicant Farm');
        await page.getByLabel('Village').fill('Test Village');
        await page.getByLabel('District').fill('Test District');
        await page.getByLabel('State').fill('Test State');
        await page.getByLabel('PIN code').fill('123456');
      }
      await page.getByLabel('Password', { exact: true }).fill('LongPassword123!');
      await page.getByLabel('Confirm password').fill('LongPassword123!');
      await page.getByRole('button', { name: 'Create account' }).click();
      await expect(page).toHaveURL(/\/verify-account$/);
      expect(submittedRole).toBe(role);
      expect(submittedPhone).toBeUndefined();
      if (role === 'farmer') expect(submittedFarmName).toBe('Applicant Farm');
      await expect(page.getByLabel('Account email')).toHaveValue(`${role}@example.test`);
      await expect(page.getByText('Email verification', { exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: /Resend available in/ })).toBeVisible();
      expect(await page.evaluate(() => localStorage.getItem('agriconnect_session'))).toBeNull();
    } finally {
      await context.close();
    }
  }
});

test('email verification link completes account verification', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  try {
    await context.route(`${apiOrigin}/api/auth/verification/email/confirm`, async (route) => {
      expect(route.request().postDataJSON()).toEqual({ token: 'email-verification-token-12345678901234567890' });
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, email: 'buyer@example.test', emailVerified: true }),
      });
    });
    await context.route('**/socket.io/**', (route) => route.abort());

    const page = await context.newPage();
    await page.goto('/verify-account#token=email-verification-token-12345678901234567890');
    await expect(page.getByText('Your email address is verified and your account is ready.')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Email verified.' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Continue to sign in' })).toBeVisible();
  } finally {
    await context.close();
  }
});

test('unverified login offers a non-enumerating email resend action', async ({ page }) => {
  await page.route(`${apiOrigin}/api/auth/login`, (route) => route.fulfill({
    status: 403,
    contentType: 'application/json',
    body: JSON.stringify({
      success: false,
      code: 'EMAIL_NOT_VERIFIED',
      message: 'Verify your email address before signing in.',
    }),
  }));
  await page.route(`${apiOrigin}/api/auth/verification/email/resend`, (route) => route.fulfill({
    status: 202,
    contentType: 'application/json',
    body: JSON.stringify({
      success: true,
      message: 'If an account needs verification, a link will be sent when email delivery is available.',
    }),
  }));
  await page.route('**/socket.io/**', (route) => route.abort());
  await page.goto('/login');
  await page.getByLabel('Email').fill('buyer@example.test');
  await page.getByLabel('Password').fill('LongPassword123!');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('link', { name: 'Continue to email verification' })).toBeVisible();
  await page.getByRole('button', { name: 'Resend verification email' }).click();
  await expect(page.getByRole('status')).toContainText('If an account needs verification');
  await expect(page.getByRole('button', { name: /Resend available in/ })).toBeDisabled();
});

test('farmer listings, orders, payouts, and insights render the signed-in farmer data', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  try {
    await addSession(context, 'farmer');
    await context.route(`${apiOrigin}/api/crops/my-crops`, (route) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        listings: [{
          _id: 'crop-test-1',
          cropName: 'Test Tomatoes',
          category: 'Vegetables',
          unit: 'kg',
          pricePerUnitPaise: 4500,
          availableQuantity: 12,
          status: 'active',
          viewsCount: 7,
        }],
      }),
    }));
    await context.route(`${apiOrigin}/api/orders/farmer`, (route) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        orders: [{
          _id: 'order-test-1',
          orderNumber: 'FARMER-ORDER-1',
          status: 'delivered',
          items: [{ listingId: 'crop-test-1', farmerId: 'dashboard-test-farmer', cropName: 'Test Tomatoes', quantity: 3, unit: 'kg', totalPaise: 13500 }],
          pricing: { finalPayablePaise: 17500 },
          createdAt: '2025-01-01T00:00:00.000Z',
        }],
      }),
    }));
    await context.route(`${apiOrigin}/api/payouts/my-ledger`, (route) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        summary: { totalGrossPaise: 13500, totalFarmerSharePaise: 12150, totalSettledPaise: 0, pendingSettlementPaise: 12150 },
        ledgers: [{
          _id: 'ledger-test-1',
          orderNumber: 'FARMER-ORDER-1',
          grossProductValuePaise: 13500,
          farmerPayoutPaise: 12150,
          settlementStatus: 'on_hold',
          createdAt: '2025-01-01T00:00:00.000Z',
        }],
      }),
    }));

    const page = await context.newPage();
    await page.goto('/dashboard/listings');
    await expect(page.getByText('Test Tomatoes')).toBeVisible();
    await page.goto('/dashboard/orders');
    await expect(page.getByText('FARMER-ORDER-1')).toBeVisible();
    await page.goto('/dashboard/payouts');
    await expect(page.getByText('FARMER-ORDER-1')).toBeVisible();
    await expect(page.getByText('on hold')).toBeVisible();
    await page.goto('/dashboard/insights');
    await expect(page.getByText('Test Tomatoes', { exact: true })).toBeVisible();
    await expect(page.getByText('FARMER-ORDER-1')).toBeVisible();
    await expect(page.getByText('3', { exact: true })).toBeVisible();
  } finally {
    await context.close();
  }
});
