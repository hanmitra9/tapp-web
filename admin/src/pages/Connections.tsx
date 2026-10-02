import { useEffect, useState } from 'react';
import { disconnectPlatform, listConnections, type Connection, type ConnStatus } from '../lib/api';
import { adminError } from '../lib/errors';
import { ago, dt, num } from '../lib/format';
import { useLoad } from '../lib/useLoad';

const TABS: { s: ConnStatus | null; label: string }[] = [
  { s: 'connected', label: 'Terhubung' }, { s: 'error', label: 'Bermasalah' }, { s: 'revoked', label: 'Diputus' }, { s: null, label: 'Semua' },
];
const STATUS: Record<ConnStatus, { label: string; cls: string }> = {
  connected: { label: 'Terhubung', cls: 'success' }, error: { label: 'Perlu sambung ulang', cls: 'danger' },
  expired: { label: 'Kedaluwarsa', cls: 'warning' }, revoked: { label: 'Diputus', cls: '' },
};
const PLATFORM: Record<string, string> = { tiktok: 'TikTok', youtube: 'YouTube', instagram: 'Instagram', x: 'X', facebook: 'Facebook' };

export function Connections() {
  const [tab, setTab] = useState(TABS[0]!);
  const [search, setSearch] = useState('');
  const [sel, setSel] = useState<string | null>(null);
  const list = useLoad(() => listConnections(tab.s, search), [tab.s, search]);
  useEffect(() => setSel(null), [tab.s]);
  const c = list.data?.find((x) => x.id === sel) ?? null;
  return (
    <>
      <div className="page-head">
        <div><h1>Koneksi akun</h1><p className="sub">Akun TikTok/Instagram yang dihubungkan kreator untuk views otomatis. Login = bukti kepemilikan, jadi akunnya otomatis terverifikasi.</p></div>
        <input type="search" placeholder="Cari nama, username, handle…" value={search} onChange={(e) => setSearch(e.target.value)} style={{ maxWidth: 280 }} />
      </div>
      <div className="tabs">{TABS.map((x) => <button key={x.label} className={`tab ${tab.s === x.s ? 'on' : ''}`} onClick={() => setTab(x)}>{x.label}</button>)}</div>
      <div className="split">
        <div className="list">
          {list.error ? <div className="notice error" style={{ margin: 12 }}>{list.error}</div> : null}
          {list.data && !list.data.length ? <div className="empty">Belum ada koneksi.</div> : null}
          {list.data?.map((x) => (
            <button key={x.id} className={`list-item ${sel === x.id ? 'on' : ''}`} onClick={() => setSel(x.id)}>
              <div className="row"><span className="title">{PLATFORM[x.platform] ?? x.platform} @{x.handle ?? '—'}</span><span className={`badge ${STATUS[x.status].cls}`}>{STATUS[x.status].label}</span></div>
              <div className="meta">{x.full_name ?? '—'}{x.username ? ` · @${x.username}` : ''} · {num(x.tracked)} klip dipantau · sinkron {x.last_api_metric_at ? ago(x.last_api_metric_at) : 'belum'}</div>
            </button>
          ))}
        </div>
        <div className="detail">{c ? <Detail key={c.id + c.status} c={c} onDone={list.reload} /> : <div className="empty">Pilih koneksi dari daftar.</div>}</div>
      </div>
    </>
  );
}

function Detail({ c, onDone }: { c: Connection; onDone: () => Promise<void> }) {
  const [reason, setReason] = useState('');
  const [unverify, setUnverify] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function cut() {
    if (!reason.trim()) return setError('Tulis alasan; kreator akan menerimanya.');
    if (!confirm(`Putuskan ${PLATFORM[c.platform] ?? c.platform} @${c.handle}?`)) return;
    setBusy(true); setError(null);
    try { await disconnectPlatform(c.id, reason.trim(), unverify); await onDone(); } catch (e) { setError(adminError(e)); } finally { setBusy(false); }
  }
  const url = !c.handle ? null : c.platform === 'tiktok' ? `https://www.tiktok.com/@${c.handle}` : c.platform === 'instagram' ? `https://www.instagram.com/${c.handle}` : null;
  return (
    <>
      <h2>{PLATFORM[c.platform] ?? c.platform} @{c.handle ?? '—'}</h2>
      <p className="sub">{c.full_name ?? '—'}{c.username ? ` · @${c.username}` : ''} · terhubung {dt(c.connected_at)}</p>
      <div className="section card">
        <div className="mrow"><span>Status</span><span className={`badge ${STATUS[c.status].cls}`}>{STATUS[c.status].label}</span></div>
        <div className="mrow"><span>Akun terverifikasi</span><b>{c.verified ? 'Ya' : 'Tidak'}</b></div>
        <div className="mrow"><span>Klip dipantau</span><b>{num(c.tracked)}</b></div>
        <div className="mrow"><span>Metrik otomatis terakhir</span><span>{c.last_api_metric_at ? dt(c.last_api_metric_at) : 'Belum ada'}</span></div>
        <div className="mrow"><span>Token berlaku sampai</span><span>{c.token_expires_at ? dt(c.token_expires_at) : '—'}</span></div>
        <div className="mrow"><span>Izin</span><span>{c.scopes.length ? c.scopes.join(', ') : '—'}</span></div>
        {url ? <div className="mrow"><span>Profil</span><a href={url} target="_blank" rel="noopener">{url.replace('https://www.', '')}</a></div> : null}
        {c.last_error ? <div className="notice error" style={{ marginTop: 10 }}>{c.last_error}</div> : null}
        {c.revoked_at ? <div className="notice info" style={{ marginTop: 10 }}>Diputus {dt(c.revoked_at)}</div> : null}
      </div>
      {c.status !== 'revoked' ? (
        <div className="section card">
          <label className="field">Alasan memutus (dikirim ke kreator)<textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Contoh: akun dipakai bersama kreator lain" /></label>
          <label className="check"><input type="checkbox" checked={unverify} onChange={(e) => setUnverify(e.target.checked)} />Cabut juga verifikasi akun ini</label>
          {error ? <div className="notice error">{error}</div> : null}
          <div className="actions"><button className="btn danger" disabled={busy} onClick={cut}>Putuskan koneksi</button></div>
        </div>
      ) : null}
    </>
  );
}
