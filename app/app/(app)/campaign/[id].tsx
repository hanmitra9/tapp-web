import type React from 'react';
import { showAlert } from '@/lib/alert';
import Feather from '@expo/vector-icons/Feather';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useState, useEffect } from 'react';
import { Image, Linking, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { Button } from '@/components/Button';
import { Header } from '@/components/Header';
import { LoadState } from '@/components/LoadState';
import { Notice } from '@/components/Notice';
import { Screen } from '@/components/Screen';
import { errorMessage } from '@/lib/errors';
import { cpmLabel, dateLabel, deadlineLabel, idr, idrCompact, num } from '@/lib/format';
import { useQuery } from '@/lib/useQuery';
import { web } from '@/theme/web';
import { card, color, radius, space, type } from '@/theme/tokens';
import { assetLink, fetchAssets, fetchCampaign, leaveCampaign, type Asset } from '@/features/campaigns/api';
import { JoinedRow } from '@/features/campaigns/JoinedRow';
import { GuideCard, GuideSheet, guideSteps } from '@/features/campaigns/GuideSheet';
import { CAMPAIGN_STATUS, categoryLabel, joinBlockCopy, platformsLabel } from '@/features/campaigns/copy';
import { track } from '@/lib/analytics';

const RULE_TITLES = { requirement: 'Syarat konten', submission: 'Aturan submission', performance: 'Aturan performa' } as const;

export default function CampaignDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  useEffect(() => { track('campaign_viewed', { campaign_id: id }); }, [id]);
  const q = useQuery(async () => {
    const c = await fetchCampaign(id);
    const assets = c.membership?.status === 'joined' ? await fetchAssets(id) : [];
    return { c, assets };
  }, [id]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [guide, setGuide] = useState<false | 'view' | 'take'>(false);

  if (!q.data) return <Screen scroll={false}><Header title="" /><LoadState error={q.error} onRetry={q.reload} /></Screen>;
  const { c, assets } = q.data;
  const joined = c.membership?.status === 'joined';
  const block = joinBlockCopy(c.join_block);
  // The bar shows what's left, matching its label (and the website's "Budget Tersisa" bars).
  const pct = c.budget ? Math.min(Math.max(c.remaining, 0) / c.budget, 1) : 0;
  const deadline = c.submission_deadline ?? c.ends_at;
  const rulesBy = (k: keyof typeof RULE_TITLES) => c.rules.filter((r) => r.kind === k);

  function confirmLeave() {
    showAlert('Keluar dari campaign?',
      'Kamu tidak bisa submit konten baru. Klip yang sudah disubmit tetap dilacak dan penghasilannya tetap milikmu.',
      [{ text: 'Batal', style: 'cancel' }, { text: 'Keluar', style: 'destructive', onPress: async () => {
        setBusy(true); setError(null);
        try { await leaveCampaign(c.id); track('campaign_left', { campaign_id: c.id }); await q.reload(); } catch (e) { setError(errorMessage(e)); }
        finally { setBusy(false); }
      } }]);
  }

  const take = () => router.push({ pathname: '/take/[id]', params: { id: c.id } });
  // Taking a campaign shows the video guide first; "Oke, Saya Paham" continues.
  const startTake = () => setGuide('take');
  const footer = joined ? (
    <>
      <View style={styles.footRow}>
        <View style={{ flex: 1 }}><Button variant="secondary" label="Workspace" onPress={() => router.push({ pathname: '/workspace/[id]', params: { id: c.id } })} /></View>
        <View style={{ flex: 1.4 }}><Button label="Submit Klip" onPress={take} disabled={c.status !== 'active'} /></View>
      </View>
      <Button variant="quiet" label="Keluar dari campaign" onPress={confirmLeave} disabled={busy} />
    </>
  ) : block?.action === 'socials' ? (
    <>
      <Text style={styles.blockNote}>Hubungkan akun {platformsLabel(c.platforms)} di langkah pertama.</Text>
      <Button label="Ambil Campaign" onPress={startTake} />
    </>
  ) : block ? (
    <>
      {block.note ? <Text style={styles.blockNote}>{block.note}</Text> : null}
      <Button label={block.label} disabled={block.action !== 'socials'} variant={block.action ? 'primary' : 'secondary'}
        onPress={() => block.action === 'socials' && router.push('/profile/socials')} />
    </>
  ) : (
    <>
      <Text style={styles.blockNote}>{cpmLabel(c.cpm)} · {c.max_earning_per_submission ? `maks ${idrCompact(c.max_earning_per_submission)} per klip` : 'tanpa batas per klip'}</Text>
      <Button label="Ambil Campaign" onPress={startTake} loading={busy} />
    </>
  );

  return (
    <Screen footer={footer} refreshControl={<RefreshControl refreshing={q.refreshing} onRefresh={q.refresh} tintColor={color.blue} />}>
      <Header title="" />
      <View style={styles.hero} {...(c.banner_url ? {} : web('art'))}>
        {c.banner_url ? <Image source={{ uri: c.banner_url }} style={StyleSheet.absoluteFill} resizeMode="cover" accessibilityIgnoresInvertColors />
          : <Image source={require('../../../assets/tapp-mark-white.png')} style={styles.artMark} accessibilityIgnoresInvertColors />}
        <LinearGradient colors={['rgba(0,0,0,0)', 'rgba(4,7,12,0.85)']} start={{ x: 0, y: 0.45 }} end={{ x: 0, y: 1 }} style={StyleSheet.absoluteFill} />
        <View style={styles.heroRate}><Text style={styles.heroRateValue}>{idr(c.cpm)}</Text><Text style={styles.heroRateUnit}>/1K views</Text></View>
        <View style={styles.heroText}>
          <Text style={styles.heroBrand}>{c.brand.name} · {categoryLabel(c.category)}{c.status !== 'active' ? ` · ${CAMPAIGN_STATUS[c.status]}` : ''}</Text>
          <Text style={styles.heroTitle} accessibilityRole="header" numberOfLines={3}>{c.title}</Text>
        </View>
      </View>
      <View style={styles.gap}><JoinedRow count={c.creators_joined} initials={c.joined_initials} /></View>

      {error ? <View style={styles.gap}><Notice tone="error" message={error} /></View> : null}

      <View style={styles.facts}>
        <Fact icon="trending-up" label="Per 1.000 views" value={idr(c.cpm)} strong />
        <Fact icon="clock" label="Deadline" value={deadline ? deadlineLabel(deadline) ?? dateLabel(deadline) : 'Tidak ada'} />
        <Fact icon="smartphone" label="Platform" value={platformsLabel(c.platforms)} />
        <Fact icon="users" label="Kreator" value={num(c.creators_joined)} />
      </View>

      <View style={styles.budget} accessible accessibilityLabel={`Sisa budget ${Math.round(pct * 100)} persen`}>
        <View style={styles.budgetHead}>
          <Text style={styles.budgetLabel}>Sisa budget</Text>
          <Text style={styles.budgetValue}>{Math.round(pct * 100)}%</Text>
        </View>
        <View style={styles.track} {...web('track')}><View style={[styles.fill, { width: `${pct * 100}%` }]} {...web('seg-q')} /></View>
      </View>

      {!joined ? (
        <Section title="Cara Ambil Campaign">
          <View style={styles.how}>
            {[['user-check', 'Pilih akun', 'Akun yang dipakai posting'], ['shield', 'Verifikasi', 'Kode unik di bio'], ['film', 'Pilih video', 'Langsung dari akunmu']].map(([ic, t, d], i) => (
              <View key={t} style={styles.howItem}>
                <View style={styles.howIcon}><Feather name={ic as 'film'} size={16} color={color.link} /><Text style={styles.howNum}>{i + 1}</Text></View>
                <Text style={styles.howTitle}>{t}</Text>
                <Text style={styles.howDesc}>{d}</Text>
              </View>
            ))}
          </View>
        </Section>
      ) : null}
      <View style={styles.section}>
        <GuideCard count={guideSteps(c, assets.length).length} onPress={() => setGuide('view')} />
      </View>
      <GuideSheet c={c} assetCount={assets.length} visible={!!guide} onClose={() => setGuide(false)}
        onAck={guide === 'take' ? () => { setGuide(false); try { globalThis.localStorage?.setItem(`tapp:guide:${c.id}`, '1'); } catch { /* storage off */ } take(); } : undefined} />

      <Section title="Konten sumber">
        {joined ? (assets.length ? assets.map((a) => <AssetRow key={a.id} a={a} />)
          : <Text style={styles.muted}>Brand belum menambahkan konten sumber.</Text>)
          : <Text style={styles.muted}>Terbuka setelah kamu bergabung.</Text>}
      </Section>

      <Section title="Bayaran">
        <Bullets items={[
          `${cpmLabel(c.cpm)} (qualified views).`,
          `100rb views = ${idr(c.cpm * 100)}${c.max_earning_per_submission && c.cpm * 100 > c.max_earning_per_submission ? ` (dibatasi ${idr(c.max_earning_per_submission)})` : ''}.`,
          c.min_views_to_qualify > 0 ? `Min. ${num(c.min_views_to_qualify)} views per klip.` : 'Tanpa minimum views.',
          c.max_earning_per_submission ? `Maks. ${idr(c.max_earning_per_submission)} per klip.` : 'Tanpa batas per klip.',
          'Views iklan, bot & repost tidak dihitung.',
        ]} />
      </Section>
      {rulesBy('submission').length ? <Section title={RULE_TITLES.submission}><Bullets items={rulesBy('submission').map((r) => r.body)} /></Section> : null}
      {rulesBy('performance').length ? <Section title={RULE_TITLES.performance}><Bullets items={rulesBy('performance').map((r) => r.body)} /></Section> : null}
      {c.terms ? <Section title="Ketentuan"><Text style={styles.body}>{c.terms}</Text></Section> : null}
    </Screen>
  );
}

function Fact({ icon, label, value, strong }: { icon: React.ComponentProps<typeof Feather>['name']; label: string; value: string; strong?: boolean }) {
  return (
    <View style={styles.fact}>
      <View style={styles.factHead}><Feather name={icon} size={13} color={strong ? color.link : color.textMuted} /><Text style={styles.factLabel}>{label}</Text></View>
      <Text style={[styles.factValue, strong && styles.factStrong]} numberOfLines={2}>{value}</Text>
    </View>
  );
}
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <View style={styles.section}><Text style={styles.sectionTitle} accessibilityRole="header">{title}</Text>{children}</View>;
}
function Bullets({ items, mark = '•', danger }: { items: string[]; mark?: string; danger?: boolean }) {
  return <View style={{ gap: space.sm }}>{items.map((t, i) => (
    <View key={i} style={styles.bullet}>
      <Text style={[styles.mark, danger && { color: color.danger }]}>{mark}</Text>
      <Text style={styles.bulletText}>{t}</Text>
    </View>
  ))}</View>;
}
function AssetRow({ a }: { a: Asset }) {
  const [err, setErr] = useState<string | null>(null);
  const icon = a.kind === 'video' ? 'film' : a.kind === 'audio' ? 'headphones' : a.kind === 'image' ? 'image' : a.kind === 'document' ? 'file-text' : 'link';
  return (
    <Pressable accessibilityRole="link" style={({ pressed }) => [styles.asset, pressed && { backgroundColor: color.surface }]}
      onPress={async () => {
        setErr(null);
        try { const url = await assetLink(a); if (url) await Linking.openURL(url); else setErr('File tidak tersedia.'); }
        catch (e) { setErr(errorMessage(e)); }
      }}>
      <Feather name={icon} size={18} color={color.blue} />
      <View style={{ flex: 1 }}>
        <Text style={styles.assetTitle}>{a.title}</Text>
        {err ? <Text style={styles.assetErr}>{err}</Text> : null}
      </View>
      <Feather name="external-link" size={16} color={color.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hero: { width: '100%', aspectRatio: 1.45, borderRadius: radius.xl, backgroundColor: color.surface, overflow: 'hidden', justifyContent: 'space-between', padding: space.lg },
  heroRate: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'baseline', gap: 3, paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.pill,
    backgroundColor: 'rgba(5,10,20,0.62)', borderWidth: 1, borderColor: 'rgba(52,208,122,0.45)' },
  heroRateValue: { ...type.heading, color: color.success, fontVariant: ['tabular-nums'] },
  heroRateUnit: { ...type.caption, color: 'rgba(255,255,255,0.75)' },
  heroText: { gap: 4 },
  heroBrand: { ...type.caption, color: 'rgba(255,255,255,0.78)' },
  heroTitle: { ...type.title, color: '#FFFFFF' },
  artMark: { position: 'absolute', right: '14%', top: '50%', width: 64, height: 64, marginTop: -32 },
  brand: { ...type.label, color: color.textSecondary, marginTop: space.xs },
  title: { ...type.title, color: color.text, marginTop: space.xs },
  meta: { ...type.caption, color: color.textMuted, marginTop: space.xs },
  gap: { marginTop: space.lg },
  facts: { flexDirection: 'row', flexWrap: 'wrap', marginTop: space.xl, gap: space.sm },
  fact: { width: '48%', flexGrow: 1, padding: space.md, gap: 6, ...card, borderRadius: radius.md },
  factHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  factLabel: { ...type.caption, color: color.textMuted },
  factValue: { ...type.label, color: color.text, fontVariant: ['tabular-nums'] },
  factStrong: { ...type.heading, color: color.text },
  footRow: { flexDirection: 'row', gap: space.sm },
  how: { flexDirection: 'row', gap: space.sm },
  howItem: { flex: 1, padding: space.md, gap: 4, ...card, borderRadius: radius.md },
  howIcon: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space.xs },
  howNum: { ...type.caption, color: color.textMuted, fontVariant: ['tabular-nums'] },
  howTitle: { ...type.label, color: color.text },
  howDesc: { ...type.caption, fontSize: 12, color: color.textMuted },
  budget: { marginTop: space.lg, gap: space.sm },
  budgetHead: { flexDirection: 'row', justifyContent: 'space-between' },
  budgetLabel: { ...type.caption, color: color.textMuted },
  budgetValue: { ...type.caption, color: color.text, fontVariant: ['tabular-nums'] },
  track: { height: 4, backgroundColor: color.border, borderRadius: 2, overflow: 'hidden' },
  fill: { height: 4, backgroundColor: color.blue },
  section: { marginTop: space.xxl, gap: space.md },
  sectionTitle: { ...type.heading, color: color.text },
  subhead: { ...type.label, color: color.textSecondary },
  body: { ...type.body, color: color.text },
  muted: { ...type.body, color: color.textMuted },
  bullet: { flexDirection: 'row', gap: space.sm },
  mark: { ...type.body, color: color.link, width: 12 },
  bulletText: { ...type.body, color: color.text, flex: 1 },
  asset: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg, borderWidth: 1, borderColor: color.border, borderRadius: radius.md },
  assetTitle: { ...type.label, color: color.text },
  assetErr: { ...type.caption, color: color.danger },
  joinedBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm, minHeight: 52, borderRadius: radius.md, backgroundColor: color.accentSoft },
  joinedText: { ...type.heading, color: color.link },
  blockNote: { ...type.caption, color: color.textSecondary, textAlign: 'center' },
});
