import { readFileSync } from 'fs';
import { expect, test } from '@playwright/test';
import { signedInCreator, UID } from './mock';

// Brand portal against a mocked Supabase: summary, campaign tabs, submission filter, CSV/PDF export, account.
const CID = '30000000-0000-0000-0000-000000000001';
const NOW = new Date().toISOString();
const CAMPAIGN = {
  id: CID, brand_id: 'b1', brand_name: 'Kopi Nusa', title: 'Kopi Susu Launch', category: 'product', status: 'active', cpm: 1500,
  budget: 15000000, spent: 6000000, remaining: 9000000, starts_at: NOW, ends_at: null, submission_deadline: null, platforms: ['tiktok', 'instagram'],
  creators_joined: 12, submissions: 3, approved: 2, qualified_views: 4000000, raw_views: 5000000, pending_views: 300000, excluded_views: 700000,
  fee_pct: 15, platform_fee: 900000, total_cost: 6900000, effective_cpm: 1200, last_metrics_at: NOW, last_qualified_at: NOW,
};
const clip = (id: string, user: string, status: string, views: number) => ({ submission_id: id, creator_username: user, platform: 'tiktok',
  post_url: `https://www.tiktok.com/@${user}/video/1`, status, published_at: NOW, raw_views: views, qualified_views: status === 'approved' ? views : 0,
  spend: status === 'approved' ? views * 1.5 : 0, pending_views: 0, last_metrics_at: NOW });

async function brand(page: import('@playwright/test').Page) {
  await signedInCreator(page, {
    profiles: { id: UID, full_name: 'Dina', role: 'brand' },
    my_brands: [{ id: 'b1', name: 'Kopi Nusa', logo_url: null, role: 'owner', daily_report: true }],
    brand_campaigns: [CAMPAIGN],
    brand_daily: [{ day: NOW.slice(0, 10), qualified_gain: 120000, spend: 180000 }],
    brand_submissions: [clip('s1', 'rani', 'approved', 800000), clip('s2', 'bagas', 'pending_review', 20000), clip('s3', 'lina', 'rejected', 3000)],
    brand_top_clips: [clip('s1', 'rani', 'approved', 800000)],
    campaign_platform_breakdown: [{ platform: 'tiktok', submissions: 3, approved: 2, qualified_views: 4000000, earned: 6000000 }],
    campaign_hashtag_stats: [{ campaign_id: CID, hashtag: 'kopinusa', platform: 'tiktok', video_count: 90, view_count: 2500000, captured_at: NOW }],
  });
}

test('brand summary shows budget, KPIs and hashtag reach (Supabase mocked)', async ({ page }) => {
  await brand(page);
  await page.goto('/brand');
  await expect(page.getByText('Sisa budget')).toBeVisible();
  await expect(page.getByText('Rp9.000.000').first()).toBeVisible();
  await expect(page.getByText('Views terverifikasi')).toBeVisible();
  await expect(page.getByText(/2,5\s?jt views/)).toBeVisible();
  await expect(page.getByRole('link', { name: /Top up$/ })).toBeVisible();
  await expect(page.getByText('Kopi Susu Launch').first()).toBeVisible();
});

test('campaign tabs: submission filter, CSV and PDF export (Supabase mocked)', async ({ page }) => {
  await brand(page);
  await page.goto(`/brand-campaign/${CID}`);
  await expect(page.getByRole('heading', { name: 'Kopi Susu Launch' })).toBeVisible();
  await page.getByText('Submission', { exact: true }).first().click();
  await expect(page.getByText('3 video')).toBeVisible();
  await expect(page.getByText('@lina')).toBeVisible();
  await page.getByText('Ditolak', { exact: true }).first().click();
  await expect(page.getByText('@rani')).toHaveCount(0);
  await expect(page.getByText('@lina')).toBeVisible();

  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'CSV' }).click();
  const csv = readFileSync(await (await download).path(), 'utf8');
  expect(csv).toContain('@rani');
  expect(csv.split('\n')).toHaveLength(4);

  const popup = page.waitForEvent('popup');
  await page.getByRole('button', { name: 'PDF' }).click();
  const pdf = await popup;
  await expect(pdf.getByRole('heading', { name: 'Kopi Susu Launch' })).toBeVisible();
  await expect(pdf.getByText('Semua video (3)')).toBeVisible();

  await page.getByText('Analitik', { exact: true }).first().click();
  await expect(page.getByText('Validasi views')).toBeVisible();
  await page.getByText('Klip', { exact: true }).first().click();
  await expect(page.getByText('Pakai untuk iklan')).toBeVisible();
});

test('brand account: daily report toggle and account manager links (Supabase mocked)', async ({ page }) => {
  await brand(page);
  let toggled: Record<string, unknown> | null = null;
  await page.route('**/rest/v1/rpc/set_brand_daily_report', async (r) => { toggled = r.request().postDataJSON(); await r.fulfill({ status: 204, body: '' }); });
  await page.goto('/brand/account');
  await expect(page.getByText('Kopi Nusa').first()).toBeVisible();
  await expect(page.getByText('Top up budget').first()).toBeVisible();
  await page.getByRole('switch', { name: 'Laporan harian Kopi Nusa' }).click();
  await expect.poll(() => toggled).toMatchObject({ p_brand_id: 'b1', p_on: false });
});
