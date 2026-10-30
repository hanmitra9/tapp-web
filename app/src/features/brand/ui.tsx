import Feather from '@expo/vector-icons/Feather';
import { LinearGradient } from 'expo-linear-gradient';
import type { ComponentProps, ReactNode } from 'react';
import { Image, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { SkeletonBlock } from '@/components/Skeleton';
import { compact, idr } from '@/lib/format';
import type { BrandSubscription, SubscriptionPlan } from './api';
import { color, gradient, radius, space, type, card } from '@/theme/tokens';

type Icon = ComponentProps<typeof Feather>['name'];

type HeroAction = { label: string; icon: Icon; onPress: () => void };
// Budget hero: what's left and what's spent; first action solid, second glass.
export function BudgetHero({ budget, spent, primary, second }: { budget: number | null; spent: number; primary: HeroAction; second?: HeroAction }) {
  const used = budget ? Math.min(1, spent / budget) : 0;
  return (
    <LinearGradient colors={gradient.card} start={{ x: 0, y: 1 }} end={{ x: 1, y: 0 }} style={styles.hero} {...({ dataSet: { tapp: 'balance' } } as object)}>
      <View style={styles.heroTop}>
        <Text style={styles.heroLabel}>Sisa budget</Text>
        <Image source={require('../../../assets/tapp-mark-white.png')} style={styles.heroMark} accessibilityIgnoresInvertColors />
      </View>
      {budget == null ? <View style={styles.heroSkeleton} /> : (
        <Text style={styles.heroAmount} numberOfLines={1} adjustsFontSizeToFit>{idr(Math.max(budget - spent, 0))}</Text>
      )}
      <View style={styles.heroTrack}><View style={[styles.heroFill, { width: `${Math.max(used * 100, 1)}%` }]} /></View>
      <View style={styles.heroRow}>
        <Text style={styles.heroCap}>Terpakai {idr(spent)}</Text>
        <Text style={styles.heroCap}>{Math.round(used * 100)}% dari {budget == null ? '—' : idr(budget)}</Text>
      </View>
      <View style={styles.heroBtns}>
        <Pressable onPress={primary.onPress} style={({ pressed }) => [styles.heroBtn, styles.heroBtnSolid, pressed && { opacity: 0.85 }]} accessibilityRole="button">
          <Feather name={primary.icon} size={16} color="#0A2A4D" /><Text style={styles.heroBtnSolidText}>{primary.label}</Text>
        </Pressable>
        {second ? (
          <Pressable onPress={second.onPress} style={({ pressed }) => [styles.heroBtn, styles.heroBtnGlass, pressed && { opacity: 0.8 }]} accessibilityRole="button">
            <Feather name={second.icon} size={16} color="#FFFFFF" /><Text style={styles.heroBtnGlassText}>{second.label}</Text>
          </Pressable>
        ) : null}
      </View>
    </LinearGradient>
  );
}

// One KPI tile: icon, value, label, optional small note under it.
export function Kpi({ icon, label, value, note, tint = color.link }: { icon: Icon; label: string; value: string | null; note?: string; tint?: string }) {
  return (
    <View style={styles.kpi}>
      <View style={[styles.kpiIcon, { backgroundColor: tint + '1F' }]}><Feather name={icon} size={15} color={tint} /></View>
      {value == null ? <SkeletonBlock width="60%" height={24} /> : <Text style={styles.kpiValue} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>}
      <Text style={styles.kpiLabel} numberOfLines={1}>{label}</Text>
      {note ? <Text style={styles.kpiNote} numberOfLines={1}>{note}</Text> : null}
    </View>
  );
}
// Hashtag reach banner: TikTok's own total for the campaign hashtag(s), including videos outside TAPP.
export function HashtagTile({ views, videos, tags }: { views: number; videos: number; tags: string[] }) {
  return (
    <View style={styles.tag}>
      <View style={styles.tagIcon}><Feather name="hash" size={18} color="#FF4D8D" /></View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={styles.kpiLabel} numberOfLines={1}>Views hashtag TikTok · {tags.map((t) => `#${t}`).join(' ')}</Text>
        <Text style={styles.tagValue} numberOfLines={1} adjustsFontSizeToFit>{compact(views)} views</Text>
        <Text style={styles.kpiLabel}>{compact(videos)} video memakai hashtag</Text>
      </View>
    </View>
  );
}
const day = (iso: string | null) => (iso ? new Date(`${iso}T00:00:00`).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }) : '—');
// Monthly subscription: guaranteed views for this period, progress, and the next bill.
export function SubscriptionTile({ s, onPress }: { s: BrandSubscription; onPress?: () => void }) {
  const g = s.progress;
  const pct = g.period_target ? Math.min(100, Math.round((g.period_delivered / g.period_target) * 100)) : 0;
  const status = s.status === 'past_due' ? 'Tagihan lewat jatuh tempo' : s.status === 'pending' ? 'Menunggu pembayaran pertama' : `Tagihan berikut ${day(s.next_bill_at)}`;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => [styles.sub, pressed && { opacity: 0.9 }]}>
      <View style={styles.subHead}>
        <View style={styles.subIcon}><Feather name="repeat" size={16} color={color.link} /></View>
        <View style={{ flex: 1 }}>
          <Text style={styles.kpiLabel} numberOfLines={1}>Langganan {s.plan_name} · {s.campaign_title}</Text>
          <Text style={[styles.kpiNote, s.status !== 'active' && { color: color.warning }]} numberOfLines={1}>{status}</Text>
        </View>
      </View>
      {g.period_target ? (
        <>
          <Text style={styles.tagValue} numberOfLines={1} adjustsFontSizeToFit>{compact(g.period_delivered)} <Text style={styles.subOf}>/ {compact(g.period_target)} views dijamin</Text></Text>
          <View style={styles.subTrack}><View style={[styles.subFill, { width: `${Math.max(pct, 1)}%` }]} /></View>
          <Text style={styles.kpiLabel}>{pct}% · periode {day(g.period_start)} – {day(g.period_end)}{g.bonus_pct ? ` · termasuk bonus +${g.bonus_pct}% views` : ''}</Text>
        </>
      ) : null}
    </Pressable>
  );
}
// Offer for brands without a subscription: the plans with guaranteed views; ordering goes through the account manager.
export function PlansCard({ plans, onPick }: { plans: SubscriptionPlan[]; onPick: (p: SubscriptionPlan) => void }) {
  const bonus = Math.max(0, ...plans.map((p) => p.bonus_pct));
  return (
    <View style={styles.plans}>
      <View style={styles.subHead}>
        <View style={styles.subIcon}><Feather name="repeat" size={16} color={color.link} /></View>
        <View style={{ flex: 1 }}>
          <Text style={styles.plansTitle}>Langganan bulanan</Text>
          <Text style={styles.kpiLabel}>Views dijamin tiap bulan{bonus ? `, sudah termasuk bonus +${bonus}%` : ''}. Kurang? Terbawa ke bulan berikutnya.</Text>
        </View>
      </View>
      <View style={styles.planRow}>
        {plans.map((p, i) => (
          <Pressable key={p.id} onPress={() => onPick(p)} accessibilityRole="button" accessibilityLabel={`Langganan ${p.name}`}
            style={({ pressed }) => [styles.plan, i === 1 && styles.planHot, pressed && { opacity: 0.85 }]}>
            {i === 1 ? <Text style={styles.planBadge}>POPULER</Text> : null}
            <Text style={styles.planName}>{p.name}</Text>
            <Text style={styles.planViews} numberOfLines={1} adjustsFontSizeToFit>{compact(p.views)}</Text>
            <Text style={styles.kpiLabel}>views dijamin</Text>
            <Text style={styles.planPrice}>{idr(p.monthly_price)}<Text style={styles.subOf}> /bln</Text></Text>
            <View style={styles.planCta}><Text style={styles.planCtaText}>Pilih</Text><Feather name="arrow-right" size={14} color={color.link} /></View>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
export const KpiGrid = ({ children }: { children: ReactNode }) => <View style={styles.grid}>{children}</View>;

export function Section({ title, right, children }: { title: string; right?: ReactNode; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}><Text style={styles.sectionTitle}>{title}</Text>{right}</View>
      {children}
    </View>
  );
}

// CSV download (web). Native has no file save here, so the button is web-only.
export const canExport = Platform.OS === 'web';
export function downloadCsv(name: string, rows: (string | number)[][]) {
  const esc = (v: string | number) => { const s = String(v ?? ''); return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const blob = new Blob(['﻿' + rows.map((r) => r.map(esc).join(',')).join('\n')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

// PDF report (web): a print-ready page in a new tab; the browser's print dialog saves it as PDF.
const esc = (s: string | number) => String(s).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]!);
export type PdfReport = { title: string; subtitle: string; kpis: [string, string][]; tables: { title: string; head: string[]; rows: (string | number)[][] }[] };
export function printReport(r: PdfReport) {
  const w = window.open('', '_blank');
  if (!w) return;
  const table = (t: PdfReport['tables'][number]) => `<h2>${esc(t.title)}</h2><table><thead><tr>${t.head.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead>
    <tbody>${t.rows.map((row) => `<tr>${row.map((v) => `<td>${esc(v)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(r.title)}</title><style>
    *{box-sizing:border-box}body{font:13px/1.45 -apple-system,Segoe UI,Inter,Arial,sans-serif;color:#0B1220;margin:32px}
    header{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:3px solid #0C65C4;padding-bottom:12px}
    .logo{font-weight:800;font-size:20px;color:#0C65C4;letter-spacing:-.5px}h1{font-size:22px;margin:16px 0 2px}.sub{color:#5B6475}
    .kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:18px 0}.k{border:1px solid #E3E8F0;border-radius:10px;padding:10px 12px}
    .k b{display:block;font-size:17px}.k span{color:#5B6475;font-size:11px}h2{font-size:15px;margin:22px 0 8px}
    table{width:100%;border-collapse:collapse;font-size:11.5px}th{text-align:left;background:#F1F5FB;color:#334155;font-weight:600}
    th,td{padding:6px 8px;border-bottom:1px solid #E8EDF4}tr{page-break-inside:avoid}footer{margin-top:24px;color:#8A93A3;font-size:11px}
    @page{margin:14mm}</style></head><body>
    <header><div class="logo">TAPP</div><div class="sub">Laporan campaign · ${esc(new Date().toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }))}</div></header>
    <h1>${esc(r.title)}</h1><div class="sub">${esc(r.subtitle)}</div>
    <div class="kpis">${r.kpis.map(([l, v]) => `<div class="k"><b>${esc(v)}</b><span>${esc(l)}</span></div>`).join('')}</div>
    ${r.tables.filter((t) => t.rows.length).map(table).join('')}
    <footer>Hanya views yang lolos verifikasi yang ditagih. tappcreators.com</footer>
    <script>window.onload=()=>setTimeout(()=>window.print(),300)</script></body></html>`);
  w.document.close();
}

const styles = StyleSheet.create({
  hero: { marginTop: space.xl, borderRadius: radius.xl, padding: space.xl, gap: space.md, overflow: 'hidden' },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  heroLabel: { ...type.caption, color: 'rgba(255,255,255,0.82)' },
  heroMark: { width: 26, height: 26 },
  heroAmount: { ...type.display, fontSize: 38, lineHeight: 44, color: '#FFFFFF', fontVariant: ['tabular-nums'] },
  heroSkeleton: { height: 44, width: '60%', borderRadius: radius.sm, backgroundColor: 'rgba(255,255,255,0.12)' },
  heroTrack: { height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.18)', overflow: 'hidden' },
  heroFill: { height: 6, borderRadius: 3, backgroundColor: '#FFFFFF' },
  heroRow: { flexDirection: 'row', justifyContent: 'space-between', gap: space.md },
  heroCap: { ...type.caption, fontSize: 12, color: 'rgba(255,255,255,0.8)', fontVariant: ['tabular-nums'] },
  heroBtns: { flexDirection: 'row', gap: space.sm, marginTop: space.xs },
  heroBtn: { flex: 1, height: 46, borderRadius: radius.pill, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  heroBtnSolid: { backgroundColor: '#FFFFFF' },
  heroBtnSolidText: { ...type.label, color: '#0A2A4D' },
  heroBtnGlass: { backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)' },
  heroBtnGlassText: { ...type.label, color: '#FFFFFF' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.lg },
  kpi: { flexGrow: 1, flexBasis: '22%', minWidth: 150, padding: space.lg, gap: 4, ...card, borderRadius: radius.lg },
  kpiIcon: { width: 30, height: 30, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginBottom: space.xs },
  kpiValue: { ...type.metric, fontSize: 22, lineHeight: 28, letterSpacing: -0.5, color: color.text },
  kpiLabel: { ...type.caption, color: color.textMuted },
  kpiNote: { ...type.caption, fontSize: 11, color: color.success },
  tag: { marginTop: space.sm, flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg, ...card, borderRadius: radius.lg,
    borderWidth: 1, borderColor: 'rgba(255,77,141,0.22)' },
  tagIcon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,77,141,0.12)' },
  tagValue: { ...type.metric, fontSize: 24, lineHeight: 30, letterSpacing: -0.5, color: color.text },
  sub: { marginTop: space.sm, padding: space.lg, gap: 6, ...card, borderRadius: radius.lg, borderWidth: 1, borderColor: 'rgba(117,178,244,0.22)' },
  subHead: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginBottom: 2 },
  subIcon: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: color.accentSoft },
  subOf: { ...type.caption, fontSize: 14, color: color.textMuted },
  subTrack: { height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.08)', overflow: 'hidden' },
  subFill: { height: 6, borderRadius: 3, backgroundColor: color.blueLight },
  plans: { marginTop: space.sm, padding: space.lg, gap: space.md, ...card, borderRadius: radius.lg, borderWidth: 1, borderColor: 'rgba(117,178,244,0.22)' },
  plansTitle: { ...type.heading, fontSize: 17, color: color.text },
  planRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  plan: { flexGrow: 1, flexBasis: '30%', minWidth: 150, padding: space.md, gap: 2, borderRadius: radius.md, borderWidth: 1, borderColor: color.border, backgroundColor: 'rgba(255,255,255,0.02)' },
  planHot: { borderColor: 'rgba(117,178,244,0.45)', backgroundColor: 'rgba(12,101,196,0.10)' },
  planBadge: { ...type.caption, fontSize: 10, letterSpacing: 1, color: '#F5C451', position: 'absolute', top: space.md, right: space.md },
  planName: { ...type.label, color: color.textSecondary },
  planViews: { ...type.metric, fontSize: 26, lineHeight: 32, letterSpacing: -0.5, color: color.text },
  planPrice: { ...type.label, color: color.text, marginTop: space.xs },
  planCta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: space.xs },
  planCtaText: { ...type.caption, color: color.link, fontFamily: type.label.fontFamily },
  section: { marginTop: space.xxl, gap: space.md },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space.md },
  sectionTitle: { ...type.heading, color: color.text },
});
