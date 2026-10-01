import { useEffect, useState } from 'react';
import { validateUsername } from '@/lib/validation';
import { isUsernameAvailable } from '../api';

export type UsernameStatus = 'idle' | 'invalid' | 'checking' | 'available' | 'taken' | 'unknown';

// Debounced server check. `current` is the user's existing username (always considered available).
export function useUsernameCheck(username: string, current: string | null): UsernameStatus {
  const [status, setStatus] = useState<UsernameStatus>('idle');
  useEffect(() => {
    const u = username.trim().toLowerCase();
    if (!u) return setStatus('idle');
    if (validateUsername(u)) return setStatus('invalid');
    if (current && u === current) return setStatus('available');
    setStatus('checking');
    let live = true;
    const t = setTimeout(async () => {
      try { const ok = await isUsernameAvailable(u); if (live) setStatus(ok ? 'available' : 'taken'); }
      catch { if (live) setStatus('unknown'); }            // offline: final check happens on save
    }, 400);
    return () => { live = false; clearTimeout(t); };
  }, [username, current]);
  return status;
}
