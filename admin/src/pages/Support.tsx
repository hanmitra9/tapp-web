import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { listTickets, replyTicket, type AdminTicket, type TicketStatus } from '../lib/api';
import { adminError } from '../lib/errors';
import { dt } from '../lib/format';
import { useLoad } from '../lib/useLoad';

const TABS: { key: string; label: string; statuses: TicketStatus[] }[] = [
  { key: 'open', label: 'Perlu dibalas', statuses: ['open', 'pending'] }, { key: 'closed', label: 'Selesai', statuses: ['resolved', 'closed'] },
];
const CAT: Record<string, string> = { account: 'Akun', campaign: 'Campaign', submission: 'Submission', earnings: 'Penghasilan', payout: 'Pencairan', other: 'Lainnya' };

export function Support() {
  const { refreshCounts } = useOutletContext<{ refreshCounts: () => void }>();
  const [tab, setTab] = useState(TABS[0]!);
  const [sel, setSel] = useState<string | null>(null);
  const list = useLoad(() => listTickets(tab.statuses), [tab.key]);
  useEffect(() => setSel(null), [tab.key]);
  const t = list.data?.find((x) => x.id === sel) ?? null;
  return (
    <>
      <div className="page-head"><div><h1>Support</h1><p className="sub">Pertanyaan kreator. Balasan dikirim sebagai notifikasi dan terlihat di halaman Bantuan aplikasi.</p></div></div>
      <div className="tabs">{TABS.map((x) => <button key={x.key} className={`tab ${tab.key === x.key ? 'on' : ''}`} onClick={() => setTab(x)}>{x.label}</button>)}</div>
      <div className="split">
        <div className="list">
          {list.error ? <div className="notice error" style={{ margin: 12 }}>{list.error}</div> : null}
          {list.data && !list.data.length ? <div className="empty">Tidak ada tiket.</div> : null}
          {list.data?.map((x) => (
            <button key={x.id} className={`list-item ${sel === x.id ? 'on' : ''}`} onClick={() => setSel(x.id)}>
              <div className="row"><span className="title">{x.subject}</span><span className="badge">{CAT[x.category] ?? x.category}</span></div>
              <div className="meta">@{x.user_username} · {dt(x.created_at)}{x.admin_reply ? ' · sudah dibalas' : ''}</div>
            </button>
          ))}
        </div>
        <div className="detail">{t ? <Ticket key={t.id + t.status} t={t} onDone={async () => { await list.reload(); refreshCounts(); }} /> : <div className="empty">Pilih tiket dari daftar.</div>}</div>
      </div>
    </>
  );
}

function Ticket({ t, onDone }: { t: AdminTicket; onDone: () => Promise<void> }) {
  const [reply, setReply] = useState('');
  const [status, setStatus] = useState<TicketStatus>('resolved');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function send() {
    if (!reply.trim() && status === t.status) return setError('Tulis balasan atau ubah status.');
    setBusy(true); setError(null);
    try { await replyTicket(t.id, reply.trim(), status); setReply(''); await onDone(); } catch (e) { setError(adminError(e)); } finally { setBusy(false); }
  }
  return (
    <>
      <h2>{t.subject}</h2>
      <p className="sub">{t.user_name} · @{t.user_username} · {CAT[t.category]} · {dt(t.created_at)}</p>
      <div className="section card"><p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{t.body}</p></div>
      {t.admin_reply ? <div className="section notice info">Balasan terakhir ({dt(t.replied_at)}): {t.admin_reply}</div> : null}
      <div className="section card">
        <label className="field">Balasan<textarea rows={4} value={reply} onChange={(e) => setReply(e.target.value)} /></label>
        <label className="field">Status setelah dibalas<select value={status} onChange={(e) => setStatus(e.target.value as TicketStatus)}>
          <option value="pending">Menunggu kreator</option><option value="resolved">Selesai</option><option value="closed">Ditutup</option><option value="open">Terbuka</option></select></label>
        {error ? <div className="notice error">{error}</div> : null}
        <div className="actions"><button className="btn" disabled={busy} onClick={send}>{busy ? 'Mengirim…' : 'Kirim'}</button></div>
      </div>
    </>
  );
}
