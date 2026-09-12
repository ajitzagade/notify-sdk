import { test, expect, type Page } from '@playwright/test';

const EMAIL = process.env.ADMIN_SEED_EMAIL ?? 'admin@example.com';
const PASSWORD = process.env.ADMIN_SEED_PASSWORD ?? '';

async function login(page: Page) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(EMAIL);
  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL(/\/tenants/);
}

test.describe('admin workspace', () => {
  test.skip(!PASSWORD, 'ADMIN_SEED_PASSWORD not set in apps/admin/.env.local');

  test('login lands on the tenants list', async ({ page }) => {
    await login(page);
    // 'AZentis' appears in both the sidebar nav and the tenant list — any match will do.
    await expect(page.getByRole('link', { name: /AZentis/ }).first()).toBeVisible();
  });

  test('tenant setup: templates step shows the starter gallery', async ({ page }) => {
    await login(page);
    await page.getByRole('link', { name: /AZentis/ }).first().click();
    await page.waitForURL(/\/tenants\/[0-9a-f-]+$/);

    await page.getByRole('button', { name: 'Setup' }).click();
    await page.getByRole('tab', { name: /Templates/ }).click();

    await expect(page.getByText('Starter templates')).toBeVisible();
    await expect(page.getByText('Appointment reminder')).toBeVisible();
    // Category pills are plain controlled buttons (not Base UI Tabs — see
    // StarterTemplateGallery); switching groups swaps the visible cards.
    await page.getByRole('button', { name: 'Promotions' }).click();
    // exact: the card title; the preview bubble text also contains the phrase
    await expect(page.getByText('Special offer', { exact: true })).toBeVisible();
    await expect(page.getByText('Appointment reminder', { exact: true })).toBeHidden();
  });

  test('tenant setup: credentials step shows the configured form (AZentis has creds)', async ({ page }) => {
    await login(page);
    await page.getByRole('link', { name: /AZentis/ }).first().click();
    await page.waitForURL(/\/tenants\/[0-9a-f-]+$/);

    await page.getByRole('button', { name: 'Setup' }).click();
    await page.getByRole('tab', { name: /Credentials/ }).click();

    // Configured tenant → chooser steps aside, the manual form renders directly.
    // (label in the form; the HelpSteps aside also mentions the phrase in a <b>)
    await expect(page.getByLabel('Phone Number ID')).toBeVisible();
  });

  test('analytics tab shows sending health when credentials are configured', async ({ page }) => {
    await login(page);
    await page.getByRole('link', { name: /AZentis/ }).first().click();
    await page.waitForURL(/\/tenants\/[0-9a-f-]+$/);

    // Analytics is the default workspace tab; health section renders for
    // credentialed tenants even when Meta tier data is unavailable.
    await expect(page.getByText('Sending health')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Customers messaged — last 24h')).toBeVisible();
  });
});
