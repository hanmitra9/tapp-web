import { useEffect, useState } from 'react';

// Countdown for "Resend code" so users can't trip Supabase's email rate limit.
export function useCooldown(initialSeconds = 0) {
  const [left, setLeft] = useState(initialSeconds);
  useEffect(() => {
    if (left <= 0) return;
    const t = setTimeout(() => setLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [left]);
  return { left, start: (s = 60) => setLeft(s) };
}
