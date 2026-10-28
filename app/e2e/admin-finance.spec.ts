import { expect, test } from '@playwright/test';
import { signedInCreator, UID } from './mock';

// Admin Keuangan page: monthly recap, deposit with invoice, service status (Supabase mocked).
const NOW = new Date().toISOString();
const MONTH = { month: NOW.slice(0, 8) + '01', deposits: 10000000, service_fees: 1800000, creator_gross: 2000000, creator_fees: 400000, creator_net: 1600000,
  withdrawals_paid: 1500000, withdrawal_fees: 15000, bonuses: 30000, refunds: 0, refund_fees: 0, refunds_paid: 0 };
const LEDGER = { id: 'l1', brand_id: 'b1', brand_name: 'Kopi Nusa', campaign_id: null, campaign_title: null, kind: 'deposit', amount: 10000000, fee_pct: 18,
  fee: 1800000, net: 8200000, invoice_no: 'INV-TAPP-202610-0001', reference: 'BCA', note: null, created_at: NOW };

test.beforeEach(async ({}, info) => { test.skip(info.project.name === 'phone', 'admin flows run once, on desktop'); });

test('admin finance: recap, record a deposit, print its invoice', async ({ page }) => {
  await signedInCreator(page, {
    profiles: { id: UID, full_name: 'Admin TAPP', role: 'admin' }, login_policy: { require_login_otp: false, require_admin_mfa: false },
    admin_finance_monthly: [MONTH], admin_brand_ledger: [LEDGER], uptime_checks: [{ target: 'site', status_code: 200, ok: true, created_at: NOW }],
    brands: [{ id: 'b1', name: 'Kopi Nusa', slug: 'kopi-nusa', logo_url: null, website: null, status: 'active', created_at: NOW }], admin_campaigns: [],
  });
  let body: Record<string, unknown> | null = null;
  await page.route('**/rest/v1/rpc/admin_record_deposit', async (r) => { body = r.request().postDataJSON(); await r.fulfill({ json: { ...LEDGER, id: 'l2', invoice_no: 'INV-TAPP-202610-0002' } }); });

  await page.goto('/admin/finance');
  await expect(page.getByRole('heading', { name: 'Keuangan' })).toBeVisible();
  // income = 1.8M + 400k + 15k − 30k
  await expect(page.getByText('Rp2.185.000').first()).toBeVisible();
  await expect(page.getByText('INV-TAPP-202610-0001')).toBeVisible();

  await page.getByLabel('Brand').selectOption('b1');
  await page.getByLabel('Nominal diterima (Rp)').fill('5000000');
  await expect(page.getByText('budget campaign Rp4.100.000')).toBeVisible();
  await page.getByLabel('Referensi transfer').fill('BCA 28/10');
  await page.getByRole('button', { name: 'Simpan setoran' }).click();
  await expect.poll(() => body).toEqual({ p_brand_id: 'b1', p_campaign_id: null, p_amount: 5000000, p_reference: 'BCA 28/10', p_note: '' });

  const popup = page.waitForEvent('popup');
  await page.getByRole('button', { name: 'Cetak invoice' }).click();
  const inv = await popup;
  await expect(inv.getByText('INVOICE')).toBeVisible();
  await expect(inv.getByRole('cell', { name: 'Budget campaign' })).toBeVisible();
});
