import { useCallback, useEffect, useState } from 'react';
import { Header } from '@/components/Header';
import { LoadState } from '@/components/LoadState';
import { Notice } from '@/components/Notice';
import { Screen } from '@/components/Screen';
import { errorMessage } from '@/lib/errors';
import { useAuth } from '@/providers/AuthProvider';
import { fetchCreatorProfile, fetchPlatforms, setMainPlatform, type LinkedPlatform } from '@/features/creator/api';
import { PlatformManager } from '@/features/creator/forms/PlatformManager';
import type { Platform } from '@/features/creator/options';

export default function Socials() {
  const { session } = useAuth();
  const uid = session!.user.id;
  const [platforms, setPlatforms] = useState<LinkedPlatform[] | null>(null);
  const [main, setMain] = useState<Platform | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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
          <Notice tone="error" message={error} />
          <PlatformManager uid={uid} platforms={platforms} onPlatforms={setPlatforms} mainPlatform={main} onMainPlatform={changeMain} />
        </>
      ) : <LoadState error={loadError} onRetry={load} />}
    </Screen>
  );
}
