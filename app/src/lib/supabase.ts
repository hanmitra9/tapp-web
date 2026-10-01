import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !anonKey) throw new Error('Missing EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY in .env');

export const supabase = createClient(url, anonKey, {
  auth: {
    // Web: pass localStorage explicitly. Leaving it undefined lets auth-js pick storage itself, and in the
    // web build that probe could fall back to in-memory storage — i.e. a page refresh would log the user out.
    storage: Platform.OS === 'web' ? (typeof window !== 'undefined' ? window.localStorage : undefined) : AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Refresh tokens only while foregrounded; recovers expired sessions when the app wakes.
AppState.addEventListener('change', (state) => {
  if (state === 'active') supabase.auth.startAutoRefresh();
  else supabase.auth.stopAutoRefresh();
});
