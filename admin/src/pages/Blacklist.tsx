import { useState, type FormEvent } from 'react';
import { blocklistAdd, blocklistRemove, listBlocklist, type BlockEntry } from '../lib/api';
import { adminError } from '../lib/errors';
import { dt } from '../lib/format';
import { useLoad } from '../lib/useLoad';

const KIND: Record<BlockEntry['kind'], string> = { email: 'Email', social: 'Akun sosial', account: 'Rekening / e-wallet' };

// Permanent blacklist (0066): identities that can't sign up, link an account, add a payout method, submit or withdraw.
export function Blacklist() {
  const list = useLoad(listBlocklist, []);
  const [kind, setKind] = useState<BlockEntry['kind']>('email');
  const [value, setValue] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function add(e: FormEvent) {
    e.preventDefault(); setError(null);
    if (!value.trim()) return setError('Isi identitasnya.');
    setBusy(true);
    try { await blocklistAdd(kind, value.trim(), reason.trim()); setValue(''); setReason(''); await list.reload(); }
    catch (err) { setError(adminError(err)); } finally { setBusy(false); }
  }
  async function remove(b: BlockEntry) {
    const note = prompt(`Hapus ${KIND[b.kind].toLowerCase()} ${b.value} dari blacklist (banding diterima)? Tulis catatan:`);
    if (note === null) return;
    setError(null);
    try { await blocklistRemove(b.id, note); await list.reload(); } catch (err) { setError(adminError(err)); }
  }

  return (
    <>
      <div className="page-head"><div><h1>Blacklist</h1><p className="sub">Identitas yang diblokir permanen: tidak bisa daftar, hubungkan akun, tambah rekening, submit, atau tarik saldo. Blacklist kreator sekaligus dari halaman Kreator.</p></div></div>
      <form className="card section" onSubmit={add} style={{ display: 'grid', gap: 12 }}>
        <h3 style={{ margin: 0 }}>Tambah manual</h3>
        <div className="grid3">
          <label className="field">Jenis<select value={kind} onChange={(e) => setKind(e.target.value as BlockEntry['kind'])}>
            {Object.entries(KIND).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
          <label className="field">Identitas<input value={value} onChange={(e) => setValue(e.target.value)} placeholder={kind === 'email' ? 'nama@email.com' : kind === 'social' ? 'username' : '08xx / no. rekening'} /></label>
          <label className="field">Alasan<input value={reason} onChange={(e) => setReason(e.target.value)} /></label>
        </div>
        {error ? <div className="notice error">{error}</div> : null}
        <div className="actions"><button className="btn danger" disabled={busy}>{busy ? 'Menyimpan…' : 'Blokir'}</button></div>
      </form>
      <div className="card section">
        {list.error ? <div className="notice error">{list.error}</div> : null}
        {list.data && !list.data.length ? <div className="empty">Belum ada yang diblokir.</div> : null}
        {list.data?.length ? (
          <table>
            <thead><tr><th>Jenis</th><th>Identitas</th><th>Alasan</th><th>Sejak</th><th /></tr></thead>
            <tbody>{list.data.map((b) => (
              <tr key={b.id}><td>{KIND[b.kind]}</td><td>{b.value}</td><td>{b.reason ?? '—'}</td><td>{dt(b.created_at)}</td>
                <td className="n"><button className="btn secondary" onClick={() => remove(b)}>Hapus (banding)</button></td></tr>
            ))}</tbody>
          </table>
        ) : null}
      </div>
    </>
  );
}
