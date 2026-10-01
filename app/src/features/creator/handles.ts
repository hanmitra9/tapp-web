import type { Platform } from './options';

const PROFILE_BASE: Partial<Record<Platform, (h: string) => string>> = {
  tiktok: (h) => `https://www.tiktok.com/@${h}`,
  instagram: (h) => `https://www.instagram.com/${h}`,
  youtube: (h) => `https://www.youtube.com/@${h}`,
  x: (h) => `https://x.com/${h}`,
  facebook: (h) => `https://www.facebook.com/${h}`,
};

// Accepts "@name", "name", or a pasted profile URL. Returns the bare handle or null.
export function parseHandle(input: string): string | null {
  let s = input.trim();
  const url = s.match(/^(?:https?:\/\/)?(?:www\.|m\.)?[a-z0-9.-]+\.[a-z]{2,}\/([^?#]+)/i);
  if (url?.[1]) {
    const parts = url[1].split('/').filter(Boolean);
    s = (['channel', 'c', 'user'].includes(parts[0] ?? '') ? parts[1] : parts[0]) ?? '';
  }
  s = s.replace(/^@/, '');
  return /^[A-Za-z0-9_.-]{1,64}$/.test(s) ? s : null;
}

export const profileUrl = (platform: Platform, handle: string) => PROFILE_BASE[platform]?.(handle) ?? null;

export function parseFollowers(input: string): number | null | 'invalid' {
  const s = input.trim().replace(/[.,\s]/g, '');
  if (!s) return null;
  return /^\d{1,10}$/.test(s) && Number(s) <= 2_000_000_000 ? Number(s) : 'invalid';
}

export const maskAccount = (n: string) => (n.length <= 4 ? n : `•••• ${n.slice(-4)}`);
