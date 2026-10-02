import type { Page, Route } from '@playwright/test';

// Signed-in pages against a mocked Supabase: a fake (unsigned) session in localStorage plus canned REST
// answers. Enough to render a creator's pages; nothing here talks to the real project.
const REF = 'njffqsbddzztfxxbavpp';
export const UID = '00000000-0000-0000-0000-0000000000c1';

const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
export function fakeJwt(claims: Record<string, unknown> = {}) {
  const exp = Math.floor(Date.now() / 1000) + 3600;
  return `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: UID, role: 'authenticated', aal: 'aal1', exp, ...claims })}.sig`;
}

type Tables = Record<string, unknown>;
export async function signedInCreator(page: Page, tables: Tables = {}, claims: Record<string, unknown> = {}) {
  const token = fakeJwt(claims);
  const user = { id: UID, aud: 'authenticated', role: 'authenticated', email: 'kreator@example.com', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' };
  await page.addInitScript(([key, value]) => localStorage.setItem(key, value), [
    `sb-${REF}-auth-token`,
    JSON.stringify({ access_token: token, refresh_token: 'r', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, user }),
  ]);
  const data: Tables = {
    profiles: { id: UID, full_name: 'Rani Putri', username: 'rani', role: 'creator', avatar_url: null, country: 'ID' },
    creator_profiles: { status: 'active', status_reason: null, onboarding_completed_at: '2026-01-01T00:00:00Z', tier: 'new', main_platform: 'tiktok',
      niches: [], content_categories: [], content_style: null, audience: {}, experience_level: null, reliability_score: 90 },
    creator_platforms: [],
    app_settings: null,
    ...tables,
  };
  await page.route(`**/auth/v1/**`, (r) => r.fulfill({ json: user }));
  await page.route(`**/rest/v1/**`, (r: Route) => {
    const url = new URL(r.request().url());
    const name = url.pathname.split('/rest/v1/')[1]!.replace(/^rpc\//, '');
    const single = (r.request().headers()['accept'] ?? '').includes('vnd.pgrst.object');
    const v = name in data ? data[name] : [];
    if (single && Array.isArray(v)) return r.fulfill({ json: v[0] ?? null });
    return r.fulfill({ json: v });
  });
}
