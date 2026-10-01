import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { track } from '@/lib/analytics';

// Where a notification should take the creator. Data comes from the server-written notification row.
export async function openNotification(data: Record<string, unknown> | undefined) {
  const d = data ?? {};
  track('notification_opened', { type: typeof d.type === 'string' ? d.type : null });
  if (typeof d.ticket_id === 'string' || typeof d.dispute_id === 'string') return router.push('/help');
  if (typeof d.payout_id === 'string') return router.push('/payouts');
  if (typeof d.campaign_id === 'string') return router.push({ pathname: '/campaign/[id]', params: { id: d.campaign_id } });
  if (typeof d.submission_id === 'string') {
    const { data: s } = await supabase.from('my_submissions').select('campaign_id').eq('id', d.submission_id).maybeSingle();
    if (s?.campaign_id) return router.push({ pathname: '/workspace/[id]', params: { id: s.campaign_id as string } });
  }
  if (d.type === 'account_status') return router.navigate('/');
  router.push('/notifications');
}
