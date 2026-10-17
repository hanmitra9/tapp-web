import Feather from '@expo/vector-icons/Feather';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import { Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { LoadState } from '@/components/LoadState';
import { RankBadge, RANK_METAL } from '@/components/RankBadge';
import { Screen } from '@/components/Screen';
import { TopBar } from '@/components/TopBar';
import { compact, idr } from '@/lib/format';
import { useQuery } from '@/lib/useQuery';
import { useLayout } from '@/lib/useLayout';
import { color, radius, space, type, card } from '@/theme/tokens';
import { fetchTierProgress, TIERS, type Tier } from '@/features/creator/tier';
import { fetchPayouts } from '@/features/payouts/api';

const NAME: Record<Tier, string> = { new: 'New', rising: 'Rising', verified: 'Verified', proven: 'Proven', elite: 'Elite' };

// Rank & Rewards: current level badge, all five levels, the bonus it earns, progress to the next one, and every level's terms.
export default function RankScreen() {
  const { isWide } = useLayout();
  const q = useQuery(async () => {
    const [p, payouts] = await Promise.all([fetchTierProgress(), fetchPayouts().catch(() => [])]);
    const bonusReceived = payouts.filter((x) => x.status === 'paid').reduce((a, x) => a + Number(x.bonus ?? 0), 0);
    return { p, bonusReceived };
  }, []);
  const [pick, setPick] = useState<Tier | null>(null);
  useEffect(() => { if (q.data && !pick) setPick(q.data.p.tier); }, [q.data, pick]);
  if (!q.data) return <Screen scroll={false}><TopBar title="Rank" back /><LoadState error={q.error} onRetry={q.reload} /></Screen>;
  const { p, bonusReceived } = q.data;
  const shown = pick ?? p.tier;
  const idx = TIERS.indexOf(p.tier);
  const shownIdx = TIERS.indexOf(shown);
  const m = RANK_METAL[shown];
  const ratio = p.to == null ? 1 : Math.min(1, Math.max(0, (p.views - p.from) / Math.max(1, p.to - p.from)));

  return (
    <Screen refreshControl={<RefreshControl refreshing={q.refreshing} onRefresh={q.refresh} tintColor={color.blue} />}>
      <TopBar title="Rank" back />

      <View style={styles.hero}>
        <LinearGradient colors={[m.glow.replace(/[\d.]+\)$/, '0.35)'), 'rgba(0,0,0,0)']} style={StyleSheet.absoluteFill} />
        <RankBadge tier={shown} size={150} />
        <Text style={styles.level}>Rank {shownIdx + 1}</Text>
        <Text style={[styles.tierName, css({ backgroundImage: `linear-gradient(180deg, #FFFFFF 0%, ${m.hi} 100%)`, WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' })]}>
          {NAME[shown]} Clipper
        </Text>
        <View style={[styles.bonusPill, { borderColor: `${m.hi}55` }]}>
          <Text style={styles.bonusPillText}>{p.bonuses[shown] ? `+${p.bonuses[shown]}% bonus` : 'Tanpa bonus'}</Text>
        </View>
        {shown !== p.tier ? <Text style={styles.peek}>{shownIdx > idx ? 'Terkunci' : 'Terlewati'}</Text> : null}

        <View style={styles.divider} />
        <View style={styles.strip}>
          {TIERS.map((t, i) => (
            <Pressable key={t} onPress={() => setPick(t)} accessibilityRole="button" accessibilityLabel={`Rank ${i + 1}, ${NAME[t]}`}
              style={({ pressed }) => [styles.stripItem, pressed && { opacity: 0.7 }]}>
              <RankBadge tier={t} size={isWide ? 70 : 54} dim={i > idx && t !== shown} />
              <Text style={[styles.stripLabel, t === shown && { color: '#FFFFFF' }]}>Rank {i + 1}</Text>
              {t === p.tier ? <View style={styles.youDot} /> : null}
            </Pressable>
          ))}
        </View>
      </View>


      <View style={[styles.row2, !isWide && { flexDirection: 'column' }]}>
        <View style={[styles.rewards, isWide && { flex: 1 }]}>
          <View style={styles.rewardCol}>
            <Text style={styles.rewardBig}>+{p.bonusPct}%</Text>
            <Text style={styles.rewardSub}>Bonus tarik</Text>
          </View>
          <View style={styles.vline} />
          <View style={styles.rewardCol}>
            <Text style={[styles.rewardBig, { color: '#F5A35C' }]}>{idr(bonusReceived)}</Text>
            <Text style={styles.rewardSub}>Bonus diterima</Text>
          </View>
        </View>

        <View style={[styles.next, isWide && { flex: 1.6 }]}>
          {p.next ? (() => {
            const n = p.next;
            const reqs = [
              { label: 'Views', have: p.views, need: p.thresholds[n], fmt: compact },
              ...(p.minApproved[n] ? [{ label: 'Klip diterima', have: p.approved, need: p.minApproved[n], fmt: (x: number) => String(x) }] : []),
              ...(p.minApprovalPct[n] ? [{ label: 'Approval', have: p.approvalPct, need: p.minApprovalPct[n], fmt: (x: number) => `${x}%` }] : []),
            ];
            return (
              <>
                <View style={styles.nextHead}>
                  <Text style={styles.nextTitle}>Menuju {NAME[n]} · +{p.nextBonusPct}%</Text>
                  <Text style={styles.reqPill}>{reqs.filter((r) => r.have >= r.need).length}/{reqs.length}</Text>
                </View>
                {reqs.map((r) => {
                  const done = r.have >= r.need, rr = Math.min(1, r.have / Math.max(1, r.need));
                  return (
                    <View key={r.label} style={{ gap: 6 }}>
                      <View style={styles.req}>
                        <Feather name={done ? 'check-circle' : 'circle'} size={16} color={done ? color.success : color.textMuted} />
                        <Text style={styles.reqText}>{r.label}</Text>
                        <Text style={styles.reqNum}>{r.fmt(r.have)}/{r.fmt(r.need)}</Text>
                      </View>
                      <View style={styles.track}><LinearGradient colors={[RANK_METAL[n].hi, RANK_METAL[n].mid]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[styles.fill, { width: `${Math.max(2, rr * 100)}%` }]} /></View>
                    </View>
                  );
                })}
              </>
            );
          })() : (
            <View style={{ gap: 6 }}>
              <Text style={styles.nextTitle}>Rank tertinggi</Text>
              <Text style={styles.reqHint}>+{p.bonusPct}% di setiap penarikan.</Text>
            </View>
          )}
        </View>
      </View>

      <View style={styles.all}>
        <Text style={styles.allTitle}>Semua rank</Text>
        <View style={styles.grid}>
          {TIERS.map((t, i) => {
            const mine = t === p.tier, locked = i > idx;
            return (
              <Pressable key={t} onPress={() => setPick(t)} accessibilityRole="button"
                style={({ pressed }) => [styles.tierCard, isWide ? { flexBasis: '18%' } : { flexBasis: '30%' }, mine && styles.tierCardMine, pressed && { opacity: 0.8 }]}>
                <Text style={[styles.tierCardName, { color: RANK_METAL[t].hi }]} numberOfLines={1}>{NAME[t]}</Text>
                <RankBadge tier={t} size={64} dim={locked} />
                <View style={styles.cardLine} />
                <Text style={styles.tierPct}>+{p.bonuses[t]}%</Text>
                <Text style={styles.tierReq}>{p.thresholds[t] ? `${compact(p.thresholds[t])} views` : 'Awal'}</Text>
                {p.minApproved[t] ? <Text style={styles.tierReq2}>{p.minApproved[t]} klip{p.minApprovalPct[t] ? ` · ${p.minApprovalPct[t]}%` : ''}</Text> : null}
                <View style={styles.tierFoot}>
                  {mine ? <Text style={styles.mineText}>Kamu</Text>
                    : locked ? <Feather name="lock" size={12} color={color.textMuted} /> : <Feather name="check" size={13} color={color.success} />}
                </View>
              </Pressable>
            );
          })}
        </View>
      </View>
    </Screen>
  );
}

const css = (o: object) => o as object;

const styles = StyleSheet.create({
  hero: { marginHorizontal: -space.xl, marginTop: space.md, paddingTop: space.xl, paddingHorizontal: space.xl, alignItems: 'center', overflow: 'hidden' },
  level: { ...type.label, color: color.textSecondary, marginTop: space.lg },
  tierName: { fontFamily: type.display.fontFamily, fontWeight: '600', fontSize: 32, lineHeight: 38, letterSpacing: -0.6, color: '#FFFFFF', marginTop: 4 },
  bonusPill: { marginTop: space.sm, paddingHorizontal: 14, height: 32, justifyContent: 'center', borderRadius: radius.md, borderWidth: 1, backgroundColor: 'rgba(255,255,255,0.05)' },
  bonusPillText: { ...type.label, fontSize: 13, color: color.text },
  peek: { ...type.caption, color: color.textMuted, marginTop: space.sm },
  divider: { alignSelf: 'stretch', height: 1, marginTop: space.xl, backgroundColor: 'rgba(255,255,255,0.12)' },
  strip: { flexDirection: 'row', justifyContent: 'center', gap: 4, paddingVertical: space.lg, alignSelf: 'stretch' },
  stripItem: { flex: 1, maxWidth: 96, alignItems: 'center', gap: 4 },
  stripLabel: { ...type.caption, fontSize: 11, color: color.textMuted },
  youDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: '#F5C451' },

  auto: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, borderRadius: radius.md, ...card },
  autoTitle: { ...type.label, color: color.text },
  autoSub: { ...type.caption, color: color.textMuted },

  row2: { flexDirection: 'row', gap: space.md, marginTop: space.md },
  rewards: { flexDirection: 'row', alignItems: 'center', padding: space.lg, borderRadius: radius.lg, ...card },
  rewardCol: { flex: 1, alignItems: 'center', gap: 4 },
  rewardLabel: { ...type.label, color: color.textSecondary },
  rewardBig: { ...type.title, fontSize: 24, color: color.text, fontVariant: ['tabular-nums'] },
  rewardSub: { ...type.caption, fontSize: 12, color: color.textMuted, textAlign: 'center' },
  vline: { width: 1, alignSelf: 'stretch', backgroundColor: 'rgba(255,255,255,0.08)', marginHorizontal: space.sm },

  next: { padding: space.lg, gap: space.md, borderRadius: radius.lg, ...card },
  nextHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm },
  nextTitle: { ...type.heading, color: color.text, flexShrink: 1 },
  reqPill: { ...type.caption, fontSize: 12, color: color.text, paddingHorizontal: 12, paddingVertical: 4, borderRadius: radius.pill,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)', overflow: 'hidden' },
  req: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  reqText: { ...type.label, color: color.text, flex: 1 },
  reqNum: { ...type.caption, color: color.textSecondary, fontVariant: ['tabular-nums'] },
  track: { height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.07)', overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3 },
  reqHint: { ...type.caption, color: color.textMuted },

  all: { marginTop: space.md, padding: space.lg, borderRadius: radius.lg, gap: space.md, ...card },
  allTitle: { ...type.heading, color: color.text },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  tierCard: { flexGrow: 1, alignItems: 'center', gap: 6, paddingVertical: space.lg, paddingHorizontal: space.sm, borderRadius: radius.md,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)', backgroundColor: '#0B0B10' },
  tierCardMine: { backgroundColor: '#15151C', borderColor: 'rgba(255,255,255,0.18)' },
  tierCardName: { ...type.caption, fontSize: 12 },
  cardLine: { alignSelf: 'stretch', height: 1, backgroundColor: 'rgba(255,255,255,0.07)', marginVertical: 4 },
  tierPct: { ...type.heading, fontSize: 20, color: color.text, fontVariant: ['tabular-nums'] },
  tierReq: { ...type.caption, fontSize: 12, color: color.textMuted },
  tierReq2: { ...type.caption, fontSize: 11, color: color.textMuted, textAlign: 'center' },
  tierFoot: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
  mineText: { ...type.label, fontSize: 12, color: color.text },
  lockText: { ...type.caption, fontSize: 12, color: color.textMuted },
});
