import { useCallback, useEffect, useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { Button } from '@/components/Button';
import { Header } from '@/components/Header';
import { LoadState } from '@/components/LoadState';
import { Notice } from '@/components/Notice';
import { Screen } from '@/components/Screen';
import { errorMessage } from '@/lib/errors';
import { useAuth } from '@/providers/AuthProvider';
import { CONNECT_PLATFORMS, connectEnabled, fetchCreatorProfile, fetchPlatforms, setMainPlatform, startConnect, type ConnectPlatform, type LinkedPlatform } from '@/features/creator/api';
import { BioVerify } from '@/features/creator/forms/BioVerify';
import { PlatformManager } from '@/features/creator/forms/PlatformManager';
import type { Platform } from '@/features/creator/options';

const LABEL: Record<ConnectPlatform, string> = { tiktok: 'TikTok', instagram: 'Instagram' };
// Result of the <platform>-oauth redirect (?tiktok=connected|error&reason=…, same for instagram).
const ERRORS: Record<string, (label: string) => string> = {
  taken: (l) => `Akun ${l} itu sudah terdaftar di kreator lain. Hubungi TAPP kalau itu akunmu.`,
  cancelled: (l) => `Login ${l} dibatalkan.`,
  expired: (l) => `Sesi login ${l} kedaluwarsa. Coba lagi.`,
  no_profile: () => 'Lengkapi profil kreatormu dulu.',
  profile: (l) => (l === 'Instagram' ? 'Gunakan akun Instagram Professional (Business atau Creator), lalu coba lagi.' : `Profil ${l} tidak terbaca. Coba lagi.`),
};

export default function Socials() {
  const { session } = useAuth();
  const uid = session!.user.id;
  const [platforms, setPlatforms] = useState<LinkedPlatform[] | null>(null);
  const [main, setMain] = useState<Platform | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const q = useLocalSearchParams<{ tiktok?: string; instagram?: string; reason?: string; handle?: string }>();
  const [enabled, setEnabled] = useState<Record<ConnectPlatform, boolean>>({ tiktok: false, instagram: false });
  const [busy, setBusy] = useState<ConnectPlatform | null>(null);
  const returned = CONNECT_PLATFORMS.find((p) => q[p]);
  const result = !returned ? null : q[returned] === 'connected'
    ? `${LABEL[returned]} @${q.handle ?? ''} terhubung dan terverifikasi. Views klipmu tercatat otomatis.`
    : (ERRORS[q.reason ?? '']?.(LABEL[returned]) ?? `${LABEL[returned]} gagal terhubung. Coba lagi.`);
  useEffect(() => { connectEnabled().then(setEnabled).catch(() => {}); }, []);

  async function connect(p: ConnectPlatform) {
    setBusy(p); setError(null);
    try { window.location.assign(await startConnect(p)); }
    catch (e) { setError(errorMessage(e)); setBusy(null); }
  }

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const [pl, prof] = await Promise.all([fetchPlatforms(uid), fetchCreatorProfile(uid)]);
      setPlatforms(pl); setMain(prof.mainPlatform);
    } catch (e) { setLoadError(errorMessage(e)); }
  }, [uid]);
  useEffect(() => { void load(); }, [load]);

  async function changeMain(p: Platform | null) {
    const prev = main;
    setMain(p); setError(null);                        // optimistic; reverted on failure
    try { await setMainPlatform(uid, p); } catch (e) { setMain(prev); setError(errorMessage(e)); }
  }

  return (
    <Screen scroll={!!platforms}>
      <Header title="Akun media sosial" subtitle="Verifikasi akun TikTok dan Instagram-mu dengan kode di bio sebelum dipakai untuk submission." />
      {platforms ? (
        <>
          <Notice tone={returned && q[returned] === 'error' ? 'error' : 'info'} message={result} />
          <Notice tone="error" message={error} />
          {CONNECT_PLATFORMS.filter((p) => enabled[p]).map((p) => (
            <Button key={p} variant={p === 'tiktok' ? 'primary' : 'secondary'} loading={busy === p} disabled={busy !== null && busy !== p}
              label={platforms.some((x) => x.platform === p && x.verified_at) ? `Hubungkan ulang ${LABEL[p]}` : `Hubungkan dengan ${LABEL[p]}`}
              onPress={() => connect(p)} />
          ))}
          <PlatformManager uid={uid} platforms={platforms} onPlatforms={setPlatforms} mainPlatform={main} onMainPlatform={changeMain} />
          {platforms.filter((p) => !p.verified_at && (p.platform === 'tiktok' || p.platform === 'instagram')).map((p) => (
            <BioVerify key={p.id} p={p} onVerified={load} />
          ))}
        </>
      ) : <LoadState error={loadError} onRetry={load} />}
    </Screen>
  );
}
