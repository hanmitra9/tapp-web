import type React from 'react';
import Feather from '@expo/vector-icons/Feather';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Linking, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { Button } from '@/components/Button';
import { EmptyState } from '@/components/EmptyState';
import { Header } from '@/components/Header';
import { LoadState } from '@/components/LoadState';
import { Notice } from '@/components/Notice';
import { Screen } from '@/components/Screen';
import { errorMessage } from '@/lib/errors';
import { compact, cpmLabel, deadlineLabel, idr, idrCompact } from '@/lib/format';
import { useQuery } from '@/lib/useQuery';
import { useAuth } from '@/providers/AuthProvider';
import { color, radius, space, type, card } from '@/theme/tokens';
import { web } from '@/theme/web';
import { assetLink, fetchAssets, fetchCampaign, type Asset, type CampaignDetail } from '@/features/campaigns/api';
import { CAMPAIGN_STATUS } from '@/features/campaigns/copy';
import { fetchMySubmissions, withdrawSubmission } from '@/features/submissions/api';
import { SubmissionRow } from '@/features/submissions/SubmissionRow';
import { fetchLeaderboard, type LeaderRow } from '@/features/campaigns/leaderboard';
import { LeaderList, MyStanding, Podium } from '@/components/Leaderboard';
import { ShareCardSheet } from '@/components/ShareCardSheet';
import { track } from '@/lib/analytics';
import { renderViewsCard, shareRenderedCard, type RenderedCard } from '@/lib/shareCard';

// Why the creator can't submit right now (null = can submit). Mirrors check_submission on the server.
function submitBlock(c: CampaignDetail, accountStatus: string | undefined): string | null {
  if (c.membership?.status !== 'joined') return 'Kamu sudah tidak tergabung di campaign ini.';
  if (accountStatus !== 'active') return 'Akunmu belum aktif, jadi belum bisa submit konten.';
  if (c.status === 'paused') return 'Campaign sedang dijeda. Submission dibuka lagi saat campaign aktif.';
  if (c.status !== 'active') return `Campaign ${CAMPAIGN_STATUS[c.status].toLowerCase()}. Submission baru ditutup.`;
  const dl = c.submission_deadline;
  if (dl && new Date(dl) < new Date()) return 'Batas waktu submission sudah lewat.';
  if (c.remaining <= 0) return 'Budget campaign sudah habis.';
  return null;
}

export default function Workspace() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { account } = useAuth();
  const q = useQuery(async () => {
    const c = await fetchCampaign(id);
    const joined = c.membership?.status === 'joined';
    const [assets, subs, board] = await Promise.all([joined ? fetchAssets(id) : Promise.resolve([] as Asset[]), fetchMySubmissions(id),
      joined ? fetchLeaderboard(id).catch(() => [] as LeaderRow[]) : Promise.resolve([] as LeaderRow[])]);
    return { c, assets, subs, board };
  }, [id]);
  const [error, setError] = useState<string | null>(null);
  const [card, setCard] = useState<RenderedCard | null>(null);
  const [making, setMaking] = useState(false);

  if (!q.data) return <Screen scroll={false}><Header title="Workspace" /><LoadState error={q.error} onRetry={q.reload} /></Screen>;
  const { c, assets, subs, board } = q.data;
  const block = submitBlock(c, account?.status);
  const totals = subs.reduce((t, s) => ({ q: t.q + s.qualified_views, e: t.e + s.earned }), { q: 0, e: 0 });
  const dl = deadlineLabel(c.submission_deadline ?? c.ends_at);
  const submit = (resubmit?: string) => router.push({ pathname: '/submit/[campaignId]', params: resubmit ? { campaignId: c.id, resubmit } : { campaignId: c.id } });

  async function openCard() {
    setMaking(true); setError(null);
    try {
      setCard(await renderViewsCard({ views: totals.q, campaign: c.title, from: c.membership?.joined_at ?? null, to: new Date().toISOString(),
        name: account?.fullName ?? account?.username ?? 'TAPP', avatarUrl: account?.avatarUrl ?? null }));
    } catch (e) { setError(errorMessage(e)); }
    finally { setMaking(false); }
  }
  function closeCard() { if (card) URL.revokeObjectURL(card.url); setCard(null); }
  async function shareCard() {
    if (!card) return;
    try { await shareRenderedCard(card); track('views_card_shared', { campaign: c.id }); } catch (e) { setError(errorMessage(e)); }
  }

  async function withdraw(sid: string) {
    setError(null);
    try { await withdrawSubmission(sid); await q.reload(); } catch (e) { setError(errorMessage(e)); }
  }

  return (
    <Screen
      refreshControl={<RefreshControl refreshing={q.refreshing} onRefresh={q.refresh} tintColor={color.blue} />}
      footer={block ? <Text style={styles.block}>{block}</Text> : <Button label="Submit Klip" onPress={() => router.push({ pathname: '/take/[id]', params: { id: c.id } })} />}
    >
      <Header title="" />
      <View style={styles.wHero} {...web('art')}>
        <Text style={styles.wBrand}>{c.brand.name} · {CAMPAIGN_STATUS[c.status]}</Text>
        <Text style={styles.wTitle} accessibilityRole="header" numberOfLines={2}>{c.title}</Text>
        <Text style={styles.wMeta}>{cpmLabel(c.cpm)}{dl ? ` · ${dl}` : ''}</Text>
        <View style={styles.wStats}>
          <Stat label="Klip" value={String(subs.length)} />
          <Stat label="Qualified views" value={compact(totals.q)} />
          <Stat label="Penghasilan" value={idrCompact(totals.e)} />
        </View>
      </View>
      {error ? <View style={styles.gap}><Notice tone="error" message={error} /></View> : null}

      {totals.q > 0 ? (
        <Pressable onPress={openCard} disabled={making} style={({ pressed }) => [styles.shareRow, pressed && { opacity: 0.7 }]} accessibilityRole="button">
          <Feather name="share" size={16} color={color.link} />
          <Text style={styles.link}>{making ? 'Membuat kartu…' : 'Bagikan pencapaianmu'}</Text>
        </Pressable>
      ) : null}
      <ShareCardSheet card={card} onClose={closeCard} onShare={shareCard} title="Qualified views"
        body={`Views terverifikasi di ${c.title}. Simpan atau bagikan ke story.`} />

      {c.membership?.status === 'joined' ? (
        <Section title="Panggung minggu ini" action={{ label: 'Peringkat TAPP', onPress: () => router.push('/leaderboard') }}>
          {board.length ? (
            <>
              <Podium entries={board.map((r) => ({ rank: r.rank, title: r.name, value: r.views, me: r.is_me }))} />
              <MyStanding entries={board.map((r) => ({ rank: r.rank, title: r.name, value: r.views, me: r.is_me }))} empty="Klip pertamamu yang diterima masuk papan ini." />
              <LeaderList entries={board.map((r) => ({ rank: r.rank, title: r.name, value: r.views, me: r.is_me }))} />
            </>
          ) : <Text style={styles.muted}>Belum ada views minggu ini.</Text>}
        </Section>
      ) : null}

      <Section title="Cara kerja">
        {['Buat klip dari konten sumber.', 'Posting di akunmu.', 'Tekan Submit Klip.', 'Disetujui → saldo masuk.'].map((t, i) => (
          <View key={t} style={styles.step}><Text style={styles.stepNum}>{i + 1}</Text><Text style={styles.stepText}>{t}</Text></View>
        ))}
      </Section>

      <Section title="Konten sumber">
        {assets.length ? assets.map((a) => <AssetRow key={a.id} a={a} />) : <Text style={styles.muted}>Brand belum menambahkan konten sumber.</Text>}
      </Section>

      <Section title="Brief & aturan" action={{ label: 'Lihat lengkap', onPress: () => router.push({ pathname: '/campaign/[id]', params: { id: c.id } }) }}>
        {c.rules.filter((r) => r.kind !== 'performance').slice(0, 4).map((r, i) => (
          <View key={i} style={styles.step}><Text style={styles.bullet}>•</Text><Text style={styles.stepText}>{r.body}</Text></View>
        ))}
        {c.guidelines_dont.slice(0, 3).map((t, i) => (
          <View key={`d${i}`} style={styles.step}><Text style={[styles.bullet, { color: color.danger }]}>−</Text><Text style={styles.stepText}>{t}</Text></View>
        ))}
      </Section>

      <Section title="Submission kamu">
        {subs.length ? subs.map((s) => (
          <SubmissionRow key={s.id} s={s}
            onResubmit={s.status === 'needs_changes' && !block ? () => submit(s.id) : undefined}
            onWithdraw={s.status === 'pending_review' || s.status === 'needs_changes' ? () => withdraw(s.id) : undefined}
            onDispute={s.status === 'rejected' || s.status === 'flagged'
              ? () => router.push({ pathname: '/dispute', params: { submission: s.id, reason: s.review_reason ?? '' } }) : undefined} />
        )) : (
          <EmptyState title="Belum ada submission" body={block ? 'Submission belum bisa dikirim saat ini.' : 'Posting klip, lalu submit di sini.'} />
        )}
      </Section>
    </Screen>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return <View style={styles.wStat}><Text style={styles.wStatValue} numberOfLines={1} adjustsFontSizeToFit>{value}</Text><Text style={styles.wStatLabel}>{label}</Text></View>;
}
function Section({ title, action, children }: { title: string; action?: { label: string; onPress: () => void }; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <Text style={styles.sectionTitle} accessibilityRole="header">{title}</Text>
        {action ? <Pressable onPress={action.onPress} hitSlop={10}><Text style={styles.link}>{action.label}</Text></Pressable> : null}
      </View>
      {children}
    </View>
  );
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
      <Feather name="download" size={16} color={color.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wHero: { borderRadius: radius.xl, padding: space.xl, gap: 4, overflow: 'hidden', backgroundColor: color.blueDeep },
  wBrand: { ...type.caption, color: 'rgba(255,255,255,0.78)' },
  wTitle: { ...type.title, color: '#FFFFFF', maxWidth: '85%' },
  wMeta: { ...type.caption, color: 'rgba(255,255,255,0.78)' },
  wStats: { flexDirection: 'row', gap: space.sm, marginTop: space.lg },
  wStat: { flex: 1, padding: space.md, gap: 2, borderRadius: radius.md, backgroundColor: 'rgba(5,10,20,0.45)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  wStatValue: { ...type.label, fontSize: 15, color: '#FFFFFF', fontVariant: ['tabular-nums'] },
  wStatLabel: { ...type.caption, fontSize: 11, color: 'rgba(255,255,255,0.7)' },
  lbRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm + 2, paddingHorizontal: space.md, borderRadius: radius.sm },
  lbMe: { backgroundColor: color.accentSoft },
  lbRank: { ...type.label, color: color.textMuted, width: 22, fontVariant: ['tabular-nums'] },
  lbName: { ...type.body, color: color.textSecondary, flex: 1 },
  lbViews: { ...type.label, color: color.text, fontVariant: ['tabular-nums'] },
  shareRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.md, alignSelf: 'flex-start', paddingVertical: space.xs },
  brand: { ...type.label, color: color.textSecondary, marginTop: -space.xl },
  title: { ...type.title, color: color.text, marginTop: space.xs },
  meta: { ...type.caption, color: color.textMuted, marginTop: space.xs, fontVariant: ['tabular-nums'] },
  gap: { marginTop: space.lg },
  stats: { flexDirection: 'row', marginTop: space.xl, gap: space.sm },
  stat: { flex: 1, padding: space.md, gap: 4, ...card, borderRadius: radius.md },
  statValue: { ...type.heading, color: color.text, fontVariant: ['tabular-nums'] },
  statLabel: { ...type.caption, color: color.textMuted },
  section: { marginTop: space.xxl, gap: space.md },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  sectionTitle: { ...type.heading, color: color.text },
  link: { ...type.label, color: color.link },
  step: { flexDirection: 'row', gap: space.md },
  stepNum: { ...type.label, color: color.link, width: 14, fontVariant: ['tabular-nums'] },
  bullet: { ...type.body, color: color.link, width: 14 },
  stepText: { ...type.body, color: color.text, flex: 1 },
  muted: { ...type.body, color: color.textMuted },
  asset: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg, borderWidth: 1, borderColor: color.border, borderRadius: radius.md },
  assetTitle: { ...type.label, color: color.text },
  assetErr: { ...type.caption, color: color.danger },
  block: { ...type.caption, color: color.textSecondary, textAlign: 'center', paddingVertical: space.md },
});
