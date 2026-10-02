import { expect, test } from '@playwright/test';

// Runs against the combined site build (python3 site/tools/build_all.py). Signed-out flows only: they need
// no live backend, so they run against any build.

test('landing Sign Up opens the register page on the same site', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  // Phones get the hamburger menu; Sign Up lives inside it.
  const menu = page.locator('header .hb').first();
  if (await menu.isVisible()) { await menu.click(); await page.locator('.mmenu').getByRole('link', { name: 'Sign Up' }).click(); }
  else await page.locator('header').getByRole('link', { name: 'Sign Up' }).first().click();
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
  await expect(page.locator('#exploreTitle')).toContainText('Jelajahi Semua Campaign');
  await page.goto('/forgot-password');
  await page.reload();
  await expect(page).toHaveURL(/\/forgot-password/);
});

test('brand books a meeting slot (Supabase mocked)', async ({ page }) => {
  let sent: Record<string, unknown> | null = null;
  await page.route('**/rest/v1/rpc/meeting_slots_taken', (r) => r.fulfill({ json: [] }));
  await page.route('**/rest/v1/rpc/request_meeting', async (r) => { sent = r.request().postDataJSON(); await r.fulfill({ json: { id: 'x', slot: sent!.p_slot } }); });
  await page.goto('/?mode=brand');
  await page.getByRole('link', { name: 'Jadwalkan Meeting' }).first().click();
  await expect(page).toHaveURL(/\/meeting/);
  await page.locator('#cal button[data-d]:not([disabled])').first().click();
  await page.locator('#slots button:not([disabled])').first().click();
  await page.fill('input[name=name]', 'Budi Santoso');
  await page.fill('input[name=company]', 'Acme Kopi');
  await page.fill('input[name=email]', 'budi@acme.id');
  await page.getByRole('button', { name: 'Kirim Permintaan Meeting' }).click();
  await expect(page.getByText('Permintaan terkirim')).toBeVisible();
  expect(sent!.p_company).toBe('Acme Kopi');
  const slot = new Date(String(sent!.p_slot));
  const wib = new Date(slot.getTime() + 7 * 3600e3);
  expect([1, 2, 3, 4, 5]).toContain(wib.getUTCDay());
  expect(wib.getUTCHours()).toBeGreaterThanOrEqual(10);
});

test('taken slot is reported and freed for another pick (Supabase mocked)', async ({ page }) => {
  await page.route('**/rest/v1/rpc/meeting_slots_taken', (r) => r.fulfill({ json: [] }));
  await page.route('**/rest/v1/rpc/request_meeting', (r) => r.fulfill({ status: 400, json: { message: 'meeting_slot_taken' } }));
  await page.goto('/meeting');
  await page.locator('#cal button[data-d]:not([disabled])').first().click();
  await page.locator('#slots button:not([disabled])').first().click();
  await page.fill('input[name=name]', 'Budi'); await page.fill('input[name=company]', 'Acme'); await page.fill('input[name=email]', 'b@acme.id');
  await page.getByRole('button', { name: 'Kirim Permintaan Meeting' }).click();
  await expect(page.getByText('Jam itu baru saja diambil')).toBeVisible();
  await expect(page.locator('#slots button[disabled]').first()).toBeVisible();
});
