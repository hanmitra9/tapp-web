import { expect, test } from '@playwright/test';

// Signed-out flows only: they need no live backend, so they run against any build.

test('welcome → register', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('Distribusikan konten brand.', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Lanjut' }).click();
  await expect(page.getByRole('heading', { name: /Gabung campaign/ })).toBeVisible();
  await page.getByRole('button', { name: 'Lanjut' }).click();
  await expect(page.getByRole('heading', { name: /Submit link-nya/ })).toBeVisible();
  await page.getByRole('button', { name: 'Buat akun' }).click();
  await expect(page).toHaveURL(/\/register/);
});

test('login validates before calling the server', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByText('Kata sandi', { exact: true }).first()).toBeVisible();
  await page.getByRole('button', { name: 'Masuk' }).click();
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByText(/email/i).nth(1)).toBeVisible();
});

test('protected deep link → login, remembered for after sign-in', async ({ page }) => {
  await page.goto('/campaigns');
  await expect(page).toHaveURL(/\/login/);
  expect(await page.evaluate(() => sessionStorage.getItem('tapp_return_to'))).toBe('/campaigns');
});

test('refreshing a deep link does not 404', async ({ page }) => {
  const res = await page.goto('/forgot-password');
  expect(res?.status()).toBe(200);
  await page.reload();
  await expect(page).toHaveURL(/\/forgot-password/);
});
