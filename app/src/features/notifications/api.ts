import { supabase } from '@/lib/supabase';

export type AppNotification = { id: string; type: string; title: string; body: string; data: Record<string, string>; read_at: string | null; created_at: string };

export async function fetchNotifications(limit = 50): Promise<AppNotification[]> {
  const { data, error } = await supabase.from('notifications').select('id, type, title, body, data, read_at, created_at')
    .order('created_at', { ascending: false }).limit(limit);
  if (error) throw error;
  return data as AppNotification[];
}
export async function unreadCount(): Promise<number> {
  const { count, error } = await supabase.from('notifications').select('id', { count: 'exact', head: true }).is('read_at', null);
  if (error) throw error;
  return count ?? 0;
}
export async function markAllRead() {
  const { error } = await supabase.rpc('mark_notifications_read', { p_ids: null });
  if (error) throw error;
}
