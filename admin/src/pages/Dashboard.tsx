import { Link } from 'react-router-dom';
import { fetchCounts, fetchFunnel, fetchWeekly, type Funnel } from '../lib/api';
import { num } from '../lib/format';
import { useLoad } from '../lib/useLoad';

const STEPS: { k: keyof Funnel; l: string }[] = [
  { k: 'signed_up', l: 'Daftar' }, { k: 'onboarded', l: 'Selesai onboarding' }, { k: 'approved', l: 'Disetujui' },
  { k: 'joined_campaign', l: 'Gabung campaign' }, { k: 'submitted', l: 'Submit konten' }, { k: 'approved_submission', l: 'Submission disetujui' },
  { k: 'earned', l: 'Punya penghasilan' }, { k: 'paid_out', l: 'Sudah dicairkan' },
];
const KEY_EVENTS = ['signup_completed', 'onboarding_completed', 'campaign_joined', 'submission_submitted', 'submission_approved', 'payout_completed'];

export function Dashboard() {
  const counts = useLoad(fetchCounts, []);
  const funnel = useLoad(fetchFunnel, []);
  const weekly = useLoad(fetchWeekly, []);
  const d = counts.data;
  const items = d ? [
    { v: d.pending_review, l: 'Submission menunggu review', to: '/submissions?q=review' },
    { v: d.flagged, l: 'Submission ditandai', to: '/submissions?q=flagged' },
    { v: d.awaiting_first_metrics, l: 'Disetujui, belum ada metrik', to: '/performance?q=metrics' },
    { v: d.stale_metrics, l: 'Metrik lebih dari 24 jam', to: '/performance?q=tracking' },
    { v: d.creators_to_review, l: 'Kreator menunggu persetujuan', to: '/creators' },
    { v: d.payouts_open, l: 'Pencairan belum selesai', to: '/payouts' },
    { v: d.campaigns_pending, l: 'Campaign menunggu persetujuan', to: '/campaigns' },
    { v: d.disputes_open, l: 'Keberatan terbuka', to: '/disputes' },
    { v: d.tickets_open, l: 'Tiket support terbuka', to: '/support' },
  ] : [];
  const f = funnel.data;
  const top = f ? Math.max(f.signed_up, 1) : 1;
  const weeks = [...new Set((weekly.data ?? []).map((r) => r.week))].slice(0, 6);
  const cell = (w: string, e: string) => weekly.data?.find((r) => r.week === w && r.event === e)?.users ?? 0;

  return (
    <>
      <div className="page-head"><div><h1>Ringkasan</h1><p className="sub">Pekerjaan operasional yang menunggu tindakan, dan kesehatan funnel kreator.</p></div></div>
      {counts.error ? <div className="notice error">{counts.error}</div> : null}
      <div className="stats">
        {items.map((i) => <Link key={i.l} to={i.to} className="stat"><span className="v">{i.v}</span><span className="l">{i.l}</span></Link>)}
      </div>

      <div className="section panel">
        <h2>Funnel aktivasi kreator</h2>
        <p className="sub" style={{ margin: 0 }}>Jumlah kreator yang pernah mencapai tiap tahap. Persentase dihitung dari tahap sebelumnya.</p>
        {funnel.error ? <div className="notice error">{funnel.error}</div> : null}
        {f ? (
          <table>
            <tbody>{STEPS.map((s, i) => {
              const v = f[s.k]; const prev = i ? f[STEPS[i - 1]!.k] : v;
              return (
                <tr key={s.k}>
                  <td style={{ width: 200 }}>{s.l}</td>
                  <td><div style={{ height: 10, width: `${Math.max(1, (v / top) * 100)}%`, background: 'linear-gradient(90deg, var(--blue-deep), var(--blue), var(--blue-light))', borderRadius: 999 }} /></td>
                  <td className="n" style={{ width: 80 }}>{num(v)}</td>
                  <td className="n sub" style={{ width: 80 }}>{i && prev ? `${Math.round((v / prev) * 100)}%` : ''}</td>
                </tr>
              );
            })}</tbody>
          </table>
        ) : null}
      </div>

      <div className="section panel">
        <h2>Kreator aktif per minggu</h2>
        <p className="sub" style={{ margin: 0 }}>Kreator unik yang melakukan tiap aksi (dari event server).</p>
        {weekly.error ? <div className="notice error">{weekly.error}</div> : null}
        {weeks.length ? (
          <table>
            <thead><tr><th>Minggu</th>{KEY_EVENTS.map((e) => <th key={e} className="n">{e.replace(/_/g, ' ')}</th>)}</tr></thead>
            <tbody>{weeks.map((w) => (
              <tr key={w}><td>{new Date(w).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}</td>
                {KEY_EVENTS.map((e) => <td key={e} className="n">{num(cell(w, e))}</td>)}</tr>
            ))}</tbody>
          </table>
        ) : weekly.data ? <p className="sub">Belum ada aktivitas.</p> : null}
      </div>
    </>
  );
}
