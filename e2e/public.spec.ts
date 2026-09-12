import { test, expect } from '@playwright/test';

test.describe('public pages (no auth)', () => {
  test('privacy policy renders without a session', async ({ page }) => {
    await page.goto('/privacy');
    await expect(page.getByRole('heading', { name: 'Privacy Policy' })).toBeVisible();
    await expect(page.getByText('azentisit@gmail.com').first()).toBeVisible();
  });

  test('data deletion instructions render without a session', async ({ page }) => {
    await page.goto('/data-deletion');
    await expect(page.getByRole('heading', { name: 'Data Deletion Instructions' })).toBeVisible();
  });

  test('protected pages redirect to login', async ({ page }) => {
    await page.goto('/tenants');
    await expect(page).toHaveURL(/\/login\?next=/);
    // CardTitle renders a div, not a heading element — match by text.
    await expect(page.getByText('Admin console')).toBeVisible();
  });

  test('portal login page renders', async ({ page }) => {
    await page.goto('/portal/login');
    await expect(page.getByLabel('Email')).toBeVisible();
  });
});
