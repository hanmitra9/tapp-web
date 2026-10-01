import { expect, test } from '@playwright/test';

// Runs against the combined site build (python3 site/tools/build_all.py). Signed-out flows only: they need
// no live backend, so they run against any build.

test('landing Sign Up opens the register page on the same site', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await page.locator('header').getByRole('link', { name: 'Sign Up' }).click();
  await expect(page).toHaveURL(/\/register$/);
  await expect(page.getByRole('button', { name: 'Log In' })).toBeVisible();   // landing-style header
});

test('login validates before calling the server', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByText('Kata sandi', { exact: true }).first()).toBeVisible();
  await page.getByRole('button', { name: 'Masuk' }).click();
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByText(/email/i).nth(1)).toBeVisible();
});

test('signed-in page while signed out → login, remembered for after sign-in', async ({ page }) => {
  await page.goto('/dashboard/campaigns');
  await expect(page).toHaveURL(/\/login/);
  expect(await page.evaluate(() => sessionStorage.getItem('tapp_return_to'))).toBe('/dashboard/campaigns');
});

test('public pages stay static, deep app links survive a refresh', async ({ page }) => {
  const res = await page.goto('/campaigns');
  expect(res?.status()).toBe(200);
  await expect(page.locator('h1')).toContainText('Brief yang');
  await page.goto('/forgot-password');
  await page.reload();
  await expect(page).toHaveURL(/\/forgot-password/);
});
