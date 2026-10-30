import { expect, test } from '@playwright/test';
import { signedInCreator, UID } from './mock';

// Admin Langganan page: plans with guaranteed views, link a draft campaign, record a month's payment (Supabase mocked).
const NOW = new Date().toISOString();
const PLANS = [{ id: 'p1', name: 'Starter', monthly_price: 500000, price_per_1k: 1500, active: true, sort: 1 },
  { id: 'p2', name: 'Growth', monthly_price: 2500000, price_per_1k: 1500, active: true, sort: 2 }];
const SUB = { id: 's1', brand_id: 'b1', brand_name: 'Kopi Nusa', campaign_id: 'c1', campaign_title: 'Kopi Bulanan', campaign_status: 'active', plan_name: 'Growth',
  monthly_price: 2500000, price_per_1k: 1500, status: 'active', next_bill_at: '2026-11-29', created_at: NOW,
  progress: { delivered: 400000, target_total: 1666666, periods: 1, period_start: '2026-10-30', period_end: '2026-11-29', period_target: 1666666, period_delivered: 400000, breach_views: 0, expected_now: 300000 } };
const DRAFT = { id: 'c9', brand_id: 'b1', brand_name: 'Kopi Nusa', title: 'Kopi Desember', content_type: 'clipping', status: 'draft' };

test.beforeEach(async ({}, info) => { test.skip(info.project.name === 'phone', 'admin flows run once, on desktop'); });

test('admin subscriptions: plan math, link a campaign, record a payment', async ({ page }) => {
  await signedInCreator(page, {
    profiles: { id: UID, full_name: 'Admin TAPP', role: 'admin' }, login_policy: { require_login_otp: false, require_admin_mfa: false },
    subscription_plans: PLANS, admin_subscriptions_list: [SUB], admin_campaigns: [DRAFT],
  });
  const calls: Record<string, unknown>[] = [];
  await page.route('**/rest/v1/rpc/admin_create_subscription', async (r) => { calls.push(r.request().postDataJSON()); await r.fulfill({ json: { id: 's2' } }); });
  await page.route('**/rest/v1/rpc/admin_subscription_payment', async (r) => {
    calls.push(r.request().postDataJSON());
    await r.fulfill({ json: { id: 'l1', kind: 'deposit', amount: 2500000, fee_pct: 18, fee: 450000, net: 2050000, invoice_no: 'INV-TAPP-202611-0003', reference: 'BCA 29/11', note: null, created_at: NOW } });
  });
  page.on('dialog', (d) => d.accept('BCA 29/11'));

  await page.goto('/admin/subscriptions');
  await expect(page.getByRole('heading', { name: 'Langganan', exact: true })).toBeVisible();
  // Starter: 333.333 views, creator Rp984 / 1.000, TAPP Rp172.000
  await expect(page.getByRole('cell', { name: '333.333' })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Rp984' }).first()).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Rp172.000' })).toBeVisible();
  await expect(page.getByText('400.000 / 1.666.666 (24%)')).toBeVisible();

  await page.getByLabel('Campaign draft (clipping)').selectOption('c9');
  await page.getByLabel('Paket').selectOption('p1');
  await page.getByRole('button', { name: 'Hubungkan ke paket' }).click();
  await expect.poll(() => calls[0]).toEqual({ p_campaign_id: 'c9', p_plan_id: 'p1' });

  const popup = page.waitForEvent('popup');
  await page.getByRole('button', { name: 'Catat bayar' }).click();
  await expect.poll(() => calls[1]).toEqual({ p_sub_id: 's1', p_reference: 'BCA 29/11', p_note: '' });
  const inv = await popup;
  await expect(inv.getByText('INV-TAPP-202611-0003')).toBeVisible();
});
