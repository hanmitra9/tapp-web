import { useCallback, useEffect, useRef, useState } from 'react';
import { adminError } from './errors';

export function useLoad<T>(fn: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const seq = useRef(0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const reload = useCallback(async () => {
    const id = ++seq.current; setLoading(true);
    try { const d = await fn(); if (id === seq.current) { setData(d); setError(null); } }
    catch (e) { if (id === seq.current) setError(adminError(e)); }
    finally { if (id === seq.current) setLoading(false); }
  }, deps);
  useEffect(() => { void reload(); }, [reload]);
  return { data, error, loading, reload };
}
