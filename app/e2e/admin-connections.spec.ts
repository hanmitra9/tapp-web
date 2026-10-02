import { expect, test } from '@playwright/test';
import { signedInCreator, UID } from './mock';

const ROWS = [
  { id: 'c1', creator_id: UID, full_name: 'Rani Putri', username: 'rani', platform: 'tiktok', handle: 'rani.clips', status: 'error',
    scopes: ['user.info.basic', 'video.list'], token_expires_at: '2026-10-03T00:00:00Z', last_synced_at: null, last_error: 'tiktok_refresh: invalid_grant',
    connected_at: '2026-09-30T00:00:00Z', revoked_at: null, verified: true, tracked: 3, last_api_metric_at: '2026-10-01T09:00:00Z' },
];

test('admin sees connections and can cut one with a reason', async ({ page }) => {
  await signedInCreator(page, {
    profiles: { id: UID, full_name: 'Admin TAPP', role: 'admin' },
    admin_platform_connections: ROWS,
  }, { aal: 'aal2', amr: [{ method: 'totp', timestamp: 1 }] });
  let sent: Record<string, unknown> | null = null;
  await page.route('**/rest/v1/rpc/admin_disconnect_platform', async (r) => { sent = r.request().postDataJSON(); await r.fulfill({ status: 204, body: '' }); });
  page.on('dialog', (d) => d.accept());

  await page.goto('/admin/connections');
  await expect(page.getByRole('heading', { name: 'Koneksi akun' })).toBeVisible();
  await page.getByRole('tab', { name: 'Bermasalah' }).or(page.getByRole('button', { name: 'Bermasalah' })).click();
  await page.getByRole('button', { name: /TikTok @rani\.clips/ }).click();
  await expect(page.getByText('tiktok_refresh: invalid_grant')).toBeVisible();
  await expect(page.getByText('Perlu sambung ulang').first()).toBeVisible();

  await page.getByRole('button', { name: 'Putuskan koneksi' }).click();
  await expect(page.getByText('Tulis alasan')).toBeVisible();          // reason required, nothing sent
  expect(sent).toBeNull();
  await page.getByLabel('Alasan memutus (dikirim ke kreator)').fill('Akun dipakai bersama');
  await page.getByLabel('Cabut juga verifikasi akun ini').check();
  await page.getByRole('button', { name: 'Putuskan koneksi' }).click();
  await expect.poll(() => sent).toEqual({ p_connection_id: 'c1', p_reason: 'Akun dipakai bersama', p_unverify: true });
});

test('admin without 2FA gets in when require_admin_mfa is off', async ({ page }) => {
  await signedInCreator(page, { profiles: { id: UID, full_name: 'Admin TAPP', role: 'admin' }, login_policy: { require_login_otp: false, require_admin_mfa: false }, admin_platform_connections: [] });
  await page.goto('/admin/connections');
  await expect(page.getByRole('heading', { name: 'Koneksi akun' })).toBeVisible();
});

test('admin without 2FA is asked for it while require_admin_mfa is on', async ({ page }) => {
  await signedInCreator(page, { profiles: { id: UID, full_name: 'Admin TAPP', role: 'admin' }, login_policy: { require_login_otp: false, require_admin_mfa: true } });
  await page.goto('/admin/connections');
  await expect(page.getByRole('heading', { name: 'Koneksi akun' })).toHaveCount(0);
});

test('2FA setup survives leaving the page (same QR and secret after a reload, no new enrollment)', async ({ page }) => {
  await signedInCreator(page, { profiles: { id: UID, full_name: 'Admin TAPP', role: 'admin' }, login_policy: { require_login_otp: false, require_admin_mfa: true } });
  let enrolled = 0, unenrolled = 0, factors: object[] = [];
  const user = { id: UID, aud: 'authenticated', role: 'authenticated', email: 'admin@example.com', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' };
  await page.route('**/auth/v1/user', (r) => r.fulfill({ json: { ...user, factors } }));
  await page.route('**/auth/v1/factors**', (r) => {
    if (r.request().method() === 'DELETE') { unenrolled++; return r.fulfill({ json: { id: 'f1' } }); }
    enrolled++;
    factors = [{ id: 'f1', factor_type: 'totp', status: 'unverified', friendly_name: 'TAPP', created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' }];
    return r.fulfill({ json: { id: 'f1', type: 'totp', totp: { qr_code: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg"/>', secret: 'SECRETONE', uri: 'otpauth://x' } } });
  });
  await page.goto('/admin/');
  await expect(page.getByText('SECRETONE')).toBeVisible();
  await page.reload();
  await expect(page.getByText('SECRETONE')).toBeVisible();
  expect(enrolled).toBe(1);
  expect(unenrolled).toBe(0);
});
