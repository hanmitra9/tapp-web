import { useCallback, useEffect, useRef, useState } from 'react';
import { BackHandler, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button } from '@/components/Button';
import { LoadState } from '@/components/LoadState';
import { Notice } from '@/components/Notice';
import { Screen } from '@/components/Screen';
import { StepProgress } from '@/components/StepProgress';
import { errorMessage } from '@/lib/errors';
import { validateName, validateUsername } from '@/lib/validation';
import { useAuth } from '@/providers/AuthProvider';
import { color, space, type } from '@/theme/tokens';
import {
  completeOnboarding, fetchCreatorProfile, fetchPayoutMethod, fetchPlatforms, isUsernameAvailable, savePayoutMethod,
  type LinkedPlatform, type PayoutMethod,
} from '@/features/creator/api';
import { AudienceFields } from '@/features/creator/forms/AudienceFields';
import { ContentFields } from '@/features/creator/forms/ContentFields';
import { emptyPayout, normalizePayout, PayoutForm, validatePayout, type PayoutValues } from '@/features/creator/forms/PayoutForm';
import { PlatformManager } from '@/features/creator/forms/PlatformManager';
import { ProfileFields } from '@/features/creator/forms/ProfileFields';
import { useUsernameCheck } from '@/features/creator/forms/useUsernameCheck';
import { maskAccount } from '@/features/creator/handles';
import { COUNTRIES, EXPERIENCE, labelOf, platformLabel } from '@/features/creator/options';
import { useOnboardingDraft } from '@/features/creator/useOnboardingDraft';
import { track } from '@/lib/analytics';

const STEPS = [
  { title: 'Profil kamu', subtitle: 'Nama dan username ini yang akan dilihat brand.' },
  { title: 'Akun media sosial', subtitle: 'Tempat kamu memposting klip. TAPP memverifikasi akun ini sebelum kamu bisa ikut campaign.' },
  { title: 'Konten kamu', subtitle: 'Dipakai untuk mencocokkan kamu dengan campaign yang relevan.' },
  { title: 'Penonton kamu', subtitle: 'Perkiraan saja. Bisa diubah kapan pun.' },
  { title: 'Rekening pembayaran', subtitle: 'Ke mana bayaran klipmu ditransfer.' },
  { title: 'Periksa lagi', subtitle: 'Setelah dikirim, tim TAPP akan meninjau akunmu.' },
];

export default function Onboarding() {
  const { account, session, refreshAccount, signOut } = useAuth();
  const uid = session!.user.id;
  const { draft, update, clear } = useOnboardingDraft(uid, account?.fullName ?? null);

  const [platforms, setPlatforms] = useState<LinkedPlatform[] | null>(null);
  const [payout, setPayout] = useState<PayoutMethod | null>(null);
  const [payoutForm, setPayoutForm] = useState<PayoutValues>(emptyPayout(null));
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scroll = useRef<ScrollView>(null);
  const usernameStatus = useUsernameCheck(draft?.username ?? '', null);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const [pl, pm, prof] = await Promise.all([fetchPlatforms(uid), fetchPayoutMethod(uid), fetchCreatorProfile(uid)]);
      setPlatforms(pl); setPayout(pm); setPayoutForm(emptyPayout(pm)); setAvatarUrl(prof.avatarUrl);
    } catch (e) { setLoadError(errorMessage(e)); }
  }, [uid]);
  useEffect(() => { void load(); }, [load]);

  const step = draft?.step ?? 0;
  const goTo = useCallback((s: number) => {
    update({ step: s }); track('onboarding_step', { step: s }); setTouched(false); setError(null); scroll.current?.scrollTo({ y: 0, animated: false });
  }, [update]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { if (step > 0) { goTo(step - 1); return true; } return false; });
    return () => sub.remove();
  }, [step, goTo]);

  if (loadError) return <Screen width="narrow" scroll={false}><LoadState error={loadError} onRetry={load} /></Screen>;
  if (!draft || !platforms) return <Screen width="narrow" scroll={false}><LoadState /></Screen>;

  // ── Per-step validation ──
  const profileErrs = {
    fullName: validateName(draft.fullName),
    username: draft.username ? validateUsername(draft.username) : 'Pilih username.',
    country: draft.country ? null : 'Pilih negara.',
  };
  const contentErrs = {
    categories: draft.categories.length ? null : 'Pilih minimal satu jenis konten.',
    experience: draft.experience ? null : 'Pilih pengalamanmu.',
  };
  const mainLinked = !!draft.mainPlatform && platforms.some((p) => p.platform === draft.mainPlatform);
  const platformErr = !platforms.length ? 'Tambahkan minimal satu akun.' : !mainLinked ? 'Pilih platform utama.' : null;
  const audienceErr = draft.audience.countries.length ? null : 'Pilih minimal satu negara.';

  async function next() {
    setTouched(true); setError(null);
    if (busy || !draft) return;
    switch (step) {
      case 0: {
        if (profileErrs.fullName || profileErrs.username || profileErrs.country || usernameStatus === 'taken') return;
        if (usernameStatus !== 'available') {
          setBusy(true);
          try { if (!(await isUsernameAvailable(draft.username))) { setBusy(false); return setError('Username ini sudah dipakai.'); } }
          catch (e) { setBusy(false); return setError(errorMessage(e)); }
          setBusy(false);
        }
        return goTo(1);
      }
      case 1: return platformErr ? undefined : goTo(2);
      case 2: return contentErrs.categories || contentErrs.experience ? undefined : goTo(3);
      case 3: return audienceErr ? undefined : goTo(4);
      case 4: {
        if (Object.keys(validatePayout(payoutForm)).length) return;
        const norm = normalizePayout(payoutForm);
        const unchanged = payout && JSON.stringify(emptyPayout(payout)) === JSON.stringify(norm);
        if (!unchanged) {
          setBusy(true);
          try { const saved = await savePayoutMethod(uid, payout?.id ?? null, norm); setPayout(saved); setPayoutForm(emptyPayout(saved)); }
          catch (e) { setBusy(false); return setError(errorMessage(e)); }
          setBusy(false);
        }
        return goTo(5);
      }
      case 5: {
        setBusy(true);
        try {
          await completeOnboarding({
            fullName: draft.fullName, username: draft.username, country: draft.country, mainPlatform: draft.mainPlatform!,
            niches: draft.niches, categories: draft.categories, contentStyle: draft.contentStyle,
            audience: draft.audience, experience: draft.experience!,
          });
          await clear();
          track('onboarding_completed');
          await refreshAccount();              // onboarded → guard leaves this screen
        } catch (e) {
          const msg = errorMessage(e);
          setError(msg);
          // Jump back to the step that owns the problem.
          const code = (e as { message?: string })?.message?.split(':')[0];
          if (code === 'username_taken' || (e as { code?: string })?.code === '23505') goTo(0);
          else if (code === 'platform_required' || code === 'main_platform_not_linked') goTo(1);
          else if (code === 'payout_method_required') goTo(4);
          setError(msg);
        } finally { setBusy(false); }
      }
    }
  }

  const s = STEPS[step]!;
  return (
    <Screen width="narrow"
      scrollRef={scroll}
      footer={
        <>
          <Button label={step === 5 ? 'Kirim untuk ditinjau' : 'Lanjut'} onPress={next} loading={busy} />
          {step > 0 ? <Button variant="quiet" label="Kembali" onPress={() => goTo(step - 1)} />
            : <Button variant="quiet" label="Keluar" onPress={signOut} />}
        </>
      }
    >
      <StepProgress step={step} total={STEPS.length} title={s.title} />
      <Text style={styles.title} accessibilityRole="header">{s.title}</Text>
      <Text style={styles.subtitle}>{s.subtitle}</Text>
      <View style={styles.body}>
        <Notice tone="error" message={error} />
        {step === 0 ? (
          <ProfileFields uid={uid} values={draft} onChange={update} avatarUrl={avatarUrl} onAvatar={setAvatarUrl}
            usernameStatus={usernameStatus} errors={touched ? profileErrs : {}} />
        ) : null}
        {step === 1 ? (
          <PlatformManager uid={uid} platforms={platforms} onPlatforms={setPlatforms} mainPlatform={draft.mainPlatform}
            onMainPlatform={(mainPlatform) => update({ mainPlatform })} error={touched ? platformErr : null} />
        ) : null}
        {step === 2 ? <ContentFields values={draft} onChange={update} errors={touched ? contentErrs : {}} /> : null}
        {step === 3 ? <AudienceFields value={draft.audience} onChange={(audience) => update({ audience })} error={touched ? audienceErr : null} /> : null}
        {step === 4 ? <PayoutForm values={payoutForm} onChange={setPayoutForm} showErrors={touched} /> : null}
        {step === 5 ? (
          <View style={styles.review}>
            <ReviewRow label="Nama" value={`${draft.fullName.trim()} · @${draft.username}`} onEdit={() => goTo(0)} />
            <ReviewRow label="Negara" value={labelOf(COUNTRIES, draft.country)} onEdit={() => goTo(0)} />
            <ReviewRow label="Akun sosial" onEdit={() => goTo(1)}
              value={platforms.map((p) => `${platformLabel(p.platform)} @${p.handle}${p.platform === draft.mainPlatform ? ' (utama)' : ''}`).join('\n')} />
            <ReviewRow label="Pengalaman" value={labelOf(EXPERIENCE, draft.experience ?? '')} onEdit={() => goTo(2)} />
            <ReviewRow label="Pembayaran" onEdit={() => goTo(4)}
              value={payout ? `${payout.provider} ${maskAccount(payout.account_number)} · ${payout.account_name}` : '—'} />
          </View>
        ) : null}
      </View>
    </Screen>
  );
}

function ReviewRow({ label, value, onEdit }: { label: string; value: string; onEdit: () => void }) {
  return (
    <View style={styles.row}>
      <View style={styles.rowText}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.rowValue}>{value || '—'}</Text>
      </View>
      <Button variant="quiet" label="Ubah" onPress={onEdit} accessibilityLabel={`Ubah ${label}`} />
    </View>
  );
}

const styles = StyleSheet.create({
  title: { ...type.title, color: color.text },
  subtitle: { ...type.body, color: color.textSecondary, marginTop: space.sm },
  body: { marginTop: space.xxl, gap: space.lg },
  review: { borderTopWidth: 1, borderTopColor: color.border },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md, paddingVertical: space.lg, borderBottomWidth: 1, borderBottomColor: color.border },
  rowText: { flex: 1, gap: 4 },
  rowLabel: { ...type.caption, color: color.textMuted },
  rowValue: { ...type.body, color: color.text },
});
