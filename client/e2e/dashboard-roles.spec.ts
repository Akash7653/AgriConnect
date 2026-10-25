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
      await context.route(`${apiOrigin}/api/auth/signup`, async (route) => {
        const registration = route.request().postDataJSON();
        submittedRole = registration.role;
        submittedFarmName = registration.farm?.farmName ?? '';
        submittedPhone = registration.phone;
        await route.fulfill({
          status: 202,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            email: registration.email,
            otpSent: true,
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
      await expect(page.getByText('Email verification code', { exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: /Resend available in/ })).toBeVisible();
      await expect(page.getByLabel('Verification digit 1')).toHaveAttribute('autocomplete', 'one-time-code');
      expect(await page.evaluate(() => localStorage.getItem('agriconnect_session'))).toBeNull();
    } finally {
      await context.close();
    }
  }
});

test('change email returns to signup and clears the verification screen', async ({ page }) => {
  await page.route(`${apiOrigin}/api/auth/signup`, (route) => route.fulfill({
    status: 202,
    contentType: 'application/json',
    body: JSON.stringify({ success: true, email: 'change-email@example.test', otpSent: true }),
  }));
  await page.route('**/socket.io/**', (route) => route.abort());
  await page.goto('/register');
  await page.getByLabel('Full name').fill('Change Email Buyer');
  await page.getByLabel('Email').fill('change-email@example.test');
  await page.getByLabel('Password', { exact: true }).fill('LongPassword123!');
  await page.getByLabel('Confirm password').fill('LongPassword123!');
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page).toHaveURL(/\/verify-account$/);
  await page.getByRole('button', { name: 'Change email' }).click();
  await expect(page).toHaveURL(/\/register$/);
  await expect(page.getByLabel('Full name')).toBeVisible();
  await expect(page.getByLabel('Verification digit 1')).toHaveCount(0);
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
    await expect(page.getByText('Your email address is verified. Sign in to continue.')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Email verified.' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Continue to sign in' })).toBeVisible();
  } finally {
    await context.close();
  }
});

test('unverified login offers a non-enumerating OTP resend action', async ({ page }) => {
  await page.route(`${apiOrigin}/api/auth/login`, (route) => route.fulfill({
    status: 403,
    contentType: 'application/json',
    body: JSON.stringify({
      success: false,
      code: 'EMAIL_NOT_VERIFIED',
      message: 'Please verify your email with the six-digit code before signing in.',
    }),
  }));
  await page.route(`${apiOrigin}/api/auth/resend-otp`, (route) => route.fulfill({
    status: 202,
    contentType: 'application/json',
    body: JSON.stringify({
      success: true,
      message: 'If a signup for this email is waiting for verification, a new code has been sent.',
    }),
  }));
  await page.route('**/socket.io/**', (route) => route.abort());
  await page.goto('/login');
  await page.getByLabel('Email').fill('buyer@example.test');
  await page.getByLabel('Password').fill('LongPassword123!');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('link', { name: 'Continue to email verification' })).toBeVisible();
  await page.getByRole('button', { name: 'Resend verification code' }).click();
  await expect(page.getByRole('status')).toContainText('If a signup for this email is waiting');
  await expect(page.getByRole('button', { name: /Resend available in/ })).toBeDisabled();
});

test('signup verifies an autofilled code, stores the session, and continues to the requested page', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  try {
    await context.route(`${apiOrigin}/api/auth/signup`, (route) => route.fulfill({
      status: 202,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, email: 'new-buyer@example.test', otpSent: true }),
    }));
    await context.route(`${apiOrigin}/api/auth/verify-otp`, async (route) => {
      const payload = route.request().postDataJSON();
      expect(payload.email).toBe('new-buyer@example.test');
      if (payload.otp === '000000') {
        await route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({ success: false, code: 'OTP_INVALID', message: 'That verification code is incorrect. Check it and try again.' }),
        });
        return;
      }
      expect(payload.otp).toBe('123456');
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          token: 'verified-session-token',
          user: { id: 'verified-buyer', name: 'New Buyer', email: 'new-buyer@example.test', role: 'buyer', emailVerified: true },
        }),
      });
    });
    await context.route('**/socket.io/**', (route) => route.abort());
    const page = await context.newPage();
    await page.goto('/register?redirect=/shop');
    await page.getByLabel('Full name').fill('New Buyer');
    await page.getByLabel('Email').fill('new-buyer@example.test');
    await page.getByLabel('Password', { exact: true }).fill('LongPassword123!');
    await page.getByLabel('Confirm password').fill('LongPassword123!');
    await page.getByRole('button', { name: 'Create account' }).click();
    await expect(page).toHaveURL(/\/verify-account$/);

    const firstDigit = page.getByLabel('Verification digit 1');
    for (let index = 1; index <= 6; index += 1) {
      await page.getByLabel(`Verification digit ${index}`).fill('0');
    }
    await page.getByRole('button', { name: 'Verify and continue' }).click();
    await expect(page.getByRole('alert')).toContainText('incorrect');

    await firstDigit.evaluate((element) => {
      const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
      valueSetter?.call(element, '123456');
      element.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await expect(page.getByLabel('Verification digit 6')).toHaveValue('6');
    await page.getByRole('button', { name: 'Verify and continue' }).click();
    await expect(page).toHaveURL(/\/shop$/);
    const session = await page.evaluate(() => JSON.parse(localStorage.getItem('agriconnect_session') || 'null'));
    expect(session.token).toBe('verified-session-token');
  } finally {
    await context.close();
  }
});

test('signup delivery failure is shown and the user can retry sending the code', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  try {
    await context.route(`${apiOrigin}/api/auth/signup`, (route) => route.fulfill({
      status: 502,
      contentType: 'application/json',
      body: JSON.stringify({
        success: false,
        code: 'OTP_DELIVERY_FAILED',
        message: 'We could not send your verification code. Please retry.',
        retryable: true,
      }),
    }));
    await context.route(`${apiOrigin}/api/auth/resend-otp`, (route) => route.fulfill({
      status: 202,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, message: 'If a signup is waiting, a new code has been sent.' }),
    }));
    await context.route('**/socket.io/**', (route) => route.abort());
    const page = await context.newPage();
    await page.goto('/register');
    await page.getByLabel('Full name').fill('Retry Buyer');
    await page.getByLabel('Email').fill('retry-buyer@example.test');
    await page.getByLabel('Password', { exact: true }).fill('LongPassword123!');
    await page.getByLabel('Confirm password').fill('LongPassword123!');
    await page.getByRole('button', { name: 'Create account' }).click();
    await expect(page.getByText('We could not send your verification code. Please retry.', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Retry sending verification code' }).click();
    await expect(page).toHaveURL(/\/verify-account$/);
    await expect(page.getByLabel('Account email')).toHaveValue('retry-buyer@example.test');
  } finally {
    await context.close();
  }
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
