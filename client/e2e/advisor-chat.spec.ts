import { expect, test } from '@playwright/test';

const apiOrigin = 'https://agriconnect-api-ajoq.onrender.com';
const friendlyFallback = "I'm temporarily unable to answer your agricultural question. Please try again in a moment. You can share the crop, region, symptoms, and when the issue began so your question is ready to retry. For crop-protection or pesticide decisions, consult a local agricultural extension officer.";

for (const width of [320, 375, 390, 430]) {
  test(`farm assistant fits a ${width}px mobile viewport`, async ({ page }) => {
    await page.setViewportSize({ width, height: 640 });
    await page.goto('/login');
    await page.getByRole('button', { name: 'Open farm assistant' }).click();

    const panel = page.getByRole('region', { name: 'AgriConnect farm assistant' });
    await expect(panel).toBeVisible();
    const bounds = await panel.boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.y).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width);
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(640);
    await expect(page.getByRole('textbox', { name: 'Your question' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Send' })).toBeVisible();
  });
}

test('chat shows a friendly fallback and retries the same question without duplicating it', async ({ page }) => {
  let attempts = 0;
  await page.route(`${apiOrigin}/api/ai/advisor`, async (route) => {
    attempts += 1;
    const body = route.request().postDataJSON();
    if (attempts === 1) {
      await new Promise((resolve) => setTimeout(resolve, 300));
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          code: 'PROVIDER_UNAVAILABLE',
          fallback: true,
          message: 'Internal provider diagnostics: API key rejected, HTTP 503.',
        }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        provider: 'Grok',
        language: 'en',
        response: `${body.prompt} Check the newest leaves and note when symptoms began. `.repeat(35),
        fallback: false,
      }),
    });
  });
  await page.goto('/login');
  await page.getByRole('button', { name: 'Open farm assistant' }).click();
  const question = 'My tomato leaves have spots';
  const input = page.getByRole('textbox', { name: 'Your question' });
  await input.fill(question);
  await page.getByRole('button', { name: 'Send' }).click();
  await expect(page.getByRole('button', { name: 'Send' })).toBeDisabled();
  await expect(page.getByRole('alert')).toContainText(friendlyFallback);
  await expect(page.getByRole('alert')).not.toContainText('API key rejected');
  await expect(input).toHaveValue(question);
  await expect(page.getByRole('log', { name: 'Conversation messages' }).getByText(question, { exact: true })).toHaveCount(1);

  await page.getByRole('button', { name: 'Retry' }).click();
  await expect(page.getByText(`${question} Check the newest leaves and note when symptoms began.`)).toBeVisible();
  expect(attempts).toBe(2);
  await expect(input).toHaveValue('');
  const conversation = page.getByLabel('Chat conversation');
  const dimensions = await conversation.evaluate((element) => ({
    clientHeight: element.clientHeight,
    scrollHeight: element.scrollHeight,
  }));
  expect(dimensions.scrollHeight).toBeGreaterThan(dimensions.clientHeight);

  await page.getByRole('region', { name: 'AgriConnect farm assistant' })
    .getByRole('button', { name: 'Close assistant' })
    .click();
  await page.getByRole('button', { name: 'Open farm assistant' }).click();
  await expect(page.getByRole('log', { name: 'Conversation messages' }).getByText(question, { exact: true })).toHaveCount(1);
});
