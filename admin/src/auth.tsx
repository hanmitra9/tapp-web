import { createClient } from '@supabase/supabase-js';
import type { Session } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { supabase } from './lib/supabase';

type Admin = { id: string; name: string | null; email: string | undefined };
const Ctx = createContext<{ admin: Admin; signOut: () => Promise<void> } | null>(null);
export const useAdmin = () => useContext(Ctx)!;

// Only profiles.role = 'admin' gets past this gate. The DB enforces the same rule on every read/RPC regardless.
export function AdminGate({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [admin, setAdmin] = useState<Admin | null>(null);
  const [denied, setDenied] = useState(false);
  const [aal2, setAal2] = useState<boolean | null>(null);
  // Bumped only on events that can change who is signed in or their 2FA level. A silent token refresh (it happens
  // whenever the tab comes back, e.g. after switching to the authenticator app) must not re-run the gate: that
  // unmounted the 2FA screen and started a brand-new QR setup.
  const [epoch, setEpoch] = useState(0);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((e, s) => {
      setSession(s);
      if (e !== 'TOKEN_REFRESHED' && e !== 'INITIAL_SESSION') setEpoch((n) => n + 1);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const uid = session?.user.id;
  useEffect(() => {
    setAdmin(null); setDenied(false); setAal2(null);
    if (!session) return;
    supabase.from('profiles').select('id, full_name, role').eq('id', session.user.id).single().then(({ data }) => {
      if (data?.role === 'admin') setAdmin({ id: data.id, name: data.full_name, email: session.user.email });
      else setDenied(true);
    });
    // 2FA is required only while app_settings.require_admin_mfa is on (the database enforces the same switch).
    Promise.all([supabase.rpc('login_policy'), supabase.auth.mfa.getAuthenticatorAssuranceLevel()]).then(([pol, lvl]) => {
      const required = (pol.data as { require_admin_mfa?: boolean } | null)?.require_admin_mfa !== false;
      setAal2(!required || lvl.data?.currentLevel === 'aal2');
    });
  }, [uid, epoch]); // session itself is read but deliberately not a dependency (see epoch)

  const signOut = async () => { await supabase.auth.signOut(); };
  if (session === undefined) return null;
  if (!session) return <Login />;
  if (denied) return (
    <div className="login"><div style={{ display: 'grid', gap: 12, maxWidth: 360 }}>
      <h1>Tidak punya akses</h1>
      <p className="sub">{session.user.email} bukan akun admin TAPP. Akses admin hanya untuk email yang terdaftar di daftar admin.</p>
      <button className="btn secondary" onClick={signOut}>Keluar</button>
    </div></div>
  );
  if (!admin || aal2 === null) return null;
  // When admin 2FA is on, the DB only treats an admin session as admin at AAL2 (migration 026): finish 2FA first.
  if (!aal2) return <TwoFactor uid={session.user.id} email={session.user.email} onSignOut={signOut} />;
  return <Ctx.Provider value={{ admin, signOut }}>{children}</Ctx.Provider>;
}

// Admin sign-in / sign-up.
//  - Sign in: password; when app_settings.require_login_otp is on, the password is checked on a throwaway client
//    and a 6-digit code is emailed (only the session from that code is accepted by the API).
//  - Sign up: name, email, password, then the 6-digit verification code. Emails listed in app_settings.admin_emails
//    become admin the moment they are verified; any other email gets a normal account and "Tidak punya akses".
type Step = 'login' | 'loginCode' | 'register' | 'registerCode';
function Login() {
  const [step, setStep] = useState<Step>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const addr = email.trim().toLowerCase();
  const friendly = (m: string) =>
    m === 'Invalid login credentials' ? 'Email atau kata sandi salah. Belum punya akun? Pilih "Daftar".'
    : /already registered|already exists/i.test(m) ? 'Email ini sudah terdaftar. Silakan masuk.'
    : /not confirmed/i.test(m) ? 'Email belum diverifikasi. Daftar ulang dengan email yang sama untuk menerima kode baru.'
    : /rate limit|too many/i.test(m) ? 'Terlalu banyak percobaan. Tunggu beberapa menit lalu coba lagi.'
    : /expired|invalid.*(otp|token)|token.*invalid/i.test(m) ? 'Kode salah atau sudah kedaluwarsa.'
    : /password/i.test(m) ? 'Kata sandi minimal 8 karakter.' : m;
  const go = (st: Step) => { setStep(st); setError(null); setInfo(null); setCode(''); };

  async function sendLoginCode() {
    const { error: err } = await supabase.auth.signInWithOtp({ email: addr, options: { shouldCreateUser: false } });
    if (err) throw err;
  }
  async function submit(e: FormEvent) {
    e.preventDefault(); setBusy(true); setError(null); setInfo(null);
    try {
      if (step === 'loginCode' || step === 'registerCode') {
        const { error: err } = await supabase.auth.verifyOtp({ email: addr, token: code.trim(), type: 'email' });
        if (err) throw err;
        return;   // AdminGate takes over once the session exists
      }
      if (step === 'register') {
        if (name.trim().length < 2) throw new Error('Isi nama lengkap.');
        if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) throw new Error('Kata sandi minimal 8 karakter, dengan huruf dan angka.');
        const { data, error: err } = await supabase.auth.signUp({ email: addr, password, options: { data: { full_name: name.trim() } } });
        if (err) throw err;
        if (data.session) return;   // email confirmation turned off in Supabase: already signed in
        if (data.user && (data.user.identities ?? []).length === 0) throw new Error('already registered');
        setStep('registerCode'); setInfo(`Kode verifikasi 6 digit dikirim ke ${addr}. Cek juga folder Spam.`);
        return;
      }
      const { data: policy } = await supabase.rpc('login_policy');
      if (!(policy as { require_login_otp?: boolean } | null)?.require_login_otp) {
        const { error: err } = await supabase.auth.signInWithPassword({ email: addr, password });
        if (err) throw err;
        return;
      }
      const probe = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false, storageKey: 'tapp-admin-probe' } });
      const { error: err } = await probe.auth.signInWithPassword({ email: addr, password });
      if (err) throw err;
      await probe.auth.signOut({ scope: 'local' }).catch(() => {});
      await sendLoginCode();
      setStep('loginCode'); setInfo(`Kode 6 digit dikirim ke ${addr}.`);
    } catch (err) {
      setError(friendly((err as Error).message ?? String(err)));
    } finally { setBusy(false); }
  }
  async function resend() {
    setError(null);
    try {
      if (step === 'registerCode') { const { error: err } = await supabase.auth.resend({ type: 'signup', email: addr }); if (err) throw err; }
      else await sendLoginCode();
      setInfo('Kode baru dikirim.');
    } catch (err) { setError(friendly((err as Error).message)); }
  }
  const codeStep = step === 'loginCode' || step === 'registerCode';
  return (
    <div className="login">
      <form onSubmit={submit}>
        <img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="TAPP" />
        <h1>{step === 'register' ? 'Daftar akun admin' : step === 'registerCode' ? 'Verifikasi email' : 'TAPP Control'}</h1>
        {error ? <div className="notice error">{error}</div> : null}
        {info ? <div className="notice info">{info}</div> : null}
        {step === 'register' ? <label className="field">Nama lengkap<input autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} required /></label> : null}
        {!codeStep ? (
          <>
            <label className="field">Email<input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
            <label className="field">Kata sandi<input type="password" autoComplete={step === 'register' ? 'new-password' : 'current-password'} value={password} onChange={(e) => setPassword(e.target.value)} required /></label>
          </>
        ) : (
          <label className="field">Kode verifikasi<input inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} autoFocus required /></label>
        )}
        <button className="btn" disabled={busy || (codeStep && code.length !== 6)}>{busy ? 'Memproses…' : step === 'register' ? 'Daftar' : codeStep ? 'Verifikasi' : 'Masuk'}</button>
        {codeStep ? <button type="button" className="btn secondary" disabled={busy} onClick={resend}>Kirim ulang kode</button> : null}
        {step === 'login' ? <p className="sub" style={{ margin: 0, textAlign: 'center' }}>Belum punya akun? <a href="#" onClick={(e) => { e.preventDefault(); go('register'); }}>Daftar</a></p> : null}
        {step !== 'login' ? <p className="sub" style={{ margin: 0, textAlign: 'center' }}><a href="#" onClick={(e) => { e.preventDefault(); go('login'); }}>Kembali ke halaman masuk</a></p> : null}
      </form>
    </div>
  );
}

// Two-factor (TOTP authenticator app). First time: scan the QR code and confirm a code. After that: code only.
// Verifying upgrades the session to AAL2; onAuthStateChange then re-runs the gate above.
// The pending setup (QR + secret) is kept in this browser for 30 minutes, so coming back from the authenticator app
// — even after the phone reloaded the tab — shows the same QR instead of a new one.
const SETUP_KEY = 'tapp_admin_mfa_setup';
type Setup = { uid: string; factorId: string; qr: string; secret: string; at: number };
const readSetup = (uid: string): Setup | null => {
  try { const v = JSON.parse(localStorage.getItem(SETUP_KEY) ?? 'null') as Setup | null; return v && v.uid === uid && Date.now() - v.at < 30 * 60_000 ? v : null; } catch { return null; }
};
const writeSetup = (v: Setup | null) => { try { if (v) localStorage.setItem(SETUP_KEY, JSON.stringify(v)); else localStorage.removeItem(SETUP_KEY); } catch { /* storage blocked */ } };

function TwoFactor({ uid, email, onSignOut }: { uid: string; email: string | undefined; onSignOut: () => Promise<void> }) {
  const [factorId, setFactorId] = useState<string | null>(null);
  const [enroll, setEnroll] = useState<{ qr: string; secret: string } | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data, error: err } = await supabase.auth.mfa.listFactors();
      if (err) return setError(err.message);
      const verified = data.totp.find((f) => f.status === 'verified');
      if (verified) { writeSetup(null); return setFactorId(verified.id); }
      const pending = data.all.filter((x) => x.factor_type === 'totp' && x.status !== 'verified');
      // Same setup still pending (user went to the authenticator app and came back): keep showing it.
      const saved = readSetup(uid);
      if (saved && pending.some((f) => f.id === saved.factorId)) { setFactorId(saved.factorId); return setEnroll({ qr: saved.qr, secret: saved.secret }); }
      // Leftover unverified factors (an abandoned setup) block a new enrollment — clear them first.
      for (const f of pending) await supabase.auth.mfa.unenroll({ factorId: f.id });
      const { data: e, error: enrollErr } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: `TAPP Control ${Date.now()}` });
      if (enrollErr) return setError(enrollErr.message);
      writeSetup({ uid, factorId: e.id, qr: e.totp.qr_code, secret: e.totp.secret, at: Date.now() });
      setFactorId(e.id); setEnroll({ qr: e.totp.qr_code, secret: e.totp.secret });
    })();
  }, [uid]);

  async function submit(ev: FormEvent) {
    ev.preventDefault();
    if (!factorId) return;
    setBusy(true); setError(null);
    const { error: err } = await supabase.auth.mfa.challengeAndVerify({ factorId, code: code.trim() });
    setBusy(false);
    if (err) setError(/invalid|expired/i.test(err.message) ? 'Kode salah atau sudah kedaluwarsa. Coba kode terbaru.' : err.message);
    else writeSetup(null);
  }

  return (
    <div className="login">
      <form onSubmit={submit}>
        <img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="TAPP" />
        <h1>{enroll ? 'Aktifkan verifikasi 2 langkah' : 'Verifikasi 2 langkah'}</h1>
        {error ? <div className="notice error">{error}</div> : null}
        {enroll ? (
          <>
            <p className="sub" style={{ margin: 0 }}>Wajib untuk akun admin. Pindai kode QR ini dengan Google Authenticator, Authy, atau 1Password, lalu masukkan kode 6 digit.</p>
            <img src={enroll.qr} alt="Kode QR authenticator" style={{ width: 180, height: 180, background: '#fff', borderRadius: 12, padding: 8, justifySelf: 'center' }} />
            <p className="sub" style={{ margin: 0, wordBreak: 'break-all' }}>Tidak bisa pindai? Masukkan kode: <code>{enroll.secret}</code></p>
          </>
        ) : <p className="sub" style={{ margin: 0 }}>Masukkan kode 6 digit dari aplikasi authenticator untuk {email}.</p>}
        <label className="field">Kode authenticator<input inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} autoFocus required /></label>
        <button className="btn" disabled={busy || !factorId || code.length !== 6}>{busy ? 'Memproses…' : 'Verifikasi'}</button>
        <button type="button" className="btn secondary" onClick={onSignOut}>Keluar</button>
      </form>
    </div>
  );
}
