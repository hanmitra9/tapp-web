import { expect, test } from '@playwright/test';
import { signedInCreator } from './mock';

const ON = { value: { tiktok: { enabled: true } } };

test('TikTok connect button opens the TikTok login from the function', async ({ page }) => {
  await signedInCreator(page, { app_settings: ON });
  let called = false;
  await page.route('**/functions/v1/tiktok-oauth', (r) => { called = true; return r.fulfill({ json: { url: 'https://www.tiktok.com/v2/auth/authorize/?client_key=k&state=s' } }); });
  await page.route('https://www.tiktok.com/**', (r) => r.fulfill({ contentType: 'text/html', body: '<title>TikTok login</title>' }));
  await page.goto('/profile/socials');
  await page.getByRole('button', { name: 'Hubungkan dengan TikTok' }).click();
  await expect(page).toHaveURL(/tiktok\.com\/v2\/auth\/authorize/);
  expect(called).toBe(true);
});

test('TikTok connect stays hidden until it is switched on', async ({ page }) => {
  await signedInCreator(page, { app_settings: { value: { tiktok: { enabled: false } } } });
  await page.goto('/profile/socials');
  await expect(page.getByText('Akun media sosial').first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Hubungkan dengan TikTok' })).toHaveCount(0);
});

test('result of the TikTok login is shown on return', async ({ page }) => {
  await signedInCreator(page, {
    app_settings: ON,
    creator_platforms: [{ id: 'p1', platform: 'tiktok', handle: 'rani.clips', profile_url: null, followers: 1200, verified_at: '2026-10-01T00:00:00Z' }],
  });
  await page.goto('/profile/socials?tiktok=connected&handle=rani.clips');
  await expect(page.getByText('TikTok @rani.clips terhubung dan terverifikasi', { exact: false })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Hubungkan ulang TikTok' })).toBeVisible();
  await page.goto('/profile/socials?tiktok=error&reason=taken');
  await expect(page.getByText('sudah terdaftar di kreator lain', { exact: false })).toBeVisible();
});
