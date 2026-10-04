import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { listPayouts, payoutEarnings, updatePayout, type AdminPayout, type PayoutStatus } from '../lib/api';
import { adminError } from '../lib/errors';
import { dt, idr, num } from '../lib/format';
import { useLoad } from '../lib/useLoad';

const TABS: { key: string; label: string; statuses: PayoutStatus[] }[] = [
  { key: 'open', label: 'Perlu diproses', statuses: ['requested', 'reviewing', 'approved', 'processing'] },
  { key: 'paid', label: 'Dibayar', statuses: ['paid'] },
  { key: 'rejected', label: 'Ditolak', statuses: ['rejected'] },
];
const LABEL: Record<PayoutStatus, { t: string; tone: string }> = {
  requested: { t: 'Diajukan', tone: '' }, reviewing: { t: 'Ditinjau', tone: '' }, approved: { t: 'Disetujui', tone: 'blue' },
  processing: { t: 'Diproses', tone: 'blue' }, paid: { t: 'Dibayar', tone: 'success' }, rejected: { t: 'Ditolak', tone: 'danger' },
};
// Next actions per status — mirrors admin_update_payout's state machine.
const NEXT: Record<PayoutStatus, { to: PayoutStatus; label: string; cls: string }[]> = {
  requested: [{ to: 'paid', label: 'Tandai sudah ditransfer', cls: '' }, { to: 'rejected', label: 'Tolak', cls: 'danger' }],
  reviewing: [{ to: 'paid', label: 'Tandai sudah ditransfer', cls: '' }, { to: 'rejected', label: 'Tolak', cls: 'danger' }],
  approved: [{ to: 'paid', label: 'Tandai sudah ditransfer', cls: '' }, { to: 'rejected', label: 'Tolak', cls: 'danger' }],
  processing: [{ to: 'paid', label: 'Tandai sudah dibayar', cls: '' }, { to: 'rejected', label: 'Transfer gagal / tolak', cls: 'danger' }],
  paid: [], rejected: [],
};
const PRESETS = ['Nama pemilik rekening tidak sesuai.', 'Nomor rekening atau e-wallet tidak valid.', 'Ada submission yang sedang diperiksa ulang.', 'Terindikasi pelanggaran ketentuan campaign.'];

export function Payouts() {
  const { refreshCounts } = useOutletContext<{ refreshCounts: () => void }>();
  const [tab, setTab] = useState(TABS[0]!);
  const [selected, setSelected] = useState<string | null>(null);
  const list = useLoad(() => listPayouts(tab.statuses), [tab.key]);
  useEffect(() => setSelected(null), [tab.key]);
  const current = list.data?.find((p) => p.id === selected) ?? null;
  const total = (list.data ?? []).reduce((a, p) => a + p.amount, 0);

  return (
    <>
      <div className="page-head">
        <div><h1>Pencairan</h1><p className="sub">Transfer manual ke rekening/e-wallet kreator. Setiap langkah tercatat di audit log dan dikabarkan ke kreator.</p></div>
        {list.data?.length ? <div className="sub">Total di tab ini: <strong>{idr(total)}</strong></div> : null}
      </div>
      <div className="tabs" role="tablist">
        {TABS.map((t) => <button key={t.key} role="tab" aria-selected={tab.key === t.key} className={`tab ${tab.key === t.key ? 'on' : ''}`} onClick={() => setTab(t)}>{t.label}</button>)}
      </div>
      <div className="split">
        <div className="list">
          {list.error ? <div className="notice error" style={{ margin: 12 }}>{list.error}</div> : null}
          {list.data && !list.data.length ? <div className="empty">Tidak ada pencairan di sini.</div> : null}
          {list.data?.map((p) => (
            <button key={p.id} className={`list-item ${selected === p.id ? 'on' : ''}`} onClick={() => setSelected(p.id)}>
              <div className="row"><span className="title">{idr(p.net_amount)}</span><span className={`badge ${LABEL[p.status].tone}`}>{LABEL[p.status].t}</span></div>
              <div className="meta">@{p.creator_username} · {p.payout_method.provider} · {dt(p.created_at)}</div>
              {!p.ledger_matches || p.creator_flagged || p.creator_open_disputes || p.method_changed_recently ? <div className="meta" style={{ color: 'var(--warning)' }}>Perlu dicek</div> : null}
            </button>
          ))}
        </div>
        <div className="detail">
          {current ? <Detail key={current.id + current.status} p={current} onChanged={async () => { await list.reload(); refreshCounts(); }} />
            : <div className="empty">Pilih pencairan dari daftar.</div>}
        </div>
      </div>
    </>
  );
}

function Detail({ p, onChanged }: { p: AdminPayout; onChanged: () => Promise<void> }) {
  const rows = useLoad(() => payoutEarnings(p.id), [p.id]);
  const [action, setAction] = useState<PayoutStatus | null>(null);
  const [reason, setReason] = useState('');
  const [reference, setReference] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function confirm() {
    if (!action) return;
    if (action === 'rejected' && !reason.trim()) return setError('Alasan wajib diisi — kreator akan melihatnya.');
    if (action === 'paid' && !reference.trim()) return setError('Isi nomor referensi transfer dari bank/e-wallet.');
    setBusy(true); setError(null);
    try { await updatePayout(p.id, action, reason.trim() || null, reference.trim() || null); await onChanged(); }
    catch (e) { setError(adminError(e)); }
    finally { setBusy(false); }
  }
  const copy = async () => { await navigator.clipboard.writeText(p.payout_method.account_number); setCopied(true); setTimeout(() => setCopied(false), 1500); };

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
        <div><h2>Transfer {idr(p.net_amount)}</h2><p className="sub">{p.creator_name} · @{p.creator_username} · status kreator {p.creator_status}</p>
          <p className="sub" style={{ margin: 0 }}>Saldo ditarik {idr(p.amount)}{Number(p.bonus) ? ` + bonus level ${p.fee_tier ?? ''} ${idr(Number(p.bonus))}` : ''} − fee {idr(p.fee)} (platform {num(p.fee_pct)}% + transfer)</p></div>
        <span className={`badge ${LABEL[p.status].tone}`}>{LABEL[p.status].t}</span>
      </div>

      {!p.ledger_matches ? <div className="notice error" style={{ marginTop: 12 }}>Jumlah tidak cocok dengan rincian penghasilan. Jangan transfer — laporkan ke tim teknis.</div> : null}
      {p.creator_flagged ? <div className="notice warn" style={{ marginTop: 12 }}>Kreator punya {p.creator_flagged} submission yang ditandai.</div> : null}
      {p.creator_open_disputes ? <div className="notice warn" style={{ marginTop: 12 }}>Kreator punya {p.creator_open_disputes} dispute terbuka.</div> : null}
      {p.method_changed_recently ? <div className="notice warn" style={{ marginTop: 12 }}>Metode pencairan diubah kreator dalam 72 jam sebelum pengajuan. Konfirmasi ke kreator sebelum transfer.</div> : null}
      {p.creator_status !== 'active' ? <div className="notice warn" style={{ marginTop: 12 }}>Akun kreator sedang {p.creator_status}.</div> : null}

      <div className="section card">
        <h3>Tujuan transfer (snapshot saat diajukan)</h3>
        <dl className="kv">
          <div><dt>{p.payout_method.kind === 'bank' ? 'Bank' : 'E-wallet'}</dt><dd>{p.payout_method.provider}</dd></div>
          <div><dt>Atas nama</dt><dd>{p.payout_method.account_name}</dd></div>
          <div><dt>Nomor</dt><dd>{p.payout_method.account_number} <button className="preset" onClick={copy}>{copied ? 'Tersalin' : 'Salin'}</button></dd></div>
          <div><dt>Diajukan</dt><dd>{dt(p.created_at)}</dd></div>
          <div><dt>Total dibayar sebelumnya</dt><dd>{idr(p.creator_paid_total)}</dd></div>
          {p.processed_reference ? <div><dt>Referensi</dt><dd>{p.processed_reference}</dd></div> : null}
        </dl>
        {p.review_reason ? <div className="notice warn">Alasan: {p.review_reason}</div> : null}
      </div>

      <div className="section">
        <h3>Rincian penghasilan ({p.earning_rows} baris)</h3>
        {rows.error ? <div className="notice error">{rows.error}</div> : null}
        <table>
          <thead><tr><th>Tanggal</th><th>Campaign</th><th className="n">Qualified views</th><th className="n">Jumlah</th></tr></thead>
          <tbody>{rows.data?.map((e) => (
            <tr key={e.id}><td>{dt(e.created_at)}</td><td>{e.campaign?.title ?? '—'}</td><td className="n">{num(e.qualified_views_delta)}</td>
              <td className="n" style={{ color: e.amount < 0 ? 'var(--danger)' : undefined }}>{idr(e.amount)}</td></tr>
          ))}</tbody>
        </table>
      </div>

      {NEXT[p.status].length ? (
        <div className="section card">
          <h2>Tindakan</h2>
          <div className="actions">
            {NEXT[p.status].map((a) => (
              <button key={a.to} className={`btn ${a.cls}`} disabled={a.to !== 'rejected' && !p.ledger_matches}
                style={action === a.to ? { outline: '2px solid var(--blue)' } : undefined} onClick={() => { setAction(a.to); setError(null); }}>{a.label}</button>
            ))}
          </div>
          {action === 'rejected' ? (
            <>
              <div className="presets">{PRESETS.map((x) => <button key={x} className="preset" onClick={() => setReason(x)}>{x}</button>)}</div>
              <label className="field">Alasan (dilihat kreator; saldo kembali ke Tersedia)<textarea value={reason} onChange={(e) => setReason(e.target.value)} /></label>
            </>
          ) : null}
          {action === 'paid' ? (
            <label className="field">Nomor referensi transfer<input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="mis. BCA-TRX-88231" /></label>
          ) : null}
          {error ? <div className="notice error">{error}</div> : null}
          {action ? (
            <div className="actions">
              <button className="btn" disabled={busy} onClick={confirm}>{busy ? 'Menyimpan…' : `Konfirmasi: ${LABEL[action].t}`}</button>
              <button className="btn secondary" onClick={() => setAction(null)}>Batal</button>
            </div>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
