import { Fragment, useEffect, useState } from 'react';
import { listAudit, type AuditRow } from '../lib/api';
import { adminError } from '../lib/errors';
import { dt } from '../lib/format';

const ENTITIES = ['', 'submission', 'campaign', 'creator', 'payout_request', 'dispute', 'support_ticket', 'creator_platform'];

export function Audit() {
  const [entity, setEntity] = useState('');
  const [action, setAction] = useState('');
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  async function load(reset: boolean) {
    setLoading(true); setError(null);
    try {
      const next = await listAudit({ entity, action, before: reset ? undefined : rows[rows.length - 1]?.id });
      setRows(reset ? next : [...rows, ...next]); setDone(next.length < 50);
    } catch (e) { setError(adminError(e)); } finally { setLoading(false); }
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { void load(true); }, []);

  return (
    <>
      <div className="page-head">
        <div><h1>Audit log</h1><p className="sub">Semua tindakan sensitif. Catatan tidak bisa diubah atau dihapus.</p></div>
        <div className="actions">
          <select value={entity} onChange={(e) => setEntity(e.target.value)} style={{ width: 180 }}>
            {ENTITIES.map((x) => <option key={x} value={x}>{x || 'Semua entitas'}</option>)}
          </select>
          <input placeholder="Aksi, mis. payout" value={action} onChange={(e) => setAction(e.target.value)} style={{ width: 180 }} />
          <button className="btn secondary" onClick={() => load(true)}>Terapkan</button>
        </div>
      </div>
      {error ? <div className="notice error">{error}</div> : null}
      <table>
        <thead><tr><th>Waktu</th><th>Pelaku</th><th>Aksi</th><th>Entitas</th><th /></tr></thead>
        <tbody>{rows.map((r) => (
          <Fragment key={r.id}>
            <tr>
              <td>{dt(r.created_at)}</td>
              <td>{r.actor_username ? `@${r.actor_username}` : r.actor_name ?? (r.actor_id ? r.actor_id.slice(0, 8) : 'sistem')} <span className="sub">{r.actor_role ?? ''}</span></td>
              <td><code>{r.action}</code></td>
              <td>{r.entity_type} <span className="sub">{r.entity_id?.slice(0, 8)}</span></td>
              <td className="n"><button className="preset" onClick={() => setOpen(open === r.id ? null : r.id)}>{open === r.id ? 'Tutup' : 'Detail'}</button></td>
            </tr>
            {open === r.id ? (
              <tr><td colSpan={5}>
                <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontSize: 12, background: 'var(--g50)', padding: 12, borderRadius: 6 }}>
                  {JSON.stringify({ before: r.before, after: r.after, metadata: r.metadata, entity_id: r.entity_id }, null, 2)}
                </pre>
              </td></tr>
            ) : null}
          </Fragment>
        ))}</tbody>
      </table>
      {!done && rows.length ? <div className="actions" style={{ marginTop: 12 }}><button className="btn secondary" disabled={loading} onClick={() => load(false)}>{loading ? 'Memuat…' : 'Muat lebih banyak'}</button></div> : null}
      {done && !rows.length ? <div className="empty">Tidak ada catatan.</div> : null}
    </>
  );
}
