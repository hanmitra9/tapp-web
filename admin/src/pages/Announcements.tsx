import { useState, type FormEvent } from 'react';
import { deleteAnnouncement, listAnnouncements, saveAnnouncement, type Announcement } from '../lib/api';
import { adminError } from '../lib/errors';
import { dt, toLocalInput } from '../lib/format';
import { useLoad } from '../lib/useLoad';

const AUD: Record<Announcement['audience'], string> = { creator: 'Kreator', brand: 'Brand', all: 'Semua' };
const TONE: Record<Announcement['tone'], { label: string; cls: string }> = { info: { label: 'Info', cls: '' }, success: { label: 'Kabar baik', cls: 'success' }, warning: { label: 'Penting', cls: 'warning' } };
const EMPTY = { id: '', title: '', body: '', cta_label: '', cta_url: '', tone: 'info' as Announcement['tone'], audience: 'creator' as Announcement['audience'], starts_at: '', ends_at: '', active: true };
const status = (a: Announcement) => !a.active ? 'Mati' : new Date(a.starts_at) > new Date() ? 'Terjadwal' : a.ends_at && new Date(a.ends_at) <= new Date() ? 'Selesai' : 'Tayang';

// Pengumuman (0077): a short banner at the top of the creator and/or brand home screen, no coding needed.
export function Announcements() {
  const list = useLoad(listAnnouncements, []);
  const [f, setF] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof typeof EMPTY>(k: K, v: (typeof EMPTY)[K]) => setF((x) => ({ ...x, [k]: v }));

  async function save(e: FormEvent) {
    e.preventDefault(); setError(null);
    if (!f.title.trim()) return setError('Judul wajib diisi.');
    setBusy(true);
    try {
      await saveAnnouncement({ ...(f.id ? { id: f.id } : {}), title: f.title, body: f.body, cta_label: f.cta_label || null, cta_url: f.cta_url || null,
        tone: f.tone, audience: f.audience, active: f.active,
        ...(f.starts_at ? { starts_at: new Date(f.starts_at).toISOString() } : {}), ends_at: f.ends_at ? new Date(f.ends_at).toISOString() : null });
      setF(EMPTY); await list.reload();
    } catch (err) { setError(adminError(err)); } finally { setBusy(false); }
  }
  function edit(a: Announcement) {
    setF({ id: a.id, title: a.title, body: a.body, cta_label: a.cta_label ?? '', cta_url: a.cta_url ?? '', tone: a.tone, audience: a.audience,
      starts_at: toLocalInput(new Date(a.starts_at)), ends_at: a.ends_at ? toLocalInput(new Date(a.ends_at)) : '', active: a.active });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  async function toggle(a: Announcement) {
    try { await saveAnnouncement({ id: a.id, title: a.title, body: a.body, cta_label: a.cta_label, cta_url: a.cta_url, tone: a.tone, audience: a.audience,
      starts_at: a.starts_at, ends_at: a.ends_at, active: !a.active }); await list.reload(); } catch (err) { setError(adminError(err)); }
  }
  async function remove(a: Announcement) {
    if (!confirm(`Hapus pengumuman "${a.title}"?`)) return;
    try { await deleteAnnouncement(a.id); await list.reload(); } catch (err) { setError(adminError(err)); }
  }

  return (
    <>
      <div className="page-head"><div><h1>Pengumuman</h1><p className="sub">Banner di atas beranda kreator dan/atau brand. Maksimal 3 tampil sekaligus (terbaru dulu). Tiap orang bisa menutupnya.</p></div></div>
      <form className="card section" onSubmit={save} style={{ display: 'grid', gap: 12 }}>
        <h3 style={{ margin: 0 }}>{f.id ? 'Ubah pengumuman' : 'Pengumuman baru'}</h3>
        <label className="field">Judul (maks 80)<input value={f.title} maxLength={80} onChange={(e) => set('title', e.target.value)} placeholder="Campaign baru: TAPP Mega minggu ini" /></label>
        <label className="field">Isi (maks 280)<textarea value={f.body} maxLength={280} onChange={(e) => set('body', e.target.value)} /></label>
        <div className="grid3">
          <label className="field">Untuk<select value={f.audience} onChange={(e) => set('audience', e.target.value as Announcement['audience'])}>
            {Object.entries(AUD).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
          <label className="field">Warna<select value={f.tone} onChange={(e) => set('tone', e.target.value as Announcement['tone'])}>
            {Object.entries(TONE).map(([k, t]) => <option key={k} value={k}>{t.label}</option>)}</select></label>
          <label className="field">Status<select value={f.active ? '1' : '0'} onChange={(e) => set('active', e.target.value === '1')}>
            <option value="1">Aktif</option><option value="0">Mati</option></select></label>
        </div>
        <div className="grid3">
          <label className="field">Tombol (opsional)<input value={f.cta_label} maxLength={30} onChange={(e) => set('cta_label', e.target.value)} placeholder="Lihat campaign" /></label>
          <label className="field">Link tombol<input value={f.cta_url} onChange={(e) => set('cta_url', e.target.value)} placeholder="/dashboard/campaigns atau https://…" /></label>
          <div />
        </div>
        <div className="grid3">
          <label className="field">Mulai (kosong = sekarang)<input type="datetime-local" value={f.starts_at} onChange={(e) => set('starts_at', e.target.value)} /></label>
          <label className="field">Selesai (opsional)<input type="datetime-local" value={f.ends_at} onChange={(e) => set('ends_at', e.target.value)} /></label>
          <div />
        </div>
        {error ? <div className="notice error">{error}</div> : null}
        <div className="actions">
          <button className="btn" disabled={busy}>{busy ? 'Menyimpan…' : f.id ? 'Simpan perubahan' : 'Terbitkan'}</button>
          {f.id ? <button type="button" className="btn secondary" onClick={() => setF(EMPTY)}>Batal</button> : null}
        </div>
      </form>
      <div className="card section">
        {list.error ? <div className="notice error">{list.error}</div> : null}
        {list.data && !list.data.length ? <div className="empty">Belum ada pengumuman.</div> : null}
        {list.data?.length ? (
          <table>
            <thead><tr><th>Judul</th><th>Untuk</th><th>Status</th><th>Mulai</th><th>Selesai</th><th /></tr></thead>
            <tbody>{list.data.map((a) => (
              <tr key={a.id}>
                <td><span className={`badge ${TONE[a.tone].cls}`} style={{ marginRight: 6 }}>{TONE[a.tone].label}</span>{a.title}</td>
                <td>{AUD[a.audience]}</td><td>{status(a)}</td><td>{dt(a.starts_at)}</td><td>{a.ends_at ? dt(a.ends_at) : '—'}</td>
                <td className="n" style={{ whiteSpace: 'nowrap' }}>
                  <button className="btn secondary" onClick={() => edit(a)}>Ubah</button>{' '}
                  <button className="btn secondary" onClick={() => toggle(a)}>{a.active ? 'Matikan' : 'Aktifkan'}</button>{' '}
                  <button className="btn danger secondary" onClick={() => remove(a)}>Hapus</button>
                </td>
              </tr>
            ))}</tbody>
          </table>
        ) : null}
      </div>
    </>
  );
}
