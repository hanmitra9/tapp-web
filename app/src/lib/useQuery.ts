import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { errorMessage } from './errors';

// Minimal fetch-state hook: loads on focus, keeps last data while refreshing, exposes pull-to-refresh.
export function useQuery<T>(fn: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const seq = useRef(0);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const load = useCallback(async () => {
    const id = ++seq.current;
    try { const d = await fn(); if (id === seq.current) { setData(d); setError(null); } }
    catch (e) { if (id === seq.current) setError(errorMessage(e)); }
  }, deps);

  useFocusEffect(useCallback(() => { void load(); }, [load]));
  const refresh = useCallback(async () => { setRefreshing(true); await load(); setRefreshing(false); }, [load]);
  return { data, error, refreshing, refresh, reload: load, setData };
}
