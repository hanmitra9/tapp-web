import { expect, test } from '@playwright/test';
import { signedInCreator } from './mock';

// UGC campaign: brief and per-creator video cap on the detail page; the cap error when submitting (Supabase mocked).
const CID = '20000000-0000-0000-0000-0000000000a1';
const DAY = 86400e3;
const CAMPAIGN = {
  id: CID, title: 'Plester Harian', objective: null, description: 'Video UGC pemakaian plester.', category: 'beauty', content_type: 'ugc', status: 'active',
  cpm: 4000, budget: 100, remaining: 80, min_views_to_qualify: 1000, max_earning_per_submission: null, starts_at: new Date(Date.now() - 5 * DAY).toISOString(),
  ends_at: null, submission_deadline: null, guidelines_do: [], guidelines_dont: [], terms: null, max_submissions_per_creator: 2,
  ugc_brief: { narrative: 'Ceritakan kaki lecet saat jalan, lalu pakai produk.', cta: 'Beli di minimarket terdekat', face: 'either', duration_min: 30, duration_max: 60 },
  brand: { name: 'Plestro', logo_url: null, website: null }, platforms: ['tiktok'], rules: [], creators_joined: 4,
  membership: { status: 'joined', joined_at: new Date(Date.now() - 3 * DAY).toISOString() }, join_block: null,
};
const TIKTOK = { id: 'p1', platform: 'tiktok', handle: 'rani', profile_url: null, followers: 1200, verified_at: '2026-09-01T00:00:00Z', bio_code: null, bio_status: 'verified', bio_note: null };

test('UGC campaign shows its brief and the video cap', async ({ page }) => {
  await signedInCreator(page, { get_campaign: CAMPAIGN, creator_platforms: [TIKTOK] });
  await page.goto(`/campaign/${CID}`);
  await expect(page.getByText('Brief UGC')).toBeVisible();
  await expect(page.getByText('Ceritakan kaki lecet saat jalan, lalu pakai produk.')).toBeVisible();
  await expect(page.getByText(/Maks\. 2 video per kreator\./)).toBeVisible();
});

test('submitting past the video cap shows a clear message', async ({ page }) => {
  await signedInCreator(page, { get_campaign: CAMPAIGN, creator_platforms: [TIKTOK] });
  let sent: Record<string, unknown> | null = null;
  await page.route('**/rest/v1/rpc/submit_content', async (r) => {
    sent = r.request().postDataJSON();
    await r.fulfill({ status: 400, json: { code: 'P0001', message: 'submission_limit_reached', details: null, hint: null } });
  });
  await page.goto(`/submit/${CID}`);
  await page.getByPlaceholder('https://www.tiktok.com/@nama/video/…').fill('https://www.tiktok.com/@rani/video/7300000000000000001');
  await page.getByRole('checkbox', { name: 'Postingan milikku, publik, dan sesuai brief.' }).click();
  await page.getByRole('button', { name: 'Submit', exact: true }).click();
  await expect.poll(() => sent).toMatchObject({ p_campaign_id: CID, p_platform: 'tiktok' });
  await expect(page.getByText('Kamu sudah mencapai batas video untuk campaign ini.')).toBeVisible();
});
