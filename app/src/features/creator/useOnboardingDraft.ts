import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Audience } from './api';
import type { Experience, Platform } from './options';

export type Draft = {
  step: number;
  fullName: string; username: string; country: string;
  mainPlatform: Platform | null;
  niches: string[]; categories: string[]; experience: Experience | null; contentStyle: string;
  audience: Audience;
};

const key = (uid: string) => `tapp:onboarding:${uid}`;

export function initialDraft(fullName: string | null): Draft {
  return {
    step: 0, fullName: fullName ?? '', username: '', country: 'ID', mainPlatform: null,
    niches: [], categories: [], experience: null, contentStyle: '',
    audience: { countries: ['ID'], age_ranges: [], languages: ['id'] },
  };
}

// Local draft so an app kill / network drop never loses onboarding progress. Server-owned data
// (social accounts, payout method, avatar) is written immediately and not stored here.
export function useOnboardingDraft(uid: string, fullName: string | null) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let live = true;
    AsyncStorage.getItem(key(uid))
      .then((raw) => { if (live) setDraft(raw ? { ...initialDraft(fullName), ...JSON.parse(raw) } : initialDraft(fullName)); })
      .catch(() => { if (live) setDraft(initialDraft(fullName)); });
    return () => { live = false; };
  }, [uid, fullName]);

  const update = useCallback((patch: Partial<Draft>) => {
    setDraft((d) => {
      if (!d) return d;
      const next = { ...d, ...patch };
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => { AsyncStorage.setItem(key(uid), JSON.stringify(next)).catch(() => {}); }, 300);
      return next;
    });
  }, [uid]);

  const clear = useCallback(async () => {
    if (timer.current) clearTimeout(timer.current);
    await AsyncStorage.removeItem(key(uid)).catch(() => {});
  }, [uid]);

  return { draft, update, clear };
}
