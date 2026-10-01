import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

// Re-runs `reload` every `ms` while this screen is focused and the browser tab is visible (and once when the tab
// comes back), so open dashboards keep themselves current without a manual refresh. Returns when it last ran.
export function useAutoRefresh(reload: () => Promise<unknown> | void, ms = 60_000) {
  const [at, setAt] = useState(() => Date.now());
  useFocusEffect(useCallback(() => {
    const visible = () => typeof document === 'undefined' || document.visibilityState === 'visible';
    const run = async () => { if (visible()) { await reload(); setAt(Date.now()); } };
    const timer = setInterval(run, ms);
    const onVis = () => { if (visible()) void run(); };
    if (typeof document !== 'undefined') document.addEventListener('visibilitychange', onVis);
    return () => { clearInterval(timer); if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', onVis); };
  }, [reload, ms]));
  return at;
}
