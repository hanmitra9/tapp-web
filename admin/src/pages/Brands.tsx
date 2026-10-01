import { useState, type FormEvent } from 'react';
import { inviteBrandMember, listBrandPeople, listBrands, removeBrandMember, revokeBrandInvite, saveBrand, type Brand } from '../lib/api';
import { adminError } from '../lib/errors';
import { dt } from '../lib/format';
import { useLoad } from '../lib/useLoad';

const slugify = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/[\s_]+/g, '-').slice(0, 48);

export function Brands() {
  const list = useLoad(listBrands, []);
  const [editing, setEditing] = useState<Partial<Brand> | null>(null);
  const [people, setPeople] = useState<Brand | null>(null);
  return (
    <>
      <div className="page-head">
        <div><h1>Brand</h1><p className="sub">Brand yang bisa menjalankan campaign. Brand ditangguhkan tidak muncul di marketplace.</p></div>
        <button className="btn" onClick={() => setEditing({ status: 'active' })}>Tambah brand</button>
      </div>
      {list.error ? <div className="notice error">{list.error}</div> : null}
      {people ? <BrandPeople b={people} onClose={() => setPeople(null)} /> : null}
      {editing ? <BrandForm b={editing} onDone={async () => { setEditing(null); await list.reload(); }} onCancel={() => setEditing(null)} /> : null}
      <table style={{ marginTop: 16 }}>
        <thead><tr><th>Nama</th><th>Slug</th><th>Website</th><th>Status</th><th>Dibuat</th><th /></tr></thead>
        <tbody>{list.data?.map((b) => (
          <tr key={b.id}>
            <td><strong>{b.name}</strong></td><td className="sub">{b.slug}</td>
            <td>{b.website ? <a href={b.website} target="_blank" rel="noreferrer noopener">{b.website.replace(/^https?:\/\//, '')}</a> : '—'}</td>
            <td><span className={`badge ${b.status === 'active' ? 'success' : b.status === 'suspended' ? 'danger' : ''}`}>{b.status}</span></td>
            <td>{dt(b.created_at)}</td>
            <td className="n"><div className="actions" style={{ justifyContent: 'flex-end' }}>
              <button className="btn secondary" onClick={() => setPeople(b)}>Akses brand</button>
              <button className="btn secondary" onClick={() => setEditing(b)}>Ubah</button></div></td>
          </tr>
        ))}</tbody>
      </table>
    </>
  );
}

function BrandForm({ b, onDone, onCancel }: { b: Partial<Brand>; onDone: () => Promise<void>; onCancel: () => void }) {
  const [v, setV] = useState({ name: b.name ?? '', slug: b.slug ?? '', website: b.website ?? '', logo_url: b.logo_url ?? '', status: b.status ?? 'active' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function save(e: FormEvent) {
    e.preventDefault(); setError(null);
    if (v.name.trim().length < 2) return setError('Nama minimal 2 karakter.');
    if (!/^[a-z0-9-]{2,48}$/.test(v.slug)) return setError('Slug: huruf kecil, angka, tanda hubung.');
    if (v.website && !/^https?:\/\//.test(v.website)) return setError('Website harus diawali https://');
    setBusy(true);
    try { await saveBrand({ ...b, ...v, status: v.status as Brand['status'] }); await onDone(); }
    catch (err) { const m = adminError(err); setError(m.includes('duplicate') ? 'Slug sudah dipakai brand lain.' : m); }
    finally { setBusy(false); }
  }
  return (
    <form className="card section" onSubmit={save}>
      <h2>{b.id ? 'Ubah brand' : 'Brand baru'}</h2>
      <div className="grid2">
        <label className="field">Nama<input value={v.name} onChange={(e) => setV({ ...v, name: e.target.value, slug: b.id ? v.slug : slugify(e.target.value) })} /></label>
        <label className="field">Slug<input value={v.slug} onChange={(e) => setV({ ...v, slug: e.target.value })} /></label>
        <label className="field">Website<input value={v.website} onChange={(e) => setV({ ...v, website: e.target.value })} placeholder="https://" /></label>
        <label className="field">URL logo (opsional)<input value={v.logo_url} onChange={(e) => setV({ ...v, logo_url: e.target.value })} /></label>
        <label className="field">Status<select value={v.status} onChange={(e) => setV({ ...v, status: e.target.value as Brand['status'] })}>
          <option value="active">Aktif</option><option value="pending">Menunggu</option><option value="suspended">Ditangguhkan</option></select></label>
      </div>
      {error ? <div className="notice error">{error}</div> : null}
      <div className="actions"><button className="btn" disabled={busy}>{busy ? 'Menyimpan…' : 'Simpan'}</button><button type="button" className="btn secondary" onClick={onCancel}>Batal</button></div>
    </form>
  );
}

const APP_URL = (import.meta.env.VITE_APP_URL as string | undefined)?.replace(/\/$/, '') ?? '';
const ROLE_LABEL: Record<string, string> = { owner: 'Pemilik', member: 'Anggota', viewer: 'Hanya lihat' };

// Invite-only brand access: admin adds an email; the person signs up with it and, once the email is verified,
// lands in the brand dashboard. Nothing is emailed automatically — share the link below.
function BrandPeople({ b, onClose }: { b: Brand; onClose: () => void }) {
  const list = useLoad(() => listBrandPeople(b.id), [b.id]);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('member');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const link = (e: string) => `${APP_URL}/register?invite=brand&email=${encodeURIComponent(e)}`;

  async function invite(ev: FormEvent) {
    ev.preventDefault(); setError(null);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) return setError('Format email tidak valid.');
    setBusy(true);
    try { await inviteBrandMember(b.id, email.trim().toLowerCase(), role); setEmail(''); await list.reload(); }
    catch (e) { setError(adminError(e)); } finally { setBusy(false); }
  }
  async function act(fn: () => Promise<unknown>) { setError(null); try { await fn(); await list.reload(); } catch (e) { setError(adminError(e)); } }
  const copy = async (e: string) => { await navigator.clipboard.writeText(link(e)); setCopied(e); setTimeout(() => setCopied(null), 1500); };

  return (
    <div className="card section">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>Akses dashboard — {b.name}</h2>
        <button className="btn secondary" onClick={onClose}>Tutup</button>
      </div>
      <p className="sub" style={{ margin: 0 }}>Brand hanya bisa melihat laporan campaign miliknya. Undangan berlaku 14 hari; akun aktif setelah email diverifikasi.</p>
      <form className="grid3" onSubmit={invite} style={{ alignItems: 'end' }}>
        <label className="field">Email<input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nama@brand.com" /></label>
        <label className="field">Peran<select value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="owner">Pemilik</option><option value="member">Anggota</option><option value="viewer">Hanya lihat</option></select></label>
        <button className="btn" disabled={busy}>{busy ? 'Mengundang…' : 'Undang'}</button>
      </form>
      {!APP_URL ? <div className="notice info">Isi VITE_APP_URL di admin/.env (alamat website TAPP) supaya link undangan bisa disalin lengkap.</div> : null}
      {error ? <div className="notice error">{error}</div> : null}
      {list.error ? <div className="notice error">{list.error}</div> : null}
      <table>
        <thead><tr><th>Email</th><th>Peran</th><th>Status</th><th /></tr></thead>
        <tbody>{list.data?.map((p) => (
          <tr key={(p.invite_id ?? p.user_id) as string}>
            <td>{p.email}</td><td>{ROLE_LABEL[p.role] ?? p.role}</td>
            <td>{p.kind === 'member' ? <span className="badge success">Aktif</span> : <span className="badge warning">Diundang · s/d {dt(p.expires_at)}</span>}</td>
            <td className="n"><div className="actions" style={{ justifyContent: 'flex-end' }}>
              {p.kind === 'invite' ? <>
                <button className="preset" onClick={() => copy(p.email)}>{copied === p.email ? 'Tersalin' : 'Salin link daftar'}</button>
                <button className="btn danger" onClick={() => act(() => revokeBrandInvite(p.invite_id!))}>Batalkan</button>
              </> : <button className="btn danger" onClick={() => { if (confirm(`Cabut akses ${p.email}?`)) void act(() => removeBrandMember(b.id, p.user_id!)); }}>Cabut akses</button>}
            </div></td>
          </tr>
        ))}</tbody>
      </table>
      {list.data && !list.data.length ? <p className="sub" style={{ margin: 0 }}>Belum ada yang punya akses.</p> : null}
    </div>
  );
}
