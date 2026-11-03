import { expect, test } from '@playwright/test';
import { signedInCreator } from './mock';

// Weekly challenge (prizes instead of a per-view rate) and the monthly recap page (Supabase mocked).
const CID = '20000000-0000-0000-0000-0000000000c9';
const NOW = new Date().toISOString();
const ENDS = new Date(Date.now() + 5 * 86400e3).toISOString();
const PRIZES = [300000, 200000, 120000, 54285, 54285, 54285, 54285, 54285, 54285, 54290];
const CHALLENGE = {
  id: CID, title: 'Challenge Mingguan #1', objective: null, description: 'Clip terbaik minggu ini.', category: 'other', content_type: 'challenge', status: 'active',
  cpm: 1, budget: 100, remaining: 100, min_views_to_qualify: 0, max_earning_per_submission: null, starts_at: NOW, ends_at: ENDS, submission_deadline: ENDS,
  guidelines_do: [], guidelines_dont: [], terms: null, brand: { name: 'TAPP', logo_url: null, website: null }, platforms: ['tiktok'], rules: [], creators_joined: 12,
  membership: { status: 'joined', joined_at: NOW }, join_block: null,
};

test('challenge shows the prize pool, prizes per place and standings', async ({ page }) => {
  await signedInCreator(page, {
    get_campaign: CHALLENGE,
    challenge_info: [{ id: CID, prize_pool: 1000000, prizes: PRIZES, ends_at: ENDS, settled_at: null }],
    campaign_leaderboard: [{ rank: 1, name: 'bi•••', views: 420000, is_me: false }, { rank: 2, name: 'Kamu', views: 310000, is_me: true }],
  });
  await page.goto(`/campaign/${CID}`);
  await expect(page.getByText('Total hadiah')).toBeVisible();
  await expect(page.getByText('Rp1.000.000').first()).toBeVisible();
  await expect(page.getByText('Juara 1', { exact: true })).toBeVisible();
  await expect(page.getByText('Rp300.000')).toBeVisible();
  await expect(page.getByText('Peringkat sementara')).toBeVisible();
  await expect(page.getByText('Kamu', { exact: true })).toBeVisible();
  await expect(page.getByText(/1K views/)).toHaveCount(0);
});

test('monthly recap shows the month in numbers', async ({ page }) => {
  await signedInCreator(page, {
    my_monthly_recap: { month: '2026-10-01', views: 1240000, clips: 14, campaigns: 3, best_views: 420000, tier: 'verified', name: 'rani', top_pct: 8, creators: 120 },
  });
  await page.goto('/recap');
  await expect(page.getByRole('heading', { name: /2026/ })).toBeVisible();
  await expect(page.getByText('Klip diterima')).toBeVisible();
  await expect(page.getByText('Top 8%')).toBeVisible();
  await expect(page.getByText('Verified')).toBeVisible();
});
