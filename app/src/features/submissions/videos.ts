import { supabase } from '@/lib/supabase';
import type { Platform } from '@/features/creator/options';

// Videos for the "Ambil Campaign" wizard (my-videos Edge Function): read from the public pages of the creator's account.
export type Video = {
  platform: Platform; url: string; thumb: string | null; caption: string | null; author: string | null;
  views: number | null; likes: number | null; comments: number | null; posted_at: string | null;
};
export type VideoList = { supported: boolean; videos: Video[]; unreadable?: boolean };

// Latest posts of one linked account. TikTok can't be listed without a platform login → supported=false (paste a link).
export async function fetchMyVideos(platformId: string): Promise<VideoList> {
  const { data, error } = await supabase.functions.invoke<VideoList>('my-videos', { body: { platform_id: platformId } });
  if (error || !data) return { supported: true, videos: [], unreadable: true };
  return data;
}

// Preview of one pasted link: thumbnail, author, views and posting time when the platform shows them.
export async function previewVideo(url: string): Promise<Video | null> {
  const { data, error } = await supabase.functions.invoke<{ video: Video | null }>('my-videos', { body: { url } });
  return error ? null : data?.video ?? null;
}
