import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useOutletContext, useSearchParams } from 'react-router-dom';
import {
  fetchHistory, getSubmission, listSubmissions, proofUrl, qualifyViews, recordMetrics, reviewSubmission,
  type AdminSubmission, type Queue, type SubStatus,
} from '../lib/api';
import { previewEarnings, signals } from '../lib/engine';
import { adminError } from '../lib/errors';
import { ago, dt, idr, num, pct, toLocalInput } from '../lib/format';
import { useLoad } from '../lib/useLoad';

const STATUS: Record<SubStatus, { label: string; tone: string }> = {
  pending_review: { label: 'Menunggu review', tone: '' }, needs_changes: { label: 'Perlu revisi', tone: 'warning' },
  approved: { label: 'Disetujui', tone: 'blue' }, tracking: { label: 'Dilacak', tone: 'blue' }, flagged: { label: 'Ditandai', tone: 'warning' },
  rejected: { label: 'Ditolak', tone: 'danger' }, completed: { label: 'Selesai', tone: 'success' },
};
const TABS: Record<'review' | 'performance', { q: Queue; label: string }[]> = {
  review: [{ q: 'review', label: 'Perlu review' }, { q: 'flagged', label: 'Ditandai' }, { q: 'closed', label: 'Selesai diproses' }],
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
          <h1>{mode === 'review' ? 'Verifikasi submission' : 'Performa & qualified views'}</h1>
          <p className="sub">{mode === 'review'
            ? 'Cek postingan terhadap brief. Setiap keputusan non-setuju wajib punya alasan yang dilihat kreator.'
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
              {mode === 'performance' ? <div className="meta">Raw {num(s.views)} · Qualified {num(s.qualified_views)} · metrik {ago(s.last_metrics_at)}</div> : null}
              {mode === 'performance' && s.auto_hold_reason ? <div className="meta" style={{ color: 'var(--warning)' }}>Ditahan: {s.auto_hold_reason}</div> : null}
            </button>
          ))}
        </div>
        <div className="detail">
          {selected ? <Detail key={selected} id={selected} mode={mode} onChanged={after} /> : <div className="empty">Pilih submission di kiri.</div>}
        </div>
      </div>
    </>
  );
}

function Detail({ id, mode, onChanged }: { id: string; mode: 'review' | 'performance'; onChanged: () => Promise<void> }) {
  const d = useLoad(async () => {
    const [s, h] = await Promise.all([getSubmission(id), fetchHistory(id)]);
    return { s, h };
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
      {s.caption ? <div className="section"><h3>Caption</h3><p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{s.caption}</p></div> : null}
      {shot ? <div className="section"><h3>Screenshot</h3><a href={shot} target="_blank" rel="noreferrer noopener"><img src={shot} alt="Screenshot bukti" className="shot" /></a></div> : null}

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
            onClick={() => { setDecision(o.d); setError(null); }}>{o.label}</button>
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

function MetricsPanel({ s, onDone }: { s: AdminSubmission; onDone: () => Promise<void> }) {
  const [f, setF] = useState({ views: '', likes: '', comments: '', shares: '', saves: '', capturedAt: toLocalInput(), state: 'live' });
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
      await recordMetrics(s.id, { views: toInt(f.views), likes: toInt(f.likes), comments: toInt(f.comments), shares: toInt(f.shares), saves: toInt(f.saves),
        capturedAt: new Date(f.capturedAt).toISOString(), state: f.state });
      setOk(f.state === 'live' ? 'Metrik tersimpan.' : 'Metrik tersimpan. Submission otomatis ditandai karena postingan tidak publik.');
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
      <h2>Catat raw metrics</h2>
      <p className="sub" style={{ margin: 0 }}>Salin angka dari postingan <a href={s.post_url} target="_blank" rel="noreferrer noopener">↗</a>. Data mentah tidak pernah ditimpa; setiap input jadi snapshot baru.</p>
      <div className="grid3">{input('views', 'Views *')}{input('likes', 'Likes')}{input('comments', 'Komentar')}{input('shares', 'Share')}{input('saves', 'Save')}
        <label className="field">Diambil pada<input type="datetime-local" value={f.capturedAt} max={toLocalInput()} onChange={(e) => setF({ ...f, capturedAt: e.target.value })} /></label>
      </div>
      <label className="field">Status postingan
        <select value={f.state} onChange={(e) => setF({ ...f, state: e.target.value })}>
          <option value="live">Publik</option><option value="private">Diprivat</option><option value="deleted">Dihapus</option><option value="unknown">Tidak bisa dicek</option>
        </select>
      </label>
      {error ? <div className="notice error">{error}</div> : null}
      {ok ? <div className="notice ok">{ok}</div> : null}
      <div className="actions"><button className="btn" onClick={save} disabled={busy}>{busy ? 'Menyimpan…' : 'Simpan metrik'}</button></div>
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
