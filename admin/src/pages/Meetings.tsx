import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { listMeetings, updateMeeting, type Meeting, type MeetingStatus } from '../lib/api';
import { adminError } from '../lib/errors';
import { dt } from '../lib/format';
import { useLoad } from '../lib/useLoad';

const TABS: { key: string; label: string; statuses: MeetingStatus[] }[] = [
  { key: 'new', label: 'Perlu dikonfirmasi', statuses: ['new'] },
  { key: 'scheduled', label: 'Terjadwal', statuses: ['scheduled'] },
  { key: 'closed', label: 'Selesai / batal', statuses: ['done', 'cancelled'] },
];
const BUDGET: Record<string, string> = { '<10jt': '< Rp10 jt', '10-50jt': 'Rp10–50 jt', '50-100jt': 'Rp50–100 jt', '>100jt': '> Rp100 jt' };
const wib = (iso: string) => new Date(iso).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) + ' WIB';

export function Meetings() {
  const { refreshCounts } = useOutletContext<{ refreshCounts: () => void }>();
  const [tab, setTab] = useState(TABS[0]!);
  const [sel, setSel] = useState<string | null>(null);
  const list = useLoad(() => listMeetings(tab.statuses), [tab.key]);
  useEffect(() => setSel(null), [tab.key]);
  const m = list.data?.find((x) => x.id === sel) ?? null;
  return (
    <>
      <div className="page-head"><div><h1>Meeting</h1><p className="sub">Permintaan meeting dari brand lewat halaman /meeting di website. Konfirmasi dengan link meeting; brand menerima email jadwal.</p></div></div>
      <div className="tabs">{TABS.map((x) => <button key={x.key} className={`tab ${tab.key === x.key ? 'on' : ''}`} onClick={() => setTab(x)}>{x.label}</button>)}</div>
      <div className="split">
        <div className="list">
          {list.error ? <div className="notice error" style={{ margin: 12 }}>{list.error}</div> : null}
          {list.data && !list.data.length ? <div className="empty">Tidak ada permintaan.</div> : null}
          {list.data?.map((x) => (
            <button key={x.id} className={`list-item ${sel === x.id ? 'on' : ''}`} onClick={() => setSel(x.id)}>
              <div className="row"><span className="title">{x.company}</span><span className="badge">{wib(x.slot)}</span></div>
              <div className="meta">{x.name} · {x.email}</div>
            </button>
          ))}
        </div>
        <div className="detail">{m ? <Detail key={m.id + m.status} m={m} onDone={async () => { await list.reload(); refreshCounts(); }} /> : <div className="empty">Pilih permintaan dari daftar.</div>}</div>
      </div>
    </>
  );
}

function Detail({ m, onDone }: { m: Meeting; onDone: () => Promise<void> }) {
  const [link, setLink] = useState(m.meet_link ?? '');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function act(status: MeetingStatus) {
    if (status === 'scheduled' && !/^https:\/\//.test(link.trim())) return setError('Isi link meeting (https://…) sebelum mengonfirmasi.');
    setBusy(true); setError(null);
    try { await updateMeeting(m.id, status, link.trim() || null, note.trim() || null); await onDone(); } catch (e) { setError(adminError(e)); } finally { setBusy(false); }
  }
  const wa = m.whatsapp ? `https://wa.me/${m.whatsapp.replace(/[^0-9]/g, '').replace(/^0/, '62')}` : null;
  return (
    <>
      <h2>{m.company}</h2>
      <p className="sub">{m.name} · diminta {dt(m.created_at)}</p>
      <div className="section card">
        <div className="mrow"><span>Jadwal</span><b>{wib(m.slot)}</b></div>
        <div className="mrow"><span>Email</span><a href={`mailto:${m.email}`}>{m.email}</a></div>
        <div className="mrow"><span>WhatsApp</span>{wa ? <a href={wa} target="_blank" rel="noopener">{m.whatsapp}</a> : <span>—</span>}</div>
        <div className="mrow"><span>Budget</span><span>{m.budget_range ? BUDGET[m.budget_range] ?? m.budget_range : 'Belum tahu'}</span></div>
        {m.goal ? <p style={{ margin: '10px 0 0', whiteSpace: 'pre-wrap' }}>{m.goal}</p> : null}
        {m.admin_note ? <div className="notice info" style={{ marginTop: 10 }}>Catatan: {m.admin_note}</div> : null}
      </div>
      <div className="section card">
        <label className="field">Link meeting (Google Meet / Zoom)<input value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://meet.google.com/…" /></label>
        <label className="field">Catatan internal<textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} /></label>
        {error ? <div className="notice error">{error}</div> : null}
        <div className="actions">
          {m.status !== 'scheduled' || link.trim() !== (m.meet_link ?? '') ? <button className="btn" disabled={busy} onClick={() => act('scheduled')}>{m.status === 'scheduled' ? 'Kirim ulang link' : 'Konfirmasi & kirim link'}</button> : null}
          {m.status === 'scheduled' ? <button className="btn secondary" disabled={busy} onClick={() => act('done')}>Tandai selesai</button> : null}
          {m.status === 'new' || m.status === 'scheduled' ? <button className="btn danger" disabled={busy} onClick={() => act('cancelled')}>Batalkan</button> : null}
        </div>
      </div>
    </>
  );
}
