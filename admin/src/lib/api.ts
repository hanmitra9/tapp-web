import { supabase } from './supabase';
import type { Metric } from './engine';

export type SubStatus = 'pending_review' | 'needs_changes' | 'approved' | 'rejected' | 'flagged' | 'tracking' | 'completed';
export type AdminSubmission = {
  id: string; campaign_id: string; creator_id: string; platform: string; post_url: string; published_at: string;
  caption: string | null; screenshot_path: string | null; status: SubStatus; review_reason: string | null; reviewed_at: string | null;
  content_state: string; qualified_views: number; earned: number; last_metrics_at: string | null; created_at: string;
  campaign_title: string; campaign_status: string; cpm: number; min_views_to_qualify: number; max_earning_per_submission: number | null;
  budget: number; campaign_earned: number; budget_override: boolean; submission_deadline: string | null; brand_name: string | null;
  creator_name: string | null; creator_username: string | null; creator_status: string; creator_tier: string;
  account_handle: string | null; account_followers: number | null; creator_approved: number; creator_rejected: number;
  latest_metric_id: string | null; views: number | null; likes: number | null; comments: number | null; shares: number | null; saves: number | null;
  metrics_captured_at: string | null; metric_count: number; auto_hold_reason: string | null; auto_hold_at: string | null;
};
const NUMERIC = ['qualified_views', 'earned', 'cpm', 'min_views_to_qualify', 'max_earning_per_submission', 'budget', 'campaign_earned',
  'account_followers', 'creator_approved', 'creator_rejected', 'views', 'likes', 'comments', 'shares', 'saves', 'metric_count'] as const;
const norm = (r: Record<string, unknown>) => {
  const o = { ...r };
  for (const k of NUMERIC) if (o[k] != null) o[k] = Number(o[k]);
  return o as unknown as AdminSubmission;
};

export type Queue = 'review' | 'flagged' | 'metrics' | 'tracking' | 'held' | 'closed';
const QUEUE_FILTER: Record<Queue, SubStatus[]> = {
  review: ['pending_review'], flagged: ['flagged'], metrics: ['approved'], tracking: ['tracking'], held: ['tracking'], closed: ['rejected', 'needs_changes', 'completed'],
};

export async function listSubmissions(queue: Queue, search: string): Promise<AdminSubmission[]> {
  let q = supabase.from('admin_submissions').select('*').in('status', QUEUE_FILTER[queue]).limit(200);
  // Review queues: oldest first (FIFO). Tracking: stalest metrics first.
  q = queue === 'tracking' ? q.order('last_metrics_at', { ascending: true, nullsFirst: true })
    : queue === 'closed' ? q.order('reviewed_at', { ascending: false }) : q.order('created_at', { ascending: true });
  if (queue === 'held') q = q.not('auto_hold_reason', 'is', null);
  const s = clean(search);
  if (s) q = q.or(`campaign_title.ilike.%${s}%,creator_username.ilike.%${s}%,post_url.ilike.%${s}%`);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).map(norm);
}
export async function getSubmission(id: string) {
  const { data, error } = await supabase.from('admin_submissions').select('*').eq('id', id).single();
  if (error) throw error;
  return norm(data);
}

export type Counts = { pending_review: number; flagged: number; awaiting_first_metrics: number; stale_metrics: number; creators_to_review: number; payouts_open: number; disputes_open: number; tickets_open: number; campaigns_pending: number; auto_held: number };
export async function fetchCounts(): Promise<Counts> {
  const { data, error } = await supabase.from('admin_queue_counts').select('*').single();
  if (error) throw error;
  return Object.fromEntries(Object.entries(data).map(([k, v]) => [k, Number(v)])) as Counts;
}

export type Snapshot = { id: string; raw_views: number; qualified_views: number; previous_qualified_views: number; budget_capped: boolean; note: string | null; created_at: string; computed_by: string | null };
export async function fetchHistory(submissionId: string): Promise<{ metrics: Metric[]; snapshots: Snapshot[] }> {
  const [m, s] = await Promise.all([
    supabase.from('content_metrics').select('id, captured_at, views, likes, comments, shares, saves, source')
      .eq('submission_id', submissionId).order('captured_at', { ascending: false }),
    supabase.from('performance_snapshots').select('id, raw_views, qualified_views, previous_qualified_views, budget_capped, note, created_at, computed_by')
      .eq('submission_id', submissionId).order('created_at', { ascending: false }),
  ]);
  if (m.error) throw m.error;
  if (s.error) throw s.error;
  const n = (x: unknown) => Number(x ?? 0);
  return {
    metrics: (m.data ?? []).map((r) => ({ ...r, views: n(r.views), likes: n(r.likes), comments: n(r.comments), shares: n(r.shares), saves: n(r.saves) })),
    snapshots: (s.data ?? []).map((r) => ({ ...r, raw_views: n(r.raw_views), qualified_views: n(r.qualified_views), previous_qualified_views: n(r.previous_qualified_views) })),
  };
}

export async function proofUrl(path: string) {
  const { data, error } = await supabase.storage.from('submission-proofs').createSignedUrl(path, 600);
  if (error) throw error;
  return data.signedUrl;
}

// Strip characters that carry meaning in PostgREST filter syntax.
const clean = (s: string) => s.trim().replace(/[,()%*\\:"']/g, ' ').slice(0, 60).trim();

async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw error;
  return data as T;
}
export const reviewSubmission = (id: string, decision: SubStatus, reason: string | null) =>
  rpc('admin_review_submission', { p_submission_id: id, p_decision: decision, p_reason: reason });
export const recordMetrics = (id: string, m: { views: number; likes: number; comments: number; shares: number; saves: number; capturedAt: string; state: string }) =>
  rpc<{ id: string }>('admin_record_metrics', {
    p_submission_id: id, p_views: m.views, p_likes: m.likes, p_comments: m.comments, p_shares: m.shares, p_saves: m.saves,
    p_captured_at: m.capturedAt, p_source: 'manual', p_content_state: m.state,
  });
export const qualifyViews = (id: string, metricId: string, qualified: number, note: string | null, allowDecrease: boolean) =>
  rpc('admin_qualify_views', { p_submission_id: id, p_metric_id: metricId, p_qualified_views: qualified, p_note: note, p_allow_decrease: allowDecrease });

// ── Creators ──
export type CreatorStatus = 'pending' | 'verified' | 'active' | 'suspended' | 'banned';
export type AdminCreator = {
  user_id: string; status: CreatorStatus; status_reason: string | null; tier: string; reliability_score: number; main_platform: string | null; niches: string[];
  content_categories: string[]; content_style: string | null; experience_level: string | null; audience: Record<string, string[]>;
  onboarding_completed_at: string | null; created_at: string;
  profile: { full_name: string | null; username: string | null; country: string | null; avatar_url: string | null } | null;
  platforms: { id: string; platform: string; handle: string; profile_url: string | null; followers: number | null; verified_at: string | null }[];
  payout: { kind: string; provider: string; account_name: string }[];
};
export async function listCreators(status: CreatorStatus, search: string): Promise<AdminCreator[]> {
  let q = supabase.from('creator_profiles')
    .select('user_id, status, status_reason, tier, reliability_score, main_platform, niches, content_categories, content_style, experience_level, audience, onboarding_completed_at, created_at, profile:profiles!inner(full_name, username, country, avatar_url), platforms:creator_platforms(id, platform, handle, profile_url, followers, verified_at), payout:creator_payout_methods(kind, provider, account_name)')
    .eq('status', status).order(status === 'verified' ? 'onboarding_completed_at' : 'created_at', { ascending: status === 'verified' }).limit(200);
  const s = clean(search);
  if (s) q = q.or(`username.ilike.%${s}%,full_name.ilike.%${s}%`, { referencedTable: 'profiles' });
  const { data, error } = await q;
  if (error) throw error;
  return data as unknown as AdminCreator[];
}
export const setCreatorStatus = (id: string, status: CreatorStatus, reason: string | null) =>
  rpc('admin_set_creator_status', { p_user_id: id, p_status: status, p_reason: reason });
export const verifyPlatform = (id: string, verified: boolean) => rpc('admin_verify_platform', { p_platform_id: id, p_verified: verified });

// ── Payouts ──
export type PayoutStatus = 'requested' | 'reviewing' | 'approved' | 'processing' | 'paid' | 'rejected';
export type AdminPayout = {
  id: string; creator_id: string; amount: number; status: PayoutStatus;
  payout_method: { kind: string; provider: string; account_name: string; account_number: string };
  review_reason: string | null; reviewed_at: string | null; processed_reference: string | null; paid_at: string | null;
  created_at: string; updated_at: string; creator_name: string | null; creator_username: string | null; creator_status: string;
  earning_rows: number; creator_flagged: number; creator_open_disputes: number; creator_paid_total: number; ledger_matches: boolean;
  method_changed_recently: boolean;
};
export async function listPayouts(statuses: PayoutStatus[]): Promise<AdminPayout[]> {
  const { data, error } = await supabase.from('admin_payouts').select('*').in('status', statuses)
    .order('created_at', { ascending: !statuses.includes('paid') }).limit(200);
  if (error) throw error;
  return (data ?? []).map((r) => ({ ...r, amount: Number(r.amount), earning_rows: Number(r.earning_rows), creator_flagged: Number(r.creator_flagged),
    creator_open_disputes: Number(r.creator_open_disputes), creator_paid_total: Number(r.creator_paid_total) })) as AdminPayout[];
}
export type PayoutEarning = { id: string; amount: number; qualified_views_delta: number; created_at: string; campaign: { title: string } | null; submission_id: string };
export async function payoutEarnings(payoutId: string): Promise<PayoutEarning[]> {
  const { data, error } = await supabase.from('earnings').select('id, amount, qualified_views_delta, created_at, submission_id, campaign:campaigns(title)')
    .eq('payout_request_id', payoutId).order('created_at');
  if (error) throw error;
  return (data as unknown as PayoutEarning[]).map((e) => ({ ...e, amount: Number(e.amount), qualified_views_delta: Number(e.qualified_views_delta) }));
}
export const updatePayout = (id: string, status: PayoutStatus, reason: string | null, reference: string | null) =>
  rpc('admin_update_payout', { p_payout_id: id, p_status: status, p_reason: reason, p_reference: reference });

// ── Brands ──
export type Brand = { id: string; name: string; slug: string; logo_url: string | null; website: string | null; status: 'pending' | 'active' | 'suspended'; created_at: string };
export async function listBrands(): Promise<Brand[]> {
  const { data, error } = await supabase.from('brands').select('*').order('name');
  if (error) throw error;
  return data as Brand[];
}
export async function saveBrand(b: Partial<Brand> & { name: string; slug: string }) {
  const row = { name: b.name.trim(), slug: b.slug.trim().toLowerCase(), website: b.website?.trim() || null, logo_url: b.logo_url?.trim() || null, status: b.status ?? 'active' };
  const q = b.id ? supabase.from('brands').update(row).eq('id', b.id) : supabase.from('brands').insert(row);
  const { error } = await q;
  if (error) throw error;
}

// ── Campaigns ──
export type CampaignStatus = 'draft' | 'pending_approval' | 'active' | 'paused' | 'ending' | 'completed' | 'archived' | 'cancelled';
export type AdminCampaign = {
  id: string; brand_id: string; brand_name: string | null; title: string; category: string; content_type: string; status: CampaignStatus;
  status_reason: string | null; cpm: number; budget: number; earned: number; paid: number; budget_override: boolean; remaining: number;
  min_views_to_qualify: number; max_earning_per_submission: number | null; starts_at: string | null; ends_at: string | null;
  submission_deadline: string | null; created_at: string; approved_at: string | null; platforms: string[];
  creators_joined: number; submissions: number; approved: number; pending_review: number; qualified_views: number; assets: number;
};
const CNUM = ['cpm', 'budget', 'earned', 'paid', 'remaining', 'min_views_to_qualify', 'max_earning_per_submission', 'creators_joined', 'submissions', 'approved', 'pending_review', 'qualified_views', 'assets'];
export async function listCampaigns(statuses: CampaignStatus[]): Promise<AdminCampaign[]> {
  const { data, error } = await supabase.from('admin_campaigns').select('*').in('status', statuses).order('created_at', { ascending: false }).limit(200);
  if (error) throw error;
  return (data ?? []).map((r) => { const o = { ...r } as Record<string, unknown>; for (const k of CNUM) if (o[k] != null) o[k] = Number(o[k]); return o as AdminCampaign; });
}
export type CampaignFull = {
  id: string; brand_id: string; title: string; objective: string | null; description: string | null; category: string; content_type: string;
  status: CampaignStatus; cpm: number; budget: number; max_earning_per_submission: number | null; min_views_to_qualify: number;
  starts_at: string | null; ends_at: string | null; submission_deadline: string | null; guidelines_do: string[]; guidelines_dont: string[]; terms: string | null;
  platforms: { platform: string }[]; rules: { kind: string; body: string; sort: number }[];
  assets: { id: string; kind: string; title: string; url: string | null; storage_path: string | null; sort: number }[];
};
export async function getCampaignFull(id: string): Promise<CampaignFull> {
  const { data, error } = await supabase.from('campaigns')
    .select('id, brand_id, title, objective, description, category, content_type, status, cpm, budget, max_earning_per_submission, min_views_to_qualify, starts_at, ends_at, submission_deadline, guidelines_do, guidelines_dont, terms, platforms:campaign_platforms(platform), rules:campaign_rules(kind, body, sort), assets:campaign_assets(id, kind, title, url, storage_path, sort)')
    .eq('id', id).single();
  if (error) throw error;
  const c = data as unknown as CampaignFull;
  return { ...c, cpm: Number(c.cpm), budget: Number(c.budget), rules: [...c.rules].sort((a, b) => a.sort - b.sort), assets: [...c.assets].sort((a, b) => a.sort - b.sort) };
}
export const upsertCampaignDraft = (id: string | null, p: Record<string, unknown>) => rpc<{ id: string }>('upsert_campaign_draft', { p_id: id, p });
export const updateCampaignCopy = (id: string, p: Record<string, unknown>) => rpc('admin_update_campaign_copy', { p_id: id, p });
export const submitForApproval = (id: string) => rpc('submit_campaign_for_approval', { p_campaign_id: id });
export const setCampaignStatus = (id: string, status: CampaignStatus, reason: string | null) => rpc('admin_set_campaign_status', { p_campaign_id: id, p_status: status, p_reason: reason });
export const adjustBudget = (id: string, budget: number, override: boolean, reason: string) =>
  rpc('admin_adjust_campaign_budget', { p_campaign_id: id, p_budget: budget, p_override: override, p_reason: reason });
export async function platformBreakdown(id: string) {
  const { data, error } = await supabase.rpc('campaign_platform_breakdown', { p_campaign_id: id });
  if (error) throw error;
  return (data as { platform: string; submissions: number; approved: number; qualified_views: number; earned: number }[])
    .map((r) => ({ ...r, submissions: Number(r.submissions), approved: Number(r.approved), qualified_views: Number(r.qualified_views), earned: Number(r.earned) }));
}
export async function addAssetLink(campaignId: string, kind: string, title: string, url: string, sort: number) {
  const { error } = await supabase.from('campaign_assets').insert({ campaign_id: campaignId, kind, title: title.trim(), url: url.trim(), sort });
  if (error) throw error;
}
export async function uploadAsset(campaignId: string, file: File, title: string, sort: number) {
  const kind = file.type.startsWith('video') ? 'video' : file.type.startsWith('audio') ? 'audio' : file.type.startsWith('image') ? 'image' : 'document';
  const path = `${campaignId}/${Date.now()}-${file.name.replace(/[^\w.-]+/g, '_')}`;
  const up = await supabase.storage.from('campaign-assets').upload(path, file, { contentType: file.type || undefined });
  if (up.error) throw up.error;
  const { error } = await supabase.from('campaign_assets').insert({ campaign_id: campaignId, kind, title: title.trim() || file.name, storage_path: path, sort });
  if (error) throw error;
}
export async function deleteAsset(id: string) {
  const { error } = await supabase.from('campaign_assets').delete().eq('id', id);
  if (error) throw error;
}

// ── Disputes ──
export type DisputeStatus = 'open' | 'under_review' | 'resolved' | 'rejected';
export type AdminDispute = {
  id: string; raised_by: string; submission_id: string | null; payout_request_id: string | null; reason: string; status: DisputeStatus;
  resolution: string | null; resolved_at: string | null; created_at: string; raiser_name: string | null; raiser_username: string | null;
  post_url: string | null; submission_status: string | null; submission_reason: string | null; submission_campaign: string | null;
  payout_amount: number | null; payout_status: string | null; payout_reason: string | null;
};
export async function listDisputes(statuses: DisputeStatus[]): Promise<AdminDispute[]> {
  const { data, error } = await supabase.from('admin_disputes').select('*').in('status', statuses).order('created_at', { ascending: true }).limit(200);
  if (error) throw error;
  return (data ?? []).map((d) => ({ ...d, payout_amount: d.payout_amount == null ? null : Number(d.payout_amount) })) as AdminDispute[];
}
export const resolveDispute = (id: string, status: DisputeStatus, resolution: string | null) =>
  rpc('admin_resolve_dispute', { p_id: id, p_status: status, p_resolution: resolution });

// ── Support ──
export type TicketStatus = 'open' | 'pending' | 'resolved' | 'closed';
export type AdminTicket = {
  id: string; user_id: string; category: string; subject: string; body: string; related_id: string | null; status: TicketStatus;
  admin_reply: string | null; replied_at: string | null; created_at: string; user_name: string | null; user_username: string | null;
};
export async function listTickets(statuses: TicketStatus[]): Promise<AdminTicket[]> {
  const { data, error } = await supabase.from('admin_tickets').select('*').in('status', statuses).order('created_at', { ascending: true }).limit(200);
  if (error) throw error;
  return data as AdminTicket[];
}
export const replyTicket = (id: string, reply: string, status: TicketStatus) => rpc('admin_reply_ticket', { p_id: id, p_reply: reply, p_status: status });

// ── Audit ──
export type AuditRow = { id: number; actor_id: string | null; actor_username: string | null; actor_name: string | null; actor_role: string | null;
  action: string; entity_type: string; entity_id: string | null; before: unknown; after: unknown; metadata: unknown; created_at: string };
export async function listAudit(f: { entity: string; action: string; before?: number }): Promise<AuditRow[]> {
  let q = supabase.from('admin_audit_logs').select('*').order('id', { ascending: false }).limit(50);
  if (f.entity) q = q.eq('entity_type', f.entity);
  const a = clean(f.action);
  if (a) q = q.ilike('action', `${a}%`);
  if (f.before) q = q.lt('id', f.before);
  const { data, error } = await q;
  if (error) throw error;
  return data as AuditRow[];
}

// ── Growth ──
export type Funnel = { signed_up: number; onboarded: number; approved: number; joined_campaign: number; submitted: number;
  approved_submission: number; earned: number; paid_out: number };
export async function fetchFunnel(): Promise<Funnel> {
  const { data, error } = await supabase.from('admin_creator_funnel').select('*').single();
  if (error) throw error;
  return Object.fromEntries(Object.entries(data).map(([k, v]) => [k, Number(v)])) as Funnel;
}
export type WeeklyRow = { week: string; event: string; events: number; users: number };
export async function fetchWeekly(): Promise<WeeklyRow[]> {
  const { data, error } = await supabase.from('admin_weekly_activity').select('*').order('week', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r) => ({ ...r, events: Number(r.events), users: Number(r.users) })) as WeeklyRow[];
}

// ── Brand people (invites) ──
export type BrandPerson = { kind: 'member' | 'invite'; user_id: string | null; email: string; role: string; created_at: string; invite_id: string | null; expires_at: string | null };
export async function listBrandPeople(brandId: string): Promise<BrandPerson[]> {
  const { data, error } = await supabase.rpc('admin_brand_people', { p_brand_id: brandId });
  if (error) throw error;
  return data as BrandPerson[];
}
export const inviteBrandMember = (brandId: string, email: string, role: string) =>
  rpc('admin_invite_brand_member', { p_brand_id: brandId, p_email: email, p_role: role });
export const revokeBrandInvite = (id: string) => rpc('admin_revoke_brand_invite', { p_invite_id: id });
export const removeBrandMember = (brandId: string, userId: string) => rpc('admin_remove_brand_member', { p_brand_id: brandId, p_user_id: userId });

// ── Meetings (brand booking from the website /meeting) ──
export type MeetingStatus = 'new' | 'scheduled' | 'done' | 'cancelled';
export type Meeting = { id: string; name: string; company: string; email: string; whatsapp: string | null; goal: string | null;
  budget_range: string | null; slot: string; status: MeetingStatus; meet_link: string | null; admin_note: string | null; handled_at: string | null; created_at: string };
export async function listMeetings(statuses: MeetingStatus[]): Promise<Meeting[]> {
  const { data, error } = await supabase.from('meeting_requests').select('*').in('status', statuses).order('slot', { ascending: true }).limit(200);
  if (error) throw error;
  return data as Meeting[];
}
export async function countNewMeetings(): Promise<number> {
  const { count, error } = await supabase.from('meeting_requests').select('id', { count: 'exact', head: true }).eq('status', 'new');
  if (error) return 0;   // table not migrated yet: keep the nav quiet
  return count ?? 0;
}
export const updateMeeting = (id: string, status: MeetingStatus, meetLink: string | null, note: string | null) =>
  rpc('admin_update_meeting', { p_id: id, p_status: status, p_meet_link: meetLink, p_note: note });

// ── Automatic view filtering (migration 030) ──
export type AutoQualify = { enabled: boolean; held: number; auto_24h: number; manual_24h: number };
export async function fetchAutoQualify(): Promise<AutoQualify> {
  const d = await rpc<Record<string, unknown>>('admin_auto_qualify_status', {});
  return { enabled: !!d.enabled, held: Number(d.held ?? 0), auto_24h: Number(d.auto_24h ?? 0), manual_24h: Number(d.manual_24h ?? 0) };
}
export const setAutoQualify = (enabled: boolean) => rpc('admin_set_auto_qualify', { p_enabled: enabled });
