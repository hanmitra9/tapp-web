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
