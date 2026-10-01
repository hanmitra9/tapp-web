import { NavLink, Outlet } from 'react-router-dom';
import { useAdmin } from '../auth';
import { countNewMeetings, fetchCounts } from '../lib/api';
import { useLoad } from '../lib/useLoad';

export function Layout() {
  const { admin, signOut } = useAdmin();
  const counts = useLoad(fetchCounts, []);
  const meetings = useLoad(countNewMeetings, []);
  const c = counts.data;
  const Count = ({ n }: { n: number | undefined }) => (n ? <span className="count">{n}</span> : null);
  return (
    <div className="shell">
      <nav className="nav" aria-label="Navigasi admin">
        <div className="nav-brand"><img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" />TAPP Control</div>
        <NavLink to="/" end>Ringkasan</NavLink>
        <NavLink to="/submissions">Verifikasi <Count n={c ? c.pending_review + c.flagged : undefined} /></NavLink>
        <NavLink to="/performance">Performa <Count n={c ? c.awaiting_first_metrics + c.stale_metrics + (c.auto_held ?? 0) : undefined} /></NavLink>
        <NavLink to="/creators">Kreator <Count n={c?.creators_to_review} /></NavLink>
        <NavLink to="/payouts">Pencairan <Count n={c?.payouts_open} /></NavLink>
        <NavLink to="/campaigns">Campaign <Count n={c?.campaigns_pending} /></NavLink>
        <NavLink to="/brands">Brand</NavLink>
        <NavLink to="/disputes">Keberatan <Count n={c?.disputes_open} /></NavLink>
        <NavLink to="/support">Support <Count n={c?.tickets_open} /></NavLink>
        <NavLink to="/meetings">Meeting <Count n={meetings.data ?? undefined} /></NavLink>
        <NavLink to="/audit">Audit log</NavLink>
        <div className="nav-foot">
          <span>{admin.name ?? admin.email}</span>
          <button className="btn secondary" onClick={signOut}>Keluar</button>
        </div>
      </nav>
      <main className="main"><Outlet context={{ refreshCounts: () => { counts.reload(); meetings.reload(); } }} /></main>
    </div>
  );
}
