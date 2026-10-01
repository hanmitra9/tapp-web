import type { Platform } from '@/features/creator/options';

// Client mirror of public.normalize_post_url / platform_for_host (SQL is authoritative).
// Used only for instant feedback; the server re-validates everything.
export function detectPlatform(raw: string): { platform: Platform | null; error: string | null } {
  const s = raw.trim();
  const m = s.match(/^https?:\/\/([^/?#\s]+)([^?#\s]*)(\?[^#\s]*)?/i);
  if (!m) return { platform: null, error: 'Masukkan link lengkap, diawali https://' };
  const host = m[1]!.toLowerCase().replace(/^(www\.|m\.|mobile\.)/, '').replace(/:\d+$/, '');
  const path = m[2] ?? '';
  const query = m[3] ?? '';
  if (/^(vm|vt)\.tiktok\.com$/.test(host)) return { platform: 'tiktok', error: 'Link pendek tidak bisa diverifikasi. Buka postingan lalu salin link lengkapnya.' };
  if (host === 'tiktok.com') return /^\/@[^/]+\/video\/\d+/.test(path) ? ok('tiktok') : bad('Gunakan link video TikTok, contoh tiktok.com/@nama/video/123…');
  if (host === 'instagram.com' || host === 'instagr.am') return /^\/(p|reels?|tv)\/[^/]+/.test(path) ? ok('instagram') : bad('Gunakan link postingan atau Reel Instagram.');
  if (host === 'youtube.com' || host === 'youtu.be' || host === 'music.youtube.com') {
    const id = /[?&]v=[A-Za-z0-9_-]{6,}/.test(query) || /^\/(shorts|embed|live)\/[A-Za-z0-9_-]{6,}/.test(path) || (host === 'youtu.be' && /^\/[A-Za-z0-9_-]{6,}/.test(path));
    return id ? ok('youtube') : bad('Gunakan link video atau Shorts YouTube.');
  }
  if (host === 'x.com' || host === 'twitter.com') return /^\/[^/]+\/status\/\d+/.test(path) ? ok('x') : bad('Gunakan link postingan X.');
  if (host === 'facebook.com' || host === 'fb.watch') return ok('facebook');
  return { platform: null, error: null };   // unknown host: only valid for "other"
}
const ok = (platform: Platform) => ({ platform, error: null });
const bad = (error: string) => ({ platform: null, error });

// Publish date is captured at day granularity (the reviewer verifies the exact time on the platform).
// Today → now; earlier days → 23:59 local, so a post made on the join day always passes the "after joining" rule.
export function publishDays(joinedAt: string, max = 7): { key: string; label: string; iso: () => string }[] {
  const start = new Date(joinedAt); start.setHours(0, 0, 0, 0);
  const out = [];
  for (let i = 0; i < max; i++) {
    const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - i);
    if (d < start) break;
    const label = i === 0 ? 'Hari ini' : i === 1 ? 'Kemarin' : d.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' });
    const key = d.toISOString().slice(0, 10);
    out.push({ key, label, iso: () => (i === 0 ? new Date() : new Date(d.getTime() + 86_399_000)).toISOString() });
  }
  return out;
}
