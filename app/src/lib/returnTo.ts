import Constants from 'expo-constants';

// Remember the page someone opened before signing in (e.g. a campaign link from the website),
// send them to the login screen, and bring them back there afterwards.
const AUTH_ROUTES = ['/welcome', '/login', '/register', '/verify-email', '/forgot-password', '/reset-password'];
const KEY = 'tapp_return_to';

function currentRoute(): string | null {
  if (typeof window === 'undefined') return null;
  const base = String((Constants.expoConfig?.experiments as { baseUrl?: string } | undefined)?.baseUrl ?? '').replace(/\/$/, '');
  let p = window.location.pathname;
  if (base && p.startsWith(base)) p = p.slice(base.length) || '/';
  return p + window.location.search;
}

// Captured once at load, before the router redirects anywhere.
const initial = currentRoute();
export const openedProtectedPage = !!initial && initial !== '/' && !AUTH_ROUTES.some((r) => initial.startsWith(r));

export function rememberReturn() {
  if (openedProtectedPage && initial) { try { sessionStorage.setItem(KEY, initial); } catch { /* ignore */ } }
}
export function takeReturn(): string | null {
  try { const v = sessionStorage.getItem(KEY); if (v) sessionStorage.removeItem(KEY); return v; } catch { return null; }
}
