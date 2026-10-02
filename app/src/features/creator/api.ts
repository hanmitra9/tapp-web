import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { supabase } from '@/lib/supabase';
import type { Experience, Platform } from './options';

export type LinkedPlatform = { id: string; platform: Platform; handle: string; profile_url: string | null; followers: number | null; verified_at: string | null;
  bio_code?: string | null; bio_status?: BioStatus | null; bio_note?: string | null };
export type BioStatus = 'code_issued' | 'not_found' | 'review' | 'verified' | 'rejected';
export type PayoutMethod = { id: string; kind: 'bank' | 'ewallet'; provider: string; account_name: string; account_number: string };
export type Audience = { countries: string[]; age_ranges: string[]; languages: string[] };
export type CreatorProfile = {
  userId: string; fullName: string | null; username: string | null; avatarUrl: string | null; country: string | null;
  status: 'pending' | 'verified' | 'active' | 'suspended' | 'banned'; tier: 'new' | 'rising' | 'verified' | 'proven' | 'elite';
  mainPlatform: Platform | null; niches: string[]; categories: string[]; contentStyle: string | null;
  audience: Audience; experience: Experience | null; reliability: number;
};
export type CreatorStats = { campaigns_joined: number; submissions: number; approved: number; rejected: number; qualified_views: number; total_earned: number };

const toAudience = (a: Partial<Audience> | null | undefined): Audience => ({
  countries: a?.countries ?? [], age_ranges: a?.age_ranges ?? [], languages: a?.languages ?? [],
});

export async function fetchCreatorProfile(uid: string): Promise<CreatorProfile> {
  const [p, c] = await Promise.all([
    supabase.from('profiles').select('full_name, username, avatar_url, country').eq('id', uid).single(),
    supabase.from('creator_profiles')
      .select('status, tier, main_platform, niches, content_categories, content_style, audience, experience_level, reliability_score')
      .eq('user_id', uid).single(),
  ]);
  if (p.error) throw p.error;
  if (c.error) throw c.error;
  return {
    userId: uid, fullName: p.data.full_name, username: p.data.username, avatarUrl: p.data.avatar_url, country: p.data.country,
    status: c.data.status, tier: c.data.tier, mainPlatform: c.data.main_platform, niches: c.data.niches ?? [],
    categories: c.data.content_categories ?? [], contentStyle: c.data.content_style, audience: toAudience(c.data.audience),
    experience: c.data.experience_level, reliability: Number(c.data.reliability_score ?? 0),
  };
}

export async function fetchStats(uid: string): Promise<CreatorStats> {
  const { data, error } = await supabase.from('my_creator_stats').select('*').eq('creator_id', uid).single();
  if (error) throw error;
  return {
    campaigns_joined: Number(data.campaigns_joined), submissions: Number(data.submissions), approved: Number(data.approved),
    rejected: Number(data.rejected), qualified_views: Number(data.qualified_views), total_earned: Number(data.total_earned),
  };
}

// ── Social accounts ──
export async function fetchPlatforms(uid: string): Promise<LinkedPlatform[]> {
  const { data, error } = await supabase.from('creator_platforms')
    .select('id, platform, handle, profile_url, followers, verified_at, bio_code, bio_status, bio_note').eq('creator_id', uid).order('created_at');
  if (error) throw error;
  return data as LinkedPlatform[];
}
export async function addPlatform(uid: string, p: { platform: Platform; handle: string; profile_url: string | null; followers: number | null }) {
  const { data, error } = await supabase.from('creator_platforms').insert({ creator_id: uid, ...p })
    .select('id, platform, handle, profile_url, followers, verified_at').single();
  if (error) throw error;
  return data as LinkedPlatform;
}
export async function removePlatform(id: string) {
  const { data, error } = await supabase.from('creator_platforms').delete().eq('id', id).select('id');
  if (error) throw error;
  if (!data?.length) throw { code: 'platform_in_use' };   // RLS keeps accounts that have live submissions
}

// "Hubungkan dengan TikTok / Instagram": each is on only once its developer app is approved
// (app_settings.platform_oauth_config.<platform>.enabled).
export type ConnectPlatform = 'tiktok' | 'instagram';
export const CONNECT_PLATFORMS: ConnectPlatform[] = ['tiktok', 'instagram'];
export async function connectEnabled(): Promise<Record<ConnectPlatform, boolean>> {
  const { data } = await supabase.from('app_settings').select('value').eq('key', 'platform_oauth_config').maybeSingle();
  const v = (data?.value ?? {}) as Partial<Record<ConnectPlatform, { enabled?: boolean }>>;
  return { tiktok: v.tiktok?.enabled === true, instagram: v.instagram?.enabled === true };
}

// Login URL from the <platform>-oauth function (it stores a one-time state bound to this user).
export async function startConnect(platform: ConnectPlatform): Promise<string> {
  const { data, error } = await supabase.functions.invoke<{ url?: string }>(`${platform}-oauth`, { method: 'POST' });
  if (error || !data?.url) throw new Error('Halaman login belum bisa dibuka. Coba lagi sebentar lagi.');
  return data.url;
}

// Bio code verification (migration 0039): code in the TikTok / Instagram bio proves the account is yours.
export async function issueBioCode(platformId: string): Promise<{ code: string; status: BioStatus }> {
  const { data, error } = await supabase.rpc('bio_code_issue', { p_platform_id: platformId });
  if (error) throw error;
  return data as { code: string; status: BioStatus };
}
export async function checkBio(platformId: string): Promise<BioStatus> {
  const { data, error } = await supabase.functions.invoke<{ status?: BioStatus; error?: string }>('bio-check', { body: { platform_id: platformId } });
  if (error) {
    const ctx = (error as { context?: Response }).context;
    const body = ctx ? await ctx.json().catch(() => null) : null;
    if (body?.error === 'too_fast') throw new Error('Tunggu beberapa detik sebelum cek lagi.');
    throw new Error('Bio belum bisa dicek. Coba lagi sebentar lagi.');
  }
  return data!.status!;
}
export async function requestBioReview(platformId: string) {
  const { error } = await supabase.rpc('bio_code_request_review', { p_platform_id: platformId });
  if (error) throw error;
}

export async function setMainPlatform(uid: string, platform: Platform | null) {
  const { data, error } = await supabase.from('creator_profiles').update({ main_platform: platform }).eq('user_id', uid).select('user_id');
  if (error) throw error;
  if (!data?.length) throw { code: 'profile_locked' };
}

// ── Payout method (one default per creator) ──
export async function fetchPayoutMethod(uid: string): Promise<PayoutMethod | null> {
  const { data, error } = await supabase.from('creator_payout_methods')
    .select('id, kind, provider, account_name, account_number').eq('creator_id', uid).eq('is_default', true).maybeSingle();
  if (error) throw error;
  return data as PayoutMethod | null;
}
export async function savePayoutMethod(uid: string, existingId: string | null, m: Omit<PayoutMethod, 'id'>) {
  const q = existingId
    ? supabase.from('creator_payout_methods').update(m).eq('id', existingId)
    : supabase.from('creator_payout_methods').insert({ creator_id: uid, is_default: true, ...m });
  const { data, error } = await q.select('id, kind, provider, account_name, account_number').single();
  if (error) throw error;
  return data as PayoutMethod;
}

// ── Profile ──
export async function isUsernameAvailable(username: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('is_username_available', { p_username: username });
  if (error) throw error;
  return data === true;
}

export async function uploadAvatar(uid: string, localUri: string): Promise<string> {
  const ctx = ImageManipulator.manipulate(localUri).resize({ width: 512 });
  const img = await (await ctx.renderAsync()).saveAsync({ compress: 0.8, format: SaveFormat.JPEG });
  const body = await (await fetch(img.uri)).arrayBuffer();
  const path = `${uid}/avatar-${Date.now()}.jpg`;          // new path per upload: no stale CDN cache
  const up = await supabase.storage.from('avatars').upload(path, body, { contentType: 'image/jpeg', upsert: false });
  if (up.error) throw up.error;
  const url = supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl;
  const { error } = await supabase.from('profiles').update({ avatar_url: url }).eq('id', uid);
  if (error) throw error;
  return url;
}

export type ProfileInput = {
  fullName: string; username: string; country: string; mainPlatform: Platform; niches: string[]; categories: string[];
  contentStyle: string; audience: Audience; experience: Experience;
};

export async function completeOnboarding(i: ProfileInput) {
  const { error } = await supabase.rpc('complete_creator_onboarding', {
    p_full_name: i.fullName.trim(), p_username: i.username.trim().toLowerCase(), p_country: i.country,
    p_main_platform: i.mainPlatform, p_niches: i.niches, p_content_categories: i.categories,
    p_content_style: i.contentStyle.trim() || null, p_audience: i.audience, p_experience_level: i.experience,
  });
  if (error) throw error;
}

export async function updateProfile(uid: string, i: ProfileInput) {
  const p = await supabase.from('profiles').update({
    full_name: i.fullName.trim(), username: i.username.trim().toLowerCase(), country: i.country,
  }).eq('id', uid);
  if (p.error) throw p.error;
  const c = await supabase.from('creator_profiles').update({
    main_platform: i.mainPlatform, niches: i.niches, content_categories: i.categories,
    content_style: i.contentStyle.trim() || null, audience: i.audience, experience_level: i.experience,
  }).eq('user_id', uid).select('user_id');
  if (c.error) throw c.error;
  if (!c.data?.length) throw { code: 'profile_locked' };    // suspended / banned: RLS blocks edits
}
