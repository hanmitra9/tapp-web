import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useOutletContext, useSearchParams } from 'react-router-dom';
import {
  fetchBonusPct, fetchChecks, fetchFeePct, fetchHistory, runCheck, type SubmissionCheck, fetchPaid, fetchPayTo, getSubmission, listSubmissions, paySubmission, proofUrl, readPublicViews, type PublicViews, qualifyViews, recordMetrics, reviewSubmission,
  type AdminSubmission, type Queue, type SubStatus,
} from '../lib/api';
import { previewEarnings, signals } from '../lib/engine';
import { adminError } from '../lib/errors';
import { ago, dt, idr, num, pct, toLocalInput } from '../lib/format';
import { useLoad } from '../lib/useLoad';

const STATUS: Record<SubStatus, { label: string; tone: string }> = {
  pending_review: { label: 'Menunggu review', tone: '' }, needs_changes: { label: 'Perlu revisi', tone: 'warning' },
  approved: { label: 'Diterima', tone: 'blue' }, tracking: { label: 'Diterima', tone: 'blue' }, flagged: { label: 'Ditandai', tone: 'warning' },
  rejected: { label: 'Ditolak', tone: 'danger' }, completed: { label: 'Dibayar', tone: 'success' },
};
const TABS: Record<'review' | 'performance', { q: Queue; label: string }[]> = {
  review: [{ q: 'review', label: 'Perlu review' }, { q: 'payable', label: 'Siap dibayar' }, { q: 'paid', label: 'Sudah dibayar' }, { q: 'flagged', label: 'Ditandai' }, { q: 'closed', label: 'Ditolak / revisi' }],
  performance: [{ q: 'held', label: 'Ditahan otomatis' }, { q: 'metrics', label: 'Belum ada metrik' }, { q: 'tracking', label: 'Dilacak' }, { q: 'flagged', label: 'Ditandai' }],
};
const PRESETS: Partial<Record<SubStatus, string[]>> = {
  rejected: [
    'Konten tidak sesuai format yang diminta campaign.', 'Postingan dipublikasikan sebelum kreator bergabung.',
    'Diposting dari akun yang tidak terhubung ke TAPP.', 'Konten melanggar panduan brand.', 'Terindikasi reupload atau bukan konten milik kreator.',
  ],
  needs_changes: [
    'Tambahkan tag atau mention brand di caption.', 'Tambahkan hashtag wajib campaign.', 'Durasi klip tidak sesuai syarat.', 'Caption tidak sesuai brief.',
  ],
  flagged: ['Views atau engagement mencurigakan, perlu dicek ulang.', 'Postingan tidak bisa diakses publik.'],
};

type Ctx = { refreshCounts: () => void };

export function Submissions({ mode }: { mode: 'review' | 'performance' }) {
  const { refreshCounts } = useOutletContext<Ctx>();
  const [params, setParams] = useSearchParams();
  const tabs = TABS[mode];
  const queue = (tabs.find((t) => t.q === params.get('q'))?.q ?? tabs[0]!.q) as Queue;
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const list = useLoad(() => listSubmissions(queue, search), [queue, search]);

  useEffect(() => { setSelected(null); }, [queue, mode]);
  const after = async () => { await list.reload(); refreshCounts(); };

  return (
    <>
      <div className="page-head">
        <div>
          <h1>{mode === 'review' ? 'Submission' : 'Performa & qualified views'}</h1>
          <p className="sub">{mode === 'review'
            ? 'Terima atau tolak klip kreator, lalu bayar klip yang diterima langsung ke rekening kreator. Penolakan wajib punya alasan yang dilihat kreator.'
            : 'Catat raw metrics, lalu tetapkan qualified views. Penghasilan dihitung di server.'}</p>
        </div>
        <input type="search" placeholder="Cari campaign, username, link…" value={search} onChange={(e) => setSearch(e.target.value)} style={{ maxWidth: 280 }} />
      </div>
      <div className="tabs" role="tablist">
        {tabs.map((t) => (
          <button key={t.q} role="tab" aria-selected={queue === t.q} className={`tab ${queue === t.q ? 'on' : ''}`}
            onClick={() => setParams({ q: t.q })}>{t.label}{queue === t.q && list.data ? <span className="count">{list.data.length}</span> : null}</button>
        ))}
      </div>
      <div className="split">
        <div className="list">
          {list.error ? <div className="notice error" style={{ margin: 12 }}>{list.error}</div> : null}
          {list.data && !list.data.length ? <div className="empty">Tidak ada submission di antrian ini.</div> : null}
          {list.data?.map((s) => (
            <button key={s.id} className={`list-item ${selected === s.id ? 'on' : ''}`} onClick={() => setSelected(s.id)}>
              <div className="row"><span className="title">{s.campaign_title}</span><span className={`badge ${STATUS[s.status].tone}`}>{STATUS[s.status].label}</span></div>
              <div className="meta">@{s.creator_username ?? '—'} · {s.platform} · masuk {ago(s.created_at)}</div>
              {mode === 'review' && s.check ? <CheckLine c={s.check} /> : null}
              {s.status === 'completed' ? <div className="meta">Dibayar {idr(s.earned)} · {num(s.qualified_views)} views</div> : null}
              {mode === 'performance' ? <div className="meta">Raw {num(s.views)} · Qualified {num(s.qualified_views)} · metrik {ago(s.last_metrics_at)}</div> : null}
              {mode === 'performance' && s.auto_hold_reason ? <div className="meta" style={{ color: 'var(--warning)' }}>Ditahan: {s.auto_hold_reason}</div> : null}
            </button>
          ))}
        </div>
        <div className="detail">
          {selected ? <Detail key={selected} id={selected} mode={mode} onChanged={after} /> : <div className="empty">Pilih submission dari daftar.</div>}
        </div>
      </div>
    </>
  );
}

function Detail({ id, mode, onChanged }: { id: string; mode: 'review' | 'performance'; onChanged: () => Promise<void> }) {
  const d = useLoad(async () => {
    const [s, h, checks] = await Promise.all([getSubmission(id), fetchHistory(id), fetchChecks([id])]);
    return { s, h, check: checks[id] ?? null };
  }, [id]);
  const [shot, setShot] = useState<string | null>(null);
  useEffect(() => {
    setShot(null);
    if (d.data?.s.screenshot_path) proofUrl(d.data.s.screenshot_path).then(setShot).catch(() => setShot(null));
  }, [d.data?.s.screenshot_path]);

  if (d.error) return <div className="notice error">{d.error}</div>;
  if (!d.data) return <div className="sub">Memuat…</div>;
  const { s, h } = d.data;
  const refresh = async () => { await d.reload(); await onChanged(); };
  const trackable = ['approved', 'tracking', 'flagged'].includes(s.status);
  const reviewable = ['pending_review', 'flagged', 'approved', 'tracking'].includes(s.status);

  return (
    <>
      <div className="row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        <div>
          <h2>{s.campaign_title}</h2>
          <p className="sub">{s.brand_name} · CPM {idr(s.cpm)} · min {num(s.min_views_to_qualify)} views</p>
        </div>
        <span className={`badge ${STATUS[s.status].tone}`}>{STATUS[s.status].label}</span>
      </div>
      {s.review_reason ? <div className="notice warn" style={{ marginTop: 12 }}>Catatan: {s.review_reason}</div> : null}
      {s.content_state === 'deleted' || s.content_state === 'private'
        ? <div className="notice error" style={{ marginTop: 12 }}>Postingan terdeteksi {s.content_state === 'deleted' ? 'dihapus' : 'diprivat'}.</div> : null}

      <dl className="kv" style={{ marginTop: 16 }}>
        <KV k="Kreator" v={<>{s.creator_name ?? '—'} · @{s.creator_username}<br /><span className="sub">{s.creator_status} · {s.creator_tier} · {s.creator_approved} disetujui / {s.creator_rejected} ditolak</span></>} />
        <KV k="Akun" v={<>{s.platform} @{s.account_handle ?? '—'}{s.account_followers != null ? <><br /><span className="sub">{num(s.account_followers)} followers</span></> : null}</>} />
        <KV k="Postingan" v={<a href={s.post_url} target="_blank" rel="noreferrer noopener">Buka postingan ↗</a>} />
        <KV k="Tanggal posting (dilaporkan)" v={dt(s.published_at)} />
        <KV k="Disubmit" v={dt(s.created_at)} />
        <KV k="Deadline campaign" v={dt(s.submission_deadline)} />
      </dl>
      {mode === 'review' ? <CheckPanel id={s.id} initial={d.data.check} /> : null}
      {s.caption ? <div className="section"><h3>Caption</h3><p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{s.caption}</p></div> : null}
      {shot ? <div className="section"><h3>Screenshot</h3><a href={shot} target="_blank" rel="noreferrer noopener"><img src={shot} alt="Screenshot bukti" className="shot" /></a></div> : null}

      {mode === 'review' && ['approved', 'tracking', 'completed'].includes(s.status) ? <PayPanel s={s} latestViews={h.metrics[0]?.views ?? null} onDone={refresh} /> : null}
      {mode === 'review' && reviewable ? <ReviewPanel s={s} onDone={refresh} /> : null}
      {mode === 'performance' && trackable ? <MetricsPanel s={s} onDone={refresh} /> : null}
      {mode === 'performance' && s.status === 'tracking' && s.auto_hold_reason ? <div className="notice warn" style={{ marginTop: 16 }}>Ditahan penyaringan otomatis: {s.auto_hold_reason}. Cek klipnya, lalu tetapkan qualified views secara manual di bawah.</div> : null}
      {mode === 'performance' && s.status === 'tracking' ? <QualifyPanel s={s} metrics={h.metrics} onDone={refresh} /> : null}
      {mode === 'performance' && s.status === 'flagged' ? <div className="notice info" style={{ marginTop: 16 }}>Submission ditandai. Selesaikan di halaman Verifikasi (setujui kembali atau tolak) sebelum menghitung qualified views.</div> : null}

      <div className="section">
        <h3>Riwayat raw metrics ({h.metrics.length})</h3>
        {h.metrics.length ? (
          <>
            {signals(h.metrics, s.account_followers).map((x, i) => <div key={i} className={`notice ${x.level === 'warn' ? 'warn' : 'info'}`}>{x.text}</div>)}
            <table>
              <thead><tr><th>Diambil</th><th className="n">Views</th><th className="n">Likes</th><th className="n">Komentar</th><th className="n">Share</th><th className="n">Save</th><th className="n">Engagement</th></tr></thead>
              <tbody>{h.metrics.map((m) => (
                <tr key={m.id}><td>{dt(m.captured_at)}</td><td className="n">{num(m.views)}</td><td className="n">{num(m.likes)}</td><td className="n">{num(m.comments)}</td>
                  <td className="n">{num(m.shares)}</td><td className="n">{num(m.saves)}</td><td className="n">{m.views ? pct((m.likes + m.comments + m.shares) / m.views) : '—'}</td></tr>
              ))}</tbody>
            </table>
          </>
        ) : <p className="sub" style={{ margin: 0 }}>Belum ada metrik.</p>}
      </div>
      {h.snapshots.length ? (
        <div className="section">
          <h3>Riwayat qualified views</h3>
          <table>
            <thead><tr><th>Waktu</th><th className="n">Raw</th><th className="n">Qualified</th><th className="n">Sebelumnya</th><th>Catatan</th></tr></thead>
            <tbody>{h.snapshots.map((x) => (
              <tr key={x.id}><td>{dt(x.created_at)}</td><td className="n">{num(x.raw_views)}</td><td className="n">{num(x.qualified_views)}</td>
                <td className="n">{num(x.previous_qualified_views)}</td><td>{x.computed_by ? '' : <span className="badge" style={{ marginRight: 6 }}>Otomatis</span>}{x.budget_capped ? 'Dibatasi budget. ' : ''}{x.note ?? ''}</td></tr>
            ))}</tbody>
          </table>
        </div>
      ) : null}
    </>
  );
}

function KV({ k, v }: { k: string; v: ReactNode }) { return <div><dt>{k}</dt><dd>{v}</dd></div>; }

const CHECK: Record<SubmissionCheck['status'], { label: string; tone: string }> = {
  ok: { label: 'Akun cocok', tone: 'success' }, not_owner: { label: 'Bukan akun kreator', tone: 'danger' },
  not_found: { label: 'Postingan tidak ditemukan', tone: 'danger' }, unreadable: { label: 'Cek manual', tone: 'warning' },
};
function CheckLine({ c }: { c: SubmissionCheck }) {
  return <div className="meta"><span className={`badge ${CHECK[c.status].tone}`}>{CHECK[c.status].label}</span>{c.views != null ? ` · ${num(c.views)} views` : ''}</div>;
}
// Result of the automatic check made when the creator submitted the link, with a re-check.
function CheckPanel({ id, initial }: { id: string; initial: SubmissionCheck | null }) {
  const [c, setC] = useState(initial);
  const [busy, setBusy] = useState(false);
  const again = async () => { setBusy(true); const r = await runCheck(id); if (r) setC(r); setBusy(false); };
  return (
    <div className="section">
      <h3>Cek otomatis link</h3>
      {c ? (
        <>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <span className={`badge ${CHECK[c.status].tone}`}>{CHECK[c.status].label}</span>
            {c.author ? <span>@{c.author}</span> : null}
            {c.views != null ? <span>· {num(c.views)} views</span> : null}
            {c.likes != null ? <span>· {num(c.likes)} likes</span> : null}
            <span className="sub">· dicek {ago(c.checked_at)}</span>
          </div>
          {c.note ? <p className="sub" style={{ margin: '6px 0 0' }}>{c.note}</p> : null}
        </>
      ) : <p className="sub" style={{ margin: 0 }}>Belum dicek.</p>}
      <button className="btn secondary" style={{ marginTop: 10 }} onClick={again} disabled={busy}>{busy ? 'Mengecek…' : c ? 'Cek ulang' : 'Cek sekarang'}</button>
    </div>
  );
}

function ReviewPanel({ s, onDone }: { s: AdminSubmission; onDone: () => Promise<void> }) {
  const options: { d: SubStatus; label: string; cls: string }[] = s.status === 'approved' || s.status === 'tracking'
    ? [{ d: 'flagged', label: 'Tandai', cls: 'warn' }, { d: 'rejected', label: 'Tolak', cls: 'danger' }]
    : [
        { d: 'approved', label: 'Setujui', cls: '' }, { d: 'needs_changes', label: 'Minta revisi', cls: 'secondary' },
        { d: 'rejected', label: 'Tolak', cls: 'danger' }, ...(s.status === 'pending_review' ? [{ d: 'flagged' as SubStatus, label: 'Tandai', cls: 'warn' }] : []),
      ];
  const [decision, setDecision] = useState<SubStatus | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const needsReason = decision && decision !== 'approved';

  // Approving needs no reason: one click. Other decisions are explained to the creator, so they ask for one.
  async function approveNow() {
    setBusy(true); setError(null);
    try { await reviewSubmission(s.id, 'approved', null); setDecision(null); setReason(''); await onDone(); }
    catch (e) { setError(adminError(e)); }
    finally { setBusy(false); }
  }

  async function confirm() {
    if (!decision) return;
    if (needsReason && !reason.trim()) return setError('Alasan wajib diisi — kreator akan melihatnya.');
    setBusy(true); setError(null);
    try { await reviewSubmission(s.id, decision, needsReason ? reason.trim() : null); setDecision(null); setReason(''); await onDone(); }
    catch (e) { setError(adminError(e)); }
    finally { setBusy(false); }
  }

  return (
    <div className="section card">
      <h2>Keputusan review</h2>
      <div className="actions">
        {options.map((o) => (
          <button key={o.d} className={`btn ${o.cls}`} aria-pressed={decision === o.d} style={decision === o.d ? { outline: '2px solid var(--blue)' } : undefined}
            onClick={() => (o.d === 'approved' ? approveNow() : (setDecision(o.d), setError(null)))} disabled={busy}>{o.label}</button>
        ))}
      </div>
      {decision && PRESETS[decision] ? (
        <div className="presets">{PRESETS[decision]!.map((p) => <button key={p} className="preset" onClick={() => setReason(p)}>{p}</button>)}</div>
      ) : null}
      {needsReason ? <label className="field">Alasan (dilihat kreator)<textarea value={reason} onChange={(e) => setReason(e.target.value)} /></label> : null}
      {error ? <div className="notice error">{error}</div> : null}
      {decision ? (
        <div className="actions">
          <button className="btn" onClick={confirm} disabled={busy}>{busy ? 'Menyimpan…' : `Konfirmasi: ${STATUS[decision].label}`}</button>
          <button className="btn secondary" onClick={() => setDecision(null)}>Batal</button>
        </div>
      ) : null}
    </div>
  );
}

// Accepted clip → pay it: views in, amount computed (CPM, minimum, cap, budget), level fee off, transferred by hand.
function PayPanel({ s, latestViews, onDone }: { s: AdminSubmission; latestViews: number | null; onDone: () => Promise<void> }) {
  const info = useLoad(async () => {
    const [to, pct, bonusPct, paid] = await Promise.all([fetchPayTo(s.creator_id), fetchFeePct(s.creator_tier), fetchBonusPct(s.creator_tier), fetchPaid(s.id)]);
    return { to, pct, bonusPct, paid };
  }, [s.id]);
  const [views, setViews] = useState(String(Math.max(latestViews ?? 0, s.qualified_views) || ''));
  // Read the post's public view count once and prefill it; the admin still checks it before paying.
  const [auto, setAuto] = useState<PublicViews | 'loading' | null>(null);
  const readAuto = async () => {
    setAuto('loading');
    const r = await readPublicViews(s.id);
    setAuto(r);
    if ('views' in r && r.views >= s.qualified_views) setViews(String(r.views));
  };
  useEffect(() => { void readAuto(); }, [s.id]);   // eslint-disable-line react-hooks/exhaustive-deps
  const [reference, setReference] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const v = Number(views.replace(/[.,\s]/g, ''));
  const valid = /^\d+$/.test(views.replace(/[.,\s]/g, ''));
  const p = useMemo(() => previewEarnings({
    qualified: valid ? v : 0, minViews: s.min_views_to_qualify, cpm: s.cpm, maxPerSubmission: s.max_earning_per_submission,
    alreadyEarned: s.earned, budget: s.budget, campaignEarned: s.campaign_earned, override: s.budget_override,
  }), [v, valid, s]);
  const paidSoFar = (info.data?.paid ?? []).reduce((a, r) => a + r.amount, 0);
  const amount = Math.max(p.delta, 0) + Math.max(s.earned - paidSoFar, 0);   // new + accepted-but-unpaid
  const fee = info.data ? Math.min(Math.round(amount * info.data.pct / 100), Math.max(amount - 1, 0)) : 0;
  const bonus = info.data ? Math.round(amount * info.data.bonusPct / 100) : 0;   // paid by TAPP, outside the campaign budget
  const transfer = amount + bonus - fee;
  const to = info.data?.to;

  async function pay() {
    setError(null); setOk(null);
    if (!valid) return setError('Isi angka views.');
    if (v < s.qualified_views) return setError(`Views tidak boleh lebih kecil dari yang sudah dibayar (${num(s.qualified_views)}).`);
    if (!reference.trim()) return setError('Isi nomor referensi / bukti transfer.');
    setBusy(true);
    try { await paySubmission(s.id, v, reference.trim(), null); setOk(`Tercatat dibayar. Kreator mendapat notifikasi dan email.`); setReference(''); await info.reload(); await onDone(); }
    catch (e) { setError(adminError(e)); }
    finally { setBusy(false); }
  }
  return (
    <div className="section card">
      <h2>{s.status === 'completed' ? 'Sudah dibayar' : 'Bayar klip ini'}</h2>
      {info.data?.paid.length ? (
        <table><thead><tr><th>Dibayar</th><th className="n">Transfer</th><th>Referensi</th></tr></thead>
          <tbody>{info.data.paid.map((r) => <tr key={r.id}><td>{dt(r.paid_at)}</td><td className="n">{idr(r.net_amount)}</td><td>{r.processed_reference}</td></tr>)}</tbody></table>
      ) : null}
      {s.status === 'completed' ? <p className="sub" style={{ margin: 0 }}>Views naik lagi? Isi views terbaru untuk membayar selisihnya.</p> : null}
      <p className="sub" style={{ margin: 0 }}>Cek views di <a href={s.post_url} target="_blank" rel="noreferrer noopener">postingan ↗</a>. Tarif {idr(s.cpm)} per 1.000 views, minimal {num(s.min_views_to_qualify)} views{s.max_earning_per_submission ? `, maks ${idr(s.max_earning_per_submission)} per klip` : ''}.</p>
      <div className="grid2">
        <label className="field">Views<input inputMode="numeric" value={views} onChange={(e) => setViews(e.target.value)} />
          <span className="sub" style={{ fontWeight: 400 }}>
            {auto === 'loading' ? 'Membaca views dari postingan…'
              : auto && 'views' in auto ? <>Terbaca otomatis: {num(auto.views)} views{auto.likes != null ? ` · ${num(auto.likes)} likes` : ''}. <a href="#" onClick={(e) => { e.preventDefault(); void readAuto(); }}>Baca ulang</a></>
              : auto ? <>Views tidak terbaca otomatis, isi manual dari postingan. <a href="#" onClick={(e) => { e.preventDefault(); void readAuto(); }}>Coba lagi</a></> : null}
          </span></label>
        <label className="field">Referensi transfer<input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="mis. BCA 0210-8823" /></label>
      </div>
      <div className="preview">
        <span>Transfer ke kreator</span>
        <strong>{idr(transfer)}</strong>
        <span className="sub">Bayaran {idr(amount)}{bonus ? ` + bonus level ${s.creator_tier} ${idr(bonus)} (dari TAPP)` : ''}{fee ? ` − fee ${idr(fee)}` : ''}</span>
        {to ? <span>Ke {to.provider} {to.account_number} a.n. {to.account_name}</span>
          : info.data ? <span style={{ color: 'var(--warning)' }}>Kreator belum mengisi rekening / e-wallet.</span> : null}
        {p.belowMin ? <span style={{ color: 'var(--warning)' }}>Di bawah minimum {num(s.min_views_to_qualify)} views, jadi bayarannya 0.</span> : null}
        {p.capped ? <span style={{ color: 'var(--warning)' }}>Dibatasi sisa budget campaign.</span> : null}
      </div>
      {error ? <div className="notice error">{error}</div> : null}
      {ok ? <div className="notice ok">{ok}</div> : null}
      <div className="actions"><button className="btn" onClick={pay} disabled={busy || !valid || amount <= 0 || !to}>{busy ? 'Menyimpan…' : `Tandai sudah ditransfer ${idr(transfer)}`}</button></div>
    </div>
  );
}

function MetricsPanel({ s, onDone }: { s: AdminSubmission; onDone: () => Promise<void> }) {
  const [f, setF] = useState({ views: '', likes: '', comments: '', shares: '', saves: '', capturedAt: toLocalInput(), state: 'live' });
  const [toReport, setToReport] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const toInt = (v: string) => (v.trim() === '' ? 0 : Number(v.replace(/[.,\s]/g, '')));
  const bad = ['views', 'likes', 'comments', 'shares', 'saves'].some((k) => !/^\d*$/.test(f[k as 'views'].replace(/[.,\s]/g, '')));

  async function save() {
    setError(null); setOk(null);
    if (!f.views.trim()) return setError('Views wajib diisi.');
    if (bad) return setError('Isi angka saja.');
    setBusy(true);
    try {
      const views = toInt(f.views);
      const m = await recordMetrics(s.id, { views, likes: toInt(f.likes), comments: toInt(f.comments), shares: toInt(f.shares), saves: toInt(f.saves),
        capturedAt: new Date(f.capturedAt).toISOString(), state: f.state });
      // One step to the brand report: count these views as qualified right away (raw = qualified). Lower than what
      // is already counted means earnings would drop — that stays a deliberate decision in the form below.
      if (toReport && f.state === 'live' && s.status !== 'flagged' && views >= s.qualified_views) {
        await qualifyViews(s.id, m.id, views, 'Input manual', false);
        setOk(`${num(views)} views masuk ke laporan brand. Penghasilan kreator diperbarui.`);
      } else if (toReport && f.state === 'live' && views < s.qualified_views) {
        setOk(`Metrik tersimpan. Views lebih kecil dari yang sudah dihitung (${num(s.qualified_views)}), jadi atur qualified views di bawah.`);
      } else {
        setOk(f.state === 'live' ? 'Metrik tersimpan.' : 'Metrik tersimpan. Submission otomatis ditandai karena postingan tidak publik.');
      }
      setF({ ...f, views: '', likes: '', comments: '', shares: '', saves: '', capturedAt: toLocalInput() });
      await onDone();
    } catch (e) { setError(adminError(e)); }
    finally { setBusy(false); }
  }
  const input = (k: keyof typeof f, label: string) => (
    <label className="field">{label}<input inputMode="numeric" value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} /></label>
  );
  return (
    <div className="section card">
      <h2>Isi views</h2>
      <p className="sub" style={{ margin: 0 }}>Salin angka dari postingan <a href={s.post_url} target="_blank" rel="noreferrer noopener">↗</a>. Data mentah tidak pernah ditimpa; setiap input jadi snapshot baru.</p>
      <div className="grid3">{input('views', 'Views *')}{input('likes', 'Likes')}{input('comments', 'Komentar')}{input('shares', 'Share')}{input('saves', 'Save')}
        <label className="field">Diambil pada<input type="datetime-local" value={f.capturedAt} max={toLocalInput()} onChange={(e) => setF({ ...f, capturedAt: e.target.value })} /></label>
      </div>
      <label className="field">Status postingan
        <select value={f.state} onChange={(e) => setF({ ...f, state: e.target.value })}>
          <option value="live">Publik</option><option value="private">Diprivat</option><option value="deleted">Dihapus</option><option value="unknown">Tidak bisa dicek</option>
        </select>
      </label>
      {f.state === 'live' && s.status !== 'flagged' ? (
        <label className="check"><input type="checkbox" checked={toReport} onChange={(e) => setToReport(e.target.checked)} />Langsung masukkan ke laporan brand (semua views dihitung qualified)</label>
      ) : null}
      {error ? <div className="notice error">{error}</div> : null}
      {ok ? <div className="notice ok">{ok}</div> : null}
      <div className="actions"><button className="btn" onClick={save} disabled={busy}>{busy ? 'Menyimpan…' : toReport && f.state === 'live' && s.status !== 'flagged' ? 'Simpan & masukkan ke laporan' : 'Simpan metrik'}</button></div>
    </div>
  );
}

function QualifyPanel({ s, metrics, onDone }: { s: AdminSubmission; metrics: { id: string; views: number; captured_at: string }[]; onDone: () => Promise<void> }) {
  const [metricId, setMetricId] = useState(metrics[0]?.id ?? '');
  const metric = metrics.find((m) => m.id === metricId);
  const [qualified, setQualified] = useState(String(metrics[0]?.views ?? s.qualified_views));
  const [note, setNote] = useState('');
  const [allowDecrease, setAllowDecrease] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const q = Number(qualified.replace(/[.,\s]/g, ''));
  const valid = /^\d+$/.test(qualified.replace(/[.,\s]/g, ''));
  const decreasing = valid && q < s.qualified_views;
  const p = useMemo(() => previewEarnings({
    qualified: valid ? q : 0, minViews: s.min_views_to_qualify, cpm: s.cpm, maxPerSubmission: s.max_earning_per_submission,
    alreadyEarned: s.earned, budget: s.budget, campaignEarned: s.campaign_earned, override: s.budget_override,
  }), [q, valid, s]);

  if (!metrics.length) return null;
  async function save() {
    setError(null); setOk(null);
    if (!valid) return setError('Isi angka qualified views.');
    if (metric && q > metric.views) return setError('Qualified views melebihi raw views snapshot ini.');
    if (decreasing && (!allowDecrease || !note.trim())) return setError('Penurunan butuh centang "izinkan penurunan" dan alasan.');
    setBusy(true);
    try { await qualifyViews(s.id, metricId, q, note.trim() || null, allowDecrease); setOk('Qualified views disimpan dan penghasilan diperbarui.'); setNote(''); setAllowDecrease(false); await onDone(); }
    catch (e) { setError(adminError(e)); }
    finally { setBusy(false); }
  }
  return (
    <div className="section card">
      <h2>Tetapkan qualified views</h2>
      <div className="grid2">
        <label className="field">Snapshot metrik
          <select value={metricId} onChange={(e) => { setMetricId(e.target.value); const m = metrics.find((x) => x.id === e.target.value); if (m) setQualified(String(m.views)); }}>
            {metrics.map((m) => <option key={m.id} value={m.id}>{dt(m.captured_at)} — {num(m.views)} views</option>)}
          </select>
        </label>
        <label className="field">Qualified views<input inputMode="numeric" value={qualified} onChange={(e) => setQualified(e.target.value)} /></label>
      </div>
      <p className="sub" style={{ margin: 0 }}>Kurangi views dari bot, promosi berbayar, atau lonjakan tidak wajar. Saat ini: {num(s.qualified_views)} qualified, {idr(s.earned)} dibayarkan ke kreator.</p>
      <div className="preview">
        <span>Perubahan penghasilan (perkiraan)</span>
        <strong style={{ color: p.delta < 0 ? 'var(--danger)' : undefined }}>{p.delta >= 0 ? '+' : '−'}{idr(Math.abs(p.delta))}</strong>
        <span className="sub">Total untuk klip ini: {idr(s.earned + p.delta)} · Sisa budget campaign: {idr(Math.max(s.budget - s.campaign_earned, 0))}{s.budget_override ? ' (override aktif)' : ''}</span>
        {p.belowMin ? <span style={{ color: 'var(--warning)' }}>Di bawah minimum {num(s.min_views_to_qualify)} views — penghasilan 0.</span> : null}
        {p.capped ? <span style={{ color: 'var(--warning)' }}>Dibatasi sisa budget. Campaign akan berpindah ke status "Segera berakhir".</span> : null}
        {s.max_earning_per_submission && p.target >= s.max_earning_per_submission ? <span style={{ color: 'var(--warning)' }}>Mencapai batas {idr(s.max_earning_per_submission)} per klip.</span> : null}
      </div>
      {decreasing ? <label className="check"><input type="checkbox" checked={allowDecrease} onChange={(e) => setAllowDecrease(e.target.checked)} />Izinkan penurunan (penghasilan kreator akan dikurangi)</label> : null}
      <label className="field">Catatan {decreasing ? '(wajib)' : '(opsional, tercatat di audit log)'}<textarea value={note} onChange={(e) => setNote(e.target.value)} /></label>
      {error ? <div className="notice error">{error}</div> : null}
      {ok ? <div className="notice ok">{ok}</div> : null}
      <div className="actions"><button className="btn" onClick={save} disabled={busy || !valid}>{busy ? 'Menyimpan…' : 'Simpan qualified views'}</button></div>
    </div>
  );
}
