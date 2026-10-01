import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { supabase } from '@/lib/supabase';
import type { Platform } from '@/features/creator/options';

export type SubmissionStatus = 'pending_review' | 'needs_changes' | 'approved' | 'rejected' | 'flagged' | 'tracking' | 'completed';
export type MySubmission = {
  id: string; campaign_id: string; campaign_title: string; brand_name: string | null; campaign_status: string;
  platform: Platform; post_url: string; published_at: string; caption: string | null; screenshot_path: string | null;
  status: SubmissionStatus; review_reason: string | null; reviewed_at: string | null;
  content_state: 'live' | 'deleted' | 'private' | 'unknown';
  qualified_views: number; earned: number; raw_views: number | null; last_metrics_at: string | null; created_at: string;
};

const n = (x: unknown) => (x == null ? null : Number(x));
const normalize = (r: MySubmission): MySubmission => ({
  ...r, qualified_views: Number(r.qualified_views ?? 0), earned: Number(r.earned ?? 0), raw_views: n(r.raw_views),
});

export async function fetchMySubmissions(campaignId?: string, limit = 50): Promise<MySubmission[]> {
  let q = supabase.from('my_submissions').select('*').order('created_at', { ascending: false }).limit(limit);
  if (campaignId) q = q.eq('campaign_id', campaignId);
  const { data, error } = await q;
  if (error) throw error;
  return (data as MySubmission[]).map(normalize);
}

export async function fetchSubmission(id: string): Promise<MySubmission | null> {
  const { data, error } = await supabase.from('my_submissions').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data ? normalize(data as MySubmission) : null;
}

export async function uploadProof(uid: string, localUri: string): Promise<string> {
  const ctx = ImageManipulator.manipulate(localUri).resize({ width: 1080 });
  const img = await (await ctx.renderAsync()).saveAsync({ compress: 0.75, format: SaveFormat.JPEG });
  const body = await (await fetch(img.uri)).arrayBuffer();
  const path = `${uid}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
  const { error } = await supabase.storage.from('submission-proofs').upload(path, body, { contentType: 'image/jpeg' });
  if (error) throw { code: 'upload_failed' };
  return path;
}

export type SubmitInput = { platform: Platform; postUrl: string; publishedAt: string; caption: string; screenshotPath: string | null };

export async function submitContent(campaignId: string, i: SubmitInput) {
  const { data, error } = await supabase.rpc('submit_content', {
    p_campaign_id: campaignId, p_platform: i.platform, p_post_url: i.postUrl.trim(), p_published_at: i.publishedAt,
    p_caption: i.caption.trim() || null, p_screenshot_path: i.screenshotPath,
  });
  if (error) throw error;
  return data as { id: string; status: SubmissionStatus };
}

export async function resubmitContent(submissionId: string, i: SubmitInput) {
  const { data, error } = await supabase.rpc('resubmit_content', {
    p_submission_id: submissionId, p_platform: i.platform, p_post_url: i.postUrl.trim(), p_published_at: i.publishedAt,
    p_caption: i.caption.trim() || null, p_screenshot_path: i.screenshotPath,
  });
  if (error) throw error;
  return data as { id: string; status: SubmissionStatus };
}

export async function withdrawSubmission(id: string) {
  const { error } = await supabase.rpc('withdraw_submission', { p_submission_id: id });
  if (error) throw error;
}
