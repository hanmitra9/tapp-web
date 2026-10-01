import type { Session } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import { identify, resetAnalytics } from '@/lib/analytics';

export type CreatorStatus = 'pending' | 'verified' | 'active' | 'suspended' | 'banned';

export type Account = {
  id: string;
  fullName: string | null;
  username: string | null;
  role: 'creator' | 'brand' | 'admin';
  status: CreatorStatus;
  statusReason: string | null;
  onboarded: boolean;
};

type AuthState = {
  ready: boolean;                 // initial session restored
  session: Session | null;
  account: Account | null;
  accountError: boolean;
  recovering: boolean;            // password-reset session: keep user on the reset screen
  setRecovering: (v: boolean) => void;
  refreshAccount: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

async function loadAccount(userId: string): Promise<Account> {
  const [p, c] = await Promise.all([
    supabase.from('profiles').select('id, full_name, username, role').eq('id', userId).single(),
    supabase.from('creator_profiles').select('status, status_reason, onboarding_completed_at').eq('user_id', userId).single(),
  ]);
  if (p.error) throw p.error;
  if (c.error) throw c.error;
  return {
    id: p.data.id,
    fullName: p.data.full_name,
    username: p.data.username,
    role: p.data.role,
    status: c.data.status,
    statusReason: c.data.status_reason,
    onboarded: c.data.onboarding_completed_at != null,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [account, setAccount] = useState<Account | null>(null);
  const [accountError, setAccountError] = useState(false);
  const [recovering, setRecovering] = useState(false);
  const userIdRef = useRef<string | null>(null);

  const refreshAccount = useCallback(async () => {
    const uid = userIdRef.current;
    if (!uid) return setAccount(null);
    try {
      // Accept any pending brand invite for this (verified) email before reading the role.
      await supabase.rpc('claim_brand_invites').then(() => undefined, () => undefined);
      const a = await loadAccount(uid);
      if (userIdRef.current === uid) { setAccount(a); setAccountError(false); }
    } catch (e) {
      // A password-only session once sign-in verification is switched on: send the user back to log in.
      if (String((e as { message?: string })?.message ?? '').includes('login_verification_required')) { await supabase.auth.signOut(); return; }
      if (userIdRef.current === uid) setAccountError(true);   // keep last known account; screen shows retry
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      userIdRef.current = data.session?.user.id ?? null;
      if (data.session) identify(data.session.user.id);
      setSession(data.session);
      setReady(true);
      if (data.session) void refreshAccount();
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, next) => {
      const nextUid = next?.user.id ?? null;
      const changedUser = nextUid !== userIdRef.current;
      userIdRef.current = nextUid;
      if (nextUid && changedUser) identify(nextUid);
      setSession(next);
      if (event === 'SIGNED_OUT' || !next) { setAccount(null); setRecovering(false); return; }
      if (changedUser || event === 'USER_UPDATED') void refreshAccount();
    });
    return () => { mounted = false; sub.subscription.unsubscribe(); };
  }, [refreshAccount]);

  const signOut = useCallback(async () => {
    resetAnalytics();
    const { error } = await supabase.auth.signOut();
    if (error) await supabase.auth.signOut({ scope: 'local' });  // offline: still clear the device session
  }, []);

  const value = useMemo<AuthState>(
    () => ({ ready, session, account, accountError, recovering, setRecovering, refreshAccount, signOut }),
    [ready, session, account, accountError, recovering, refreshAccount, signOut],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
