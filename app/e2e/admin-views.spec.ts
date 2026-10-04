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

test('accepted clip is credited to the creator balance from "Siap dibayar": views only, no transfer', async ({ page }) => {
  const sub = { ...SUB, status: 'approved', views: 20000, latest_metric_id: null };
  await signedInCreator(page, { profiles: { id: UID, full_name: 'Admin TAPP', role: 'admin' }, admin_submissions: [sub] }, { aal: 'aal2' });
  const sent: Record<string, unknown>[] = [];
  await page.route('**/rest/v1/rpc/admin_credit_submission', async (r) => { sent.push(r.request().postDataJSON()); await r.fulfill({ json: { id: 's1', status: 'completed' } }); });
  await page.goto('/admin/submissions?q=payable');
  await page.getByRole('button', { name: /TAPP Campaign/ }).first().click();
  await page.getByLabel('Views').fill('20.000');
  // 20.000 views × Rp3.000 / 1.000 = Rp60.000 into the balance; bonus and withdrawal fee apply when the creator withdraws.
  await expect(page.getByText('Bonus level dan biaya tarik dihitung saat kreator menarik saldo.')).toBeVisible();
  await page.getByRole('button', { name: /Masukkan Rp60\.000 ke saldo/ }).click();
  await expect.poll(() => sent).toEqual([{ p_submission_id: 's1', p_views: 20000, p_note: null }]);
});

test('pay form prefills the views read from the public post', async ({ page }) => {
  await signedInCreator(page, {
    profiles: { id: UID, full_name: 'Admin TAPP', role: 'admin' }, admin_submissions: [{ ...SUB, status: 'approved' }],
    creator_payout_methods: [{ kind: 'bank', provider: 'BCA', account_name: 'Rani Putri', account_number: '1234567890' }],
    app_settings: [{ value: { new: 0 } }], payout_requests: [],
  }, { aal: 'aal2' });
  await page.route('**/functions/v1/public-views', (r) => r.fulfill({ json: { views: 31000, likes: 2100, comments: 40, shares: 12, read_at: '2026-10-02T10:00:00Z' } }));
  await page.goto('/admin/submissions?q=payable');
  await page.getByRole('button', { name: /TAPP Campaign/ }).first().click();
  await expect(page.getByLabel('Views')).toHaveValue('31000');
  await expect(page.getByText(/Terbaca otomatis: 31\.000 views/)).toBeVisible();
});

test('review shows the automatic link check made at submit, and can re-check', async ({ page }) => {
  const sub = { ...SUB, status: 'pending_review' };
  const check = { submission_id: 's1', status: 'not_owner', author: 'orang.lain', views: 48200, likes: 3100, comments: null, shares: null,
    note: 'Diposting oleh @orang.lain, bukan @rani', checked_at: '2026-10-01T01:00:00Z' };
  await signedInCreator(page, { profiles: { id: UID, full_name: 'Admin TAPP', role: 'admin' }, admin_submissions: [sub], submission_checks: [check] }, { aal: 'aal2' });
  let rechecked = 0;
  await page.route('**/functions/v1/submission-check', async (r) => { rechecked++; await r.fulfill({ json: { ...check, status: 'ok', author: 'rani', note: null } }); });
  await page.goto('/admin/submissions');
  await expect(page.getByText('Bukan akun kreator').first()).toBeVisible();          // badge in the queue
  await page.getByRole('button', { name: /TAPP Campaign/ }).first().click();
  await expect(page.getByText('Diposting oleh @orang.lain, bukan @rani')).toBeVisible();
  await page.getByRole('button', { name: 'Cek ulang' }).click();
  await expect(page.getByText('Akun cocok')).toBeVisible();
  expect(rechecked).toBe(1);
});

test('review shows the fairness score from the views history (bot-like spike flagged)', async ({ page }) => {
  const sub = { ...SUB, status: 'pending_review', account_followers: 1200 };
  const check = { submission_id: 's1', status: 'ok', author: 'rani', views: 40000, likes: 90, comments: 3, shares: 1, note: null, checked_at: '2026-10-01T06:00:00Z' };
  const log = [
    { submission_id: 's1', checked_at: '2026-10-01T00:00:00Z', status: 'ok', views: 2000, likes: 60, comments: 3, shares: 1 },
    { submission_id: 's1', checked_at: '2026-10-01T06:00:00Z', status: 'ok', views: 40000, likes: 90, comments: 3, shares: 1 },
  ];
  await signedInCreator(page, { profiles: { id: UID, full_name: 'Admin TAPP', role: 'admin' }, admin_submissions: [sub], submission_checks: [check], submission_check_log: log, submissions: [] }, { aal: 'aal2' });
  await page.goto('/admin/submissions');
  await page.getByRole('button', { name: /TAPP Campaign/ }).first().click();
  await expect(page.getByText(/Skor kewajaran: \d+\/100 · Mencurigakan/)).toBeVisible();
  await expect(page.getByText(/Lonjakan 20× dalam 6 jam/)).toBeVisible();
});
