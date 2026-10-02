import { useEffect, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { listDisputes, resolveDispute, type AdminDispute, type DisputeStatus } from '../lib/api';
import { adminError } from '../lib/errors';
import { dt, idr } from '../lib/format';
import { useLoad } from '../lib/useLoad';

const TABS: { key: string; label: string; statuses: DisputeStatus[] }[] = [
  { key: 'open', label: 'Terbuka', statuses: ['open', 'under_review'] }, { key: 'closed', label: 'Selesai', statuses: ['resolved', 'rejected'] },
];
const LABEL: Record<DisputeStatus, { t: string; tone: string }> = {
  open: { t: 'Baru', tone: 'warning' }, under_review: { t: 'Ditinjau', tone: 'blue' }, resolved: { t: 'Diterima', tone: 'success' }, rejected: { t: 'Ditolak', tone: 'danger' },
};

export function Disputes() {
  const { refreshCounts } = useOutletContext<{ refreshCounts: () => void }>();
  const [tab, setTab] = useState(TABS[0]!);
  const [sel, setSel] = useState<string | null>(null);
  const list = useLoad(() => listDisputes(tab.statuses), [tab.key]);
  useEffect(() => setSel(null), [tab.key]);
  const d = list.data?.find((x) => x.id === sel) ?? null;
  return (
    <>
      <div className="page-head"><div><h1>Keberatan</h1><p className="sub">Keberatan kreator atas submission yang ditolak/ditandai atau pencairan yang ditolak.</p></div></div>
      <div className="tabs">{TABS.map((t) => <button key={t.key} className={`tab ${tab.key === t.key ? 'on' : ''}`} onClick={() => setTab(t)}>{t.label}</button>)}</div>
      <div className="split">
        <div className="list">
          {list.error ? <div className="notice error" style={{ margin: 12 }}>{list.error}</div> : null}
          {list.data && !list.data.length ? <div className="empty">Tidak ada keberatan.</div> : null}
          {list.data?.map((x) => (
            <button key={x.id} className={`list-item ${sel === x.id ? 'on' : ''}`} onClick={() => setSel(x.id)}>
              <div className="row"><span className="title">{x.submission_id ? `Submission · ${x.submission_campaign ?? ''}` : `Pencairan ${x.payout_amount != null ? idr(x.payout_amount) : ''}`}</span>
                <span className={`badge ${LABEL[x.status].tone}`}>{LABEL[x.status].t}</span></div>
              <div className="meta">@{x.raiser_username} · {dt(x.created_at)}</div>
            </button>
          ))}
        </div>
        <div className="detail">{d ? <Detail key={d.id + d.status} d={d} onDone={async () => { await list.reload(); refreshCounts(); }} /> : <div className="empty">Pilih keberatan dari daftar.</div>}</div>
      </div>
    </>
  );
}

function Detail({ d, onDone }: { d: AdminDispute; onDone: () => Promise<void> }) {
  const [to, setTo] = useState<DisputeStatus | null>(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const moves: { to: DisputeStatus; label: string; cls: string }[] = d.status === 'open'
    ? [{ to: 'under_review', label: 'Mulai tinjau', cls: 'secondary' }, { to: 'resolved', label: 'Terima', cls: '' }, { to: 'rejected', label: 'Tolak', cls: 'danger' }]
    : d.status === 'under_review' ? [{ to: 'resolved', label: 'Terima', cls: '' }, { to: 'rejected', label: 'Tolak', cls: 'danger' }] : [];
  async function confirm() {
    if (!to) return;
    if (to !== 'under_review' && !text.trim()) return setError('Tulis keputusan — kreator akan melihatnya.');
    setBusy(true); setError(null);
    try { await resolveDispute(d.id, to, text.trim() || null); await onDone(); } catch (e) { setError(adminError(e)); } finally { setBusy(false); }
  }
  return (
    <>
      <h2>{d.raiser_name} <span className="sub">@{d.raiser_username}</span></h2>
      <p className="sub">Diajukan {dt(d.created_at)}</p>
      <div className="section card"><h3>Alasan kreator</h3><p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{d.reason}</p></div>
      {d.submission_id ? (
        <div className="section">
          <h3>Submission</h3>
          <dl className="kv">
            <div><dt>Campaign</dt><dd>{d.submission_campaign}</dd></div>
            <div><dt>Status</dt><dd>{d.submission_status}</dd></div>
            <div><dt>Postingan</dt><dd>{d.post_url ? <a href={d.post_url} target="_blank" rel="noreferrer noopener">Buka ↗</a> : '—'}</dd></div>
          </dl>
          {d.submission_reason ? <div className="notice warn">Alasan review: {d.submission_reason}</div> : null}
          <p className="sub" style={{ margin: 0 }}>Kalau keberatan diterima, ubah status submission di <Link to="/submissions?q=flagged">Verifikasi</Link> (atau hitung ulang di Performa).</p>
        </div>
      ) : null}
      {d.payout_request_id ? (
        <div className="section">
          <h3>Pencairan</h3>
          <dl className="kv"><div><dt>Jumlah</dt><dd>{d.payout_amount != null ? idr(d.payout_amount) : '—'}</dd></div><div><dt>Status</dt><dd>{d.payout_status}</dd></div></dl>
          {d.payout_reason ? <div className="notice warn">Alasan penolakan: {d.payout_reason}</div> : null}
          <p className="sub" style={{ margin: 0 }}>Saldo dari pencairan yang ditolak sudah kembali ke kreator; kreator bisa mengajukan ulang setelah masalahnya beres.</p>
        </div>
      ) : null}
      {d.resolution ? <div className="section notice info">Keputusan: {d.resolution}</div> : null}
      {moves.length ? (
        <div className="section card">
          <h2>Keputusan</h2>
          <div className="actions">{moves.map((m) => <button key={m.to} className={`btn ${m.cls}`} style={to === m.to ? { outline: '2px solid var(--blue)' } : undefined} onClick={() => { setTo(m.to); setError(null); }}>{m.label}</button>)}</div>
          {to ? <label className="field">Pesan ke kreator{to === 'under_review' ? ' (opsional)' : ''}<textarea value={text} onChange={(e) => setText(e.target.value)} /></label> : null}
          {error ? <div className="notice error">{error}</div> : null}
          {to ? <div className="actions"><button className="btn" disabled={busy} onClick={confirm}>{busy ? 'Menyimpan…' : 'Konfirmasi'}</button><button className="btn secondary" onClick={() => setTo(null)}>Batal</button></div> : null}
        </div>
      ) : null}
    </>
  );
}
