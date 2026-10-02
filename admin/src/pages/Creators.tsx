import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { listCreators, setCreatorStatus, verifyPlatform, type AdminCreator, type CreatorStatus } from '../lib/api';
import { adminError } from '../lib/errors';
import { dt, num } from '../lib/format';
import { useLoad } from '../lib/useLoad';

const TABS: { s: CreatorStatus; label: string }[] = [
  { s: 'verified', label: 'Menunggu persetujuan' }, { s: 'active', label: 'Aktif' }, { s: 'suspended', label: 'Ditangguhkan' },
  { s: 'pending', label: 'Belum onboarding' }, { s: 'banned', label: 'Ditutup' },
];
// Allowed moves mirror admin_set_creator_status.
const ACTIONS: Record<CreatorStatus, { to: CreatorStatus; label: string; cls: string }[]> = {
  verified: [{ to: 'active', label: 'Setujui kreator', cls: '' }, { to: 'suspended', label: 'Tangguhkan', cls: 'warn' }, { to: 'banned', label: 'Tutup akun', cls: 'danger' }],
  active: [{ to: 'suspended', label: 'Tangguhkan', cls: 'warn' }, { to: 'banned', label: 'Tutup akun', cls: 'danger' }],
  suspended: [{ to: 'active', label: 'Aktifkan kembali', cls: '' }, { to: 'banned', label: 'Tutup akun', cls: 'danger' }],
  pending: [{ to: 'suspended', label: 'Tangguhkan', cls: 'warn' }, { to: 'banned', label: 'Tutup akun', cls: 'danger' }],
  banned: [],
};

export function Creators() {
  const { refreshCounts } = useOutletContext<{ refreshCounts: () => void }>();
  const [tab, setTab] = useState<CreatorStatus>('verified');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const list = useLoad(() => listCreators(tab, search), [tab, search]);
  useEffect(() => setSelected(null), [tab]);
  const current = list.data?.find((c) => c.user_id === selected) ?? null;

  return (
    <>
      <div className="page-head">
        <div><h1>Kreator</h1><p className="sub">Setujui kreator setelah akun sosialnya dicek. Hanya kreator aktif yang bisa bergabung ke campaign.</p></div>
        <input type="search" placeholder="Cari nama atau username…" value={search} onChange={(e) => setSearch(e.target.value)} style={{ maxWidth: 280 }} />
      </div>
      <div className="tabs" role="tablist">
        {TABS.map((t) => <button key={t.s} role="tab" aria-selected={tab === t.s} className={`tab ${tab === t.s ? 'on' : ''}`} onClick={() => setTab(t.s)}>{t.label}</button>)}
      </div>
      <div className="split">
        <div className="list">
          {list.error ? <div className="notice error" style={{ margin: 12 }}>{list.error}</div> : null}
          {list.data && !list.data.length ? <div className="empty">Tidak ada kreator di sini.</div> : null}
          {list.data?.map((c) => (
            <button key={c.user_id} className={`list-item ${selected === c.user_id ? 'on' : ''}`} onClick={() => setSelected(c.user_id)}>
              <div className="row"><span className="title">{c.profile?.full_name ?? '—'}</span><span className="sub">{c.tier}</span></div>
              <div className="meta">@{c.profile?.username ?? '—'} · {c.platforms.map((p) => p.platform).join(', ') || 'tanpa akun'} · {c.niches.join(', ')}</div>
            </button>
          ))}
        </div>
        <div className="detail">
          {current ? <CreatorDetail c={current} onChanged={async () => { await list.reload(); refreshCounts(); }} /> : <div className="empty">Pilih kreator dari daftar.</div>}
        </div>
      </div>
    </>
  );
}

function CreatorDetail({ c, onChanged }: { c: AdminCreator; onChanged: () => Promise<void> }) {
  const [action, setAction] = useState<CreatorStatus | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const needsReason = action === 'suspended' || action === 'banned';
  const unverified = c.platforms.filter((p) => !p.verified_at).length;

  async function confirm() {
    if (!action) return;
    if (needsReason && !reason.trim()) return setError('Alasan wajib diisi — kreator akan melihatnya.');
    setBusy(true); setError(null);
    try { await setCreatorStatus(c.user_id, action, reason.trim() || null); setAction(null); setReason(''); await onChanged(); }
    catch (e) { setError(adminError(e)); }
    finally { setBusy(false); }
  }
  async function toggle(id: string, v: boolean) {
    setError(null);
    try { await verifyPlatform(id, v); await onChanged(); } catch (e) { setError(adminError(e)); }
  }

  return (
    <>
      <h2>{c.profile?.full_name} <span className="sub">@{c.profile?.username}</span></h2>
      <p className="sub">Status {c.status} · level {c.tier} · reliabilitas {Number(c.reliability_score)} · onboarding {dt(c.onboarding_completed_at)}</p>
      {c.status_reason ? <div className="notice warn">Alasan status: {c.status_reason}</div> : null}

      <div className="section">
        <h3>Akun sosial</h3>
        <p className="sub" style={{ margin: 0 }}>Cek kepemilikan (mis. kode di bio atau DM dari akun tersebut), lalu tandai terverifikasi.</p>
        <table>
          <thead><tr><th>Platform</th><th>Handle</th><th className="n">Followers</th><th>Status</th><th /></tr></thead>
          <tbody>{c.platforms.map((p) => (
            <tr key={p.id}>
              <td>{p.platform}{p.platform === c.main_platform ? ' (utama)' : ''}</td>
              <td>{p.profile_url ? <a href={p.profile_url} target="_blank" rel="noreferrer noopener">@{p.handle} ↗</a> : `@${p.handle}`}</td>
              <td className="n">{num(p.followers)}</td>
              <td>{p.verified_at ? <span className="badge success">Terverifikasi</span> : <span className="badge">Belum dicek</span>}</td>
              <td className="n"><button className="btn secondary" onClick={() => toggle(p.id, !p.verified_at)}>{p.verified_at ? 'Batalkan' : 'Verifikasi'}</button></td>
            </tr>
          ))}</tbody>
        </table>
      </div>

      <dl className="kv" style={{ marginTop: 24 }}>
        <div><dt>Negara</dt><dd>{c.profile?.country ?? '—'}</dd></div>
        <div><dt>Niche</dt><dd>{c.niches.join(', ') || '—'}</dd></div>
        <div><dt>Jenis konten</dt><dd>{c.content_categories.join(', ') || '—'}</dd></div>
        <div><dt>Pengalaman</dt><dd>{c.experience_level ?? '—'}</dd></div>
        <div><dt>Gaya konten</dt><dd>{c.content_style ?? '—'}</dd></div>
        <div><dt>Penonton</dt><dd>{[c.audience.countries, c.audience.age_ranges, c.audience.languages].map((x) => (x ?? []).join(', ')).filter(Boolean).join(' · ') || '—'}</dd></div>
        <div><dt>Metode pencairan</dt><dd>{c.payout[0] ? `${c.payout[0].provider} · ${c.payout[0].account_name}` : 'Belum ada'}</dd></div>
      </dl>

      {ACTIONS[c.status].length ? (
        <div className="section card">
          <h2>Ubah status</h2>
          {c.status === 'verified' && unverified ? <div className="notice warn">{unverified} akun sosial belum diverifikasi.</div> : null}
          <div className="actions">
            {ACTIONS[c.status].map((a) => (
              <button key={a.to} className={`btn ${a.cls}`} onClick={() => { setAction(a.to); setError(null); }}
                style={action === a.to ? { outline: '2px solid var(--blue)' } : undefined}>{a.label}</button>
            ))}
          </div>
          {needsReason ? <label className="field">Alasan (dilihat kreator)<textarea value={reason} onChange={(e) => setReason(e.target.value)} /></label> : null}
          {error ? <div className="notice error">{error}</div> : null}
          {action ? <div className="actions"><button className="btn" disabled={busy} onClick={confirm}>{busy ? 'Menyimpan…' : 'Konfirmasi'}</button>
            <button className="btn secondary" onClick={() => setAction(null)}>Batal</button></div> : null}
        </div>
      ) : error ? <div className="notice error">{error}</div> : null}
    </>
  );
}
