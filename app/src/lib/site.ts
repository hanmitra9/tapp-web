import Constants from 'expo-constants';

// The app is served from the same site as the landing page (site/), so its pages are plain URLs here.
const base = String((Constants.expoConfig?.experiments as { baseUrl?: string } | undefined)?.baseUrl ?? '').replace(/\/$/, '');

/** Full-page navigation to a landing-site page (leaves the app router). */
export function goToSite(path = '/') {
  if (typeof window !== 'undefined') window.location.assign(base + path);
}
