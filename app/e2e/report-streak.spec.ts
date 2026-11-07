import { expect, test } from '@playwright/test';
import { signedInCreator, UID } from './mock';

// Shareable campaign report (brand button + public page), weekly streak, trim entry (Supabase mocked).
const CID = '30000000-0000-0000-0000-000000000002';
const NOW = new Date().toISOString();
const TOKEN = 'a'.repeat(32);
const days = Array.from({ length: 30 }, (_, i) => ({ day: new Date(Date.now() - (29 - i) * 86400e3).toISOString().slice(0, 10), views: i % 3 ? 12000 * i : 0 }));

test('public report page shows results without login or money', async ({ page }) => {
  await page.route('**/rest/v1/rpc/public_campaign_report', (r) => r.fulfill({ json: {
    title: 'Kopi Susu Launch', brand: 'Kopi Nusa', logo: null, status: 'active', starts_at: NOW, ends_at: null, platforms: ['tiktok', 'instagram'],
    creators: 12, clips: 9, views: 5_400_000, qualified_views: 4_000_000, updated_at: NOW, engagement: 0.0612,
    per_platform: [{ platform: 'tiktok', clips: 6, views: 4_000_000 }, { platform: 'instagram', clips: 3, views: 1_400_000 }],
    daily: days, top: [{ creator: 'rani', platform: 'tiktok', url: 'https://www.tiktok.com/@rani/video/1', views: 800000 }],
  } }));
  await page.goto(`/laporan.html?t=${TOKEN}`);
  await expect(page.getByRole('heading', { name: 'Kopi Susu Launch' })).toBeVisible();
  await expect(page.getByText('5,4 jt')).toBeVisible();
  await expect(page.getByText('6,1%')).toBeVisible();
  await expect(page.getByText('@rani')).toBeVisible();
  await expect(page.getByText('Per platform')).toBeVisible();
  await expect(page.getByText(/Rp/)).toHaveCount(0);
});

test('turned-off report link says so', async ({ page }) => {
  await page.route('**/rest/v1/rpc/public_campaign_report', (r) => r.fulfill({ json: null }));
  await page.goto(`/laporan.html?t=${TOKEN}`);
  await expect(page.getByText(/sudah tidak aktif/)).toBeVisible();
});

test('brand makes a share link for the report', async ({ page }) => {
  let made = false;
  await signedInCreator(page, {
    profiles: { id: UID, full_name: 'Dina', role: 'brand' },
    my_brands: [{ id: 'b1', name: 'Kopi Nusa', logo_url: null, role: 'owner', daily_report: true }],
    brand_campaigns: [{ id: CID, brand_id: 'b1', brand_name: 'Kopi Nusa', title: 'Kopi Susu Launch', category: 'product', status: 'active', cpm: 1500,
      budget: 15000000, spent: 6000000, remaining: 9000000, starts_at: NOW, ends_at: null, submission_deadline: null, platforms: ['tiktok'],
      creators_joined: 12, submissions: 3, approved: 2, qualified_views: 4000000, raw_views: 5000000, pending_views: 0, excluded_views: 0,
      fee_pct: 15, platform_fee: 900000, total_cost: 6900000, effective_cpm: 1200, last_metrics_at: NOW, last_qualified_at: NOW }],
    brand_report_link: null,
  });
  await page.route('**/rest/v1/rpc/brand_set_report_link', (r) => { made = true; return r.fulfill({ json: TOKEN }); });
  await page.addInitScript(() => { Object.defineProperty(navigator, 'share', { value: undefined }); });
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto(`/brand-campaign/${CID}`);
  await expect(page.getByText('Laporan publik')).toBeVisible();
  await page.getByRole('button', { name: 'Buat link' }).click();
  await expect(page.getByText(`laporan.html?t=${TOKEN}`)).toBeVisible();
  expect(made).toBe(true);
  await expect(page.getByRole('button', { name: 'Matikan' })).toBeVisible();
});

test('dashboard and recap show the weekly streak', async ({ page }) => {
  await signedInCreator(page, {
    my_streak: { current: 5, best: 9, this_week: false },
    my_monthly_recap: { month: '2026-10-01', views: 1000, clips: 2, campaigns: 1, best_views: 900, tier: 'new', name: 'rani', top_pct: 50, creators: 10,
      streak: { current: 5, best: 9, this_week: false } },
  });
  await page.goto('/dashboard');
  await expect(page.getByText('Streak 5 minggu · Konsisten')).toBeVisible();
  await expect(page.getByText(/biar nggak putus/)).toBeVisible();
  await page.goto('/recap');
  await expect(page.getByText('9 minggu')).toBeVisible();
  await expect(page.getByText('Rajin', { exact: true })).toBeVisible();
});

test('a raw video asset has a trim button that opens the trimmer', async ({ page }) => {
  await signedInCreator(page, {
    get_campaign: { id: CID, title: 'Kopi Susu Launch', objective: null, description: 'x', category: 'product', content_type: 'clipping', status: 'active',
      cpm: 1500, budget: 1000000, remaining: 1000000, min_views_to_qualify: 0, max_earning_per_submission: null, starts_at: NOW, ends_at: null,
      submission_deadline: null, guidelines_do: [], guidelines_dont: [], terms: null, brand: { name: 'Kopi Nusa', logo_url: null, website: null },
      platforms: ['tiktok'], rules: [], creators_joined: 3, membership: { status: 'joined', joined_at: NOW }, join_block: null },
    campaign_assets: [{ id: 'as1', kind: 'video', title: 'Video mentah 1', url: null, storage_path: 'c/raw.mp4' }],
  });
  // POST = make the signed URL; GET = the video itself (not needed to render the trimmer).
  await page.route('**/storage/v1/object/sign/**', (r) => r.request().method() === 'POST'
    ? r.fulfill({ json: { signedURL: '/object/sign/campaign-assets/c/raw.mp4?token=t' } }) : r.fulfill({ status: 404, body: '' }));
  await page.goto(`/campaign/${CID}`);
  await page.getByRole('button', { name: 'Potong Video mentah 1' }).click();
  await expect(page).toHaveURL(/\/trim\?/);
  await expect(page.getByText('Potong video').first()).toBeVisible();
  await expect(page.getByText('Video mentah 1').last()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Potong & buat video' })).toBeVisible();
});

test('streak page shows the big number, the week calendar and the share card', async ({ page }) => {
  const now = new Date(); const monday = new Date(now); monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  const weeks = Array.from({ length: 26 }, (_, i) => { const d = new Date(monday); d.setDate(monday.getDate() - (25 - i) * 7);
    return { week: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`, clips: i >= 20 && i < 25 ? 2 : 0 }; });
  await signedInCreator(page, { my_streak: { current: 5, best: 9, this_week: false }, my_streak_weeks: weeks });
  await page.goto('/streak');
  await expect(page.getByText('WEEKS STREAK')).toBeVisible();
  await expect(page.getByRole('heading', { name: '5' })).toBeVisible();
  await expect(page.getByText('9 weeks')).toBeVisible();
  await expect(page.getByText('3 weeks lagi')).toBeVisible();   // 5 → Rajin at 8
  await expect(page.getByText('26 minggu terakhir')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Simpan / bagikan ke Story' })).toBeEnabled({ timeout: 10000 });
});

test('brand sees a views forecast and can turn off the weekly email', async ({ page }) => {
  await signedInCreator(page, {
    profiles: { id: UID, full_name: 'Dina', role: 'brand' },
    my_brands: [{ id: 'b1', name: 'Kopi Nusa', logo_url: null, role: 'owner', daily_report: true, weekly_report: true }],
    brand_campaigns: [{ id: CID, brand_id: 'b1', brand_name: 'Kopi Nusa', title: 'Kopi Susu Launch', category: 'product', status: 'active', cpm: 1500,
      budget: 15000000, spent: 6000000, remaining: 9000000, starts_at: NOW, ends_at: null, submission_deadline: null, platforms: ['tiktok'],
      creators_joined: 12, submissions: 3, approved: 2, qualified_views: 4000000, raw_views: 5000000, pending_views: 0, excluded_views: 0,
      fee_pct: 15, platform_fee: 900000, total_cost: 6900000, effective_cpm: 1200, last_metrics_at: NOW, last_qualified_at: NOW }],
    brand_campaign_forecast: { qualified_views: 4000000, daily_views: 200000, daily_spend: 300000, projected_views: 10000000, horizon_days: 30,
      ends_at: null, budget_runout_at: new Date(Date.now() + 30 * 86400e3).toISOString(), remaining: 9000000, enough_data: true },
  });
  let weekly: unknown = null;
  await page.route('**/rest/v1/rpc/set_brand_weekly_report', async (r) => { weekly = r.request().postDataJSON(); return r.fulfill({ json: null }); });
  await page.goto(`/brand-campaign/${CID}`);
  await expect(page.getByText('Prediksi views')).toBeVisible();
  await expect(page.getByText(/10\s?jt/).first()).toBeVisible();
  await expect(page.getByText(/budget habis/)).toBeVisible();
  await page.goto('/brand/account');
  await page.getByLabel('Laporan mingguan Kopi Nusa').click();
  await expect.poll(() => weekly).toEqual({ p_brand_id: 'b1', p_on: false });
});
