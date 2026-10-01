import { useCallback, useEffect, useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { Button } from '@/components/Button';
import { Header } from '@/components/Header';
import { LoadState } from '@/components/LoadState';
import { Notice } from '@/components/Notice';
import { Screen } from '@/components/Screen';
import { errorMessage } from '@/lib/errors';
import { useAuth } from '@/providers/AuthProvider';
import { fetchCreatorProfile, fetchPlatforms, setMainPlatform, startTiktokConnect, tiktokConnectEnabled, type LinkedPlatform } from '@/features/creator/api';
import { PlatformManager } from '@/features/creator/forms/PlatformManager';
import type { Platform } from '@/features/creator/options';

// Result of the tiktok-oauth redirect (?tiktok=connected|error&reason=…).
const TIKTOK_ERRORS: Record<string, string> = {
  taken: 'Akun TikTok itu sudah terdaftar di kreator lain. Hubungi TAPP kalau itu akunmu.',
  cancelled: 'Login TikTok dibatalkan.',
  expired: 'Sesi login TikTok kedaluwarsa. Coba lagi.',
  no_profile: 'Lengkapi profil kreatormu dulu.',
};

export default function Socials() {
  const { session } = useAuth();
  const uid = session!.user.id;
  const [platforms, setPlatforms] = useState<LinkedPlatform[] | null>(null);
  const [main, setMain] = useState<Platform | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const q = useLocalSearchParams<{ tiktok?: string; reason?: string; handle?: string }>();
  const [ttEnabled, setTtEnabled] = useState(false);
  const [ttBusy, setTtBusy] = useState(false);
  const ttResult = q.tiktok === 'connected' ? `TikTok @${q.handle ?? ''} terhubung dan terverifikasi. Views klipmu tercatat otomatis.`
    : q.tiktok === 'error' ? (TIKTOK_ERRORS[q.reason ?? ''] ?? 'TikTok gagal terhubung. Coba lagi.') : null;
  useEffect(() => { tiktokConnectEnabled().then(setTtEnabled).catch(() => {}); }, []);

  async function connectTiktok() {
    setTtBusy(true); setError(null);
    try { window.location.assign(await startTiktokConnect()); }
    catch (e) { setError(errorMessage(e)); setTtBusy(false); }
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
      <Header title="Akun media sosial" subtitle="Akun baru akan diverifikasi TAPP sebelum dipakai untuk submission." />
      {platforms ? (
        <>
          <Notice tone={q.tiktok === 'error' ? 'error' : 'info'} message={ttResult} />
          <Notice tone="error" message={error} />
          {ttEnabled ? (
            <Button label={platforms.some((p) => p.platform === 'tiktok' && p.verified_at) ? 'Hubungkan ulang TikTok' : 'Hubungkan dengan TikTok'}
              onPress={connectTiktok} loading={ttBusy} />
          ) : null}
          <PlatformManager uid={uid} platforms={platforms} onPlatforms={setPlatforms} mainPlatform={main} onMainPlatform={changeMain} />
        </>
      ) : <LoadState error={loadError} onRetry={load} />}
    </Screen>
  );
}
