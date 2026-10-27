import { expect, test } from '@playwright/test';
import { signedInCreator, UID } from './mock';

// Admin Blacklist page and the "Blacklist kreator" action (Supabase mocked).
const NOW = new Date().toISOString();
const ENTRY = { id: 'b1', kind: 'account', value: '081200009999', reason: 'bot views', creator_id: null, created_at: NOW };

test.beforeEach(async ({}, info) => { test.skip(info.project.name === 'phone', 'admin flows run once, on desktop'); });

test('admin adds and removes a blacklist entry', async ({ page }) => {
  await signedInCreator(page, { profiles: { id: UID, full_name: 'Admin TAPP', role: 'admin' }, login_policy: { require_login_otp: false, require_admin_mfa: false }, blocklist: [ENTRY] });
  const calls: { fn: string; body: Record<string, unknown> }[] = [];
  await page.route('**/rest/v1/rpc/admin_blocklist_add', async (r) => { calls.push({ fn: 'add', body: r.request().postDataJSON() }); await r.fulfill({ json: { ...ENTRY, id: 'b2' } }); });
  await page.route('**/rest/v1/rpc/admin_blocklist_remove', async (r) => { calls.push({ fn: 'remove', body: r.request().postDataJSON() }); await r.fulfill({ status: 204, body: '' }); });
  page.on('dialog', (d) => d.accept('banding diterima'));

  await page.goto('/admin/blacklist');
  await expect(page.getByRole('heading', { name: 'Blacklist' })).toBeVisible();
  await expect(page.getByText('081200009999')).toBeVisible();

  await page.getByLabel('Jenis').selectOption('email');
  await page.getByLabel('Identitas').fill('cheat@example.com');
  await page.getByLabel('Alasan').fill('akun palsu');
  await page.getByRole('button', { name: 'Blokir' }).click();
  await expect.poll(() => calls.find((c) => c.fn === 'add')?.body).toEqual({ p_kind: 'email', p_value: 'cheat@example.com', p_reason: 'akun palsu' });

  await page.getByRole('button', { name: 'Hapus (banding)' }).first().click();
  await expect.poll(() => calls.find((c) => c.fn === 'remove')?.body).toEqual({ p_id: 'b1', p_note: 'banding diterima' });
});
