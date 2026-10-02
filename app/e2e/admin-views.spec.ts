import { expect, test } from '@playwright/test';
import { signedInCreator, UID } from './mock';

const SUB = {
  id: 's1', campaign_id: 'c1', creator_id: UID, platform: 'tiktok', post_url: 'https://www.tiktok.com/@rani/video/1', published_at: '2026-10-01T00:00:00Z',
  caption: null, screenshot_path: null, status: 'approved', review_reason: null, reviewed_at: null, content_state: 'live', qualified_views: 0, earned: 0,
  last_metrics_at: null, created_at: '2026-10-01T00:00:00Z', campaign_title: 'TAPP Campaign', campaign_status: 'active', cpm: 3000, min_views_to_qualify: 5000,
  max_earning_per_submission: null, budget: 5000000, campaign_earned: 0, budget_override: false, submission_deadline: null, brand_name: 'TAPP',
  creator_name: 'Rani Putri', creator_username: 'rani', creator_status: 'active', creator_tier: 'new', account_handle: 'rani', account_followers: 1200,
  creator_approved: 1, creator_rejected: 0, latest_metric_id: null, views: null, likes: null, comments: null, shares: null, saves: null,
  metrics_captured_at: null, metric_count: 0, auto_hold_reason: null, auto_hold_at: null,
};

test.beforeEach(async ({ page }, info) => {
  test.skip(info.project.name === 'phone', 'admin flows run once, on desktop');
  await signedInCreator(page, { profiles: { id: UID, full_name: 'Admin TAPP', role: 'admin' }, admin_submissions: [SUB] }, { aal: 'aal2' });
});

test('admin fills views once and they go straight into the brand report', async ({ page }) => {
  const calls: { fn: string; body: Record<string, unknown> }[] = [];
  await page.route('**/rest/v1/rpc/admin_record_metrics', async (r) => { calls.push({ fn: 'record', body: r.request().postDataJSON() }); await r.fulfill({ json: { id: 'm1', views: 12500 } }); });
  await page.route('**/rest/v1/rpc/admin_qualify_views', async (r) => { calls.push({ fn: 'qualify', body: r.request().postDataJSON() }); await r.fulfill({ json: { qualified_views: 12500 } }); });
  await page.goto('/admin/performance');
  await page.getByRole('button', { name: /TAPP Campaign/ }).first().click();
  await page.getByLabel('Views *').fill('12.500');
  await page.getByRole('button', { name: 'Simpan & masukkan ke laporan' }).click();
  await expect(page.getByText('12.500 views masuk ke laporan brand')).toBeVisible();
  expect(calls.map((c) => c.fn)).toEqual(['record', 'qualify']);
  expect(calls[0]!.body).toMatchObject({ p_submission_id: 's1', p_views: 12500, p_source: 'manual', p_content_state: 'live' });
  expect(calls[1]!.body).toMatchObject({ p_submission_id: 's1', p_metric_id: 'm1', p_qualified_views: 12500, p_allow_decrease: false });
});

test('approve is one click; reject still asks for a reason', async ({ page }) => {
  const sub = { ...SUB, status: 'pending_review' };
  await signedInCreator(page, { profiles: { id: UID, full_name: 'Admin TAPP', role: 'admin' }, admin_submissions: [sub] }, { aal: 'aal2' });
  const sent: Record<string, unknown>[] = [];
  await page.route('**/rest/v1/rpc/admin_review_submission', async (r) => { sent.push(r.request().postDataJSON()); await r.fulfill({ json: {} }); });
  await page.goto('/admin/submissions');
  await page.getByRole('button', { name: /TAPP Campaign/ }).first().click();
  await page.getByRole('button', { name: 'Tolak', exact: true }).click();
  await page.getByRole('button', { name: 'Konfirmasi: Ditolak' }).or(page.getByRole('button', { name: /^Konfirmasi:/ })).click();
  await expect(page.getByText('Alasan wajib diisi')).toBeVisible();
  expect(sent).toHaveLength(0);
  await page.getByRole('button', { name: 'Setujui', exact: true }).click();
  await expect.poll(() => sent).toEqual([{ p_submission_id: 's1', p_decision: 'approved', p_reason: null }]);
});

test('accepted clip is paid from "Siap dibayar": views + transfer reference, amount after the level fee', async ({ page }) => {
  const sub = { ...SUB, status: 'approved', views: 20000, latest_metric_id: null };
  await signedInCreator(page, {
    profiles: { id: UID, full_name: 'Admin TAPP', role: 'admin' }, admin_submissions: [sub],
    creator_payout_methods: [{ kind: 'bank', provider: 'BCA', account_name: 'Rani Putri', account_number: '1234567890' }],
    app_settings: [{ value: { new: 5 } }], payout_requests: [],
  }, { aal: 'aal2' });
  const sent: Record<string, unknown>[] = [];
  await page.route('**/rest/v1/rpc/admin_pay_submission', async (r) => { sent.push(r.request().postDataJSON()); await r.fulfill({ json: { id: 'p1', status: 'paid' } }); });
  await page.goto('/admin/submissions?q=payable');
  await page.getByRole('button', { name: /TAPP Campaign/ }).first().click();
  await page.getByLabel('Views').fill('20.000');
  await expect(page.getByText('Ke BCA 1234567890 a.n. Rani Putri')).toBeVisible();
  // 20.000 views × Rp3.000 / 1.000 = Rp60.000, minus the New-level fee (5% = Rp3.000) → Rp57.000 transferred
  await page.getByLabel('Referensi transfer').fill('BCA 0210');
  await page.getByRole('button', { name: /Tandai sudah ditransfer Rp57\.000/ }).click();
  await expect.poll(() => sent).toEqual([{ p_submission_id: 's1', p_views: 20000, p_reference: 'BCA 0210', p_note: null }]);
});
