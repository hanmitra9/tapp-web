import { useState, type FormEvent } from 'react';
import {
  cancelSubscription, createSubscription, listCampaigns, listPlans, listSubscriptions, subscriptionCancelPreview, subscriptionPayment, upsertPlan,
  type CancelPreview, type Plan, type Subscription,
} from '../lib/api';
import { adminError } from '../lib/errors';
import { dt, idr, num } from '../lib/format';
import { useLoad } from '../lib/useLoad';
import { printInvoice } from './Finance';

// Fixed subscription terms (0069): 18% service fee, creator keeps 80% → creator rate = price × 0.656.
// Guaranteed views include the plan's bonus (0070); the bonus comes out of TAPP's margin, the creator rate stays.
const views = (p: { monthly_price: number; price_per_1k: number; bonus_pct: number }) => Math.floor(p.monthly_price * 1000 * (100 + p.bonus_pct) / (p.price_per_1k * 100));
const creatorRate = (per1k: number) => Math.floor(Math.round(per1k * 0.82) * 0.8);
const STATUS: Record<Subscription['status'], [string, string]> = {
  pending: ['Menunggu bayar', 'warning'], active: ['Aktif', 'success'], past_due: ['Telat bayar', 'danger'], cancelled: ['Berhenti', ''],
};
const day = (d: string | null) => (d ? new Date(`${d}T00:00:00`).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');

// Monthly subscriptions: plans, linking a draft clipping campaign, recording each month's payment, ending with the guarantee refund.
export function Subscriptions() {
  const plans = useLoad(listPlans, []);
  const subs = useLoad(listSubscriptions, []);
  return (
    <>
      <div className="page-head"><div><h1>Langganan</h1><p className="sub">Brand bayar tiap 30 hari untuk views yang dijamin. Clipping saja. Kreator tetap Rp984 / 1.000 views; bonus views mengurangi margin TAPP (34% tanpa bonus, ±21% dengan +20%). Views yang belum tercapai pindah ke bulan berikutnya; yang lewat 60 hari direfund tanpa potongan saat berhenti.</p></div></div>
      <Subs list={subs.data} error={subs.error} onDone={subs.reload} />
      <NewSubscription plans={plans.data ?? []} onDone={subs.reload} />
      <Plans plans={plans.data} error={plans.error} onDone={plans.reload} />
    </>
  );
}

function Subs({ list, error, onDone }: { list: Subscription[] | null; error: string | null; onDone: () => Promise<void> }) {
  const [err, setErr] = useState<string | null>(null);
  const [cancel, setCancel] = useState<{ s: Subscription; v: CancelPreview } | null>(null);
  async function pay(s: Subscription) {
    const ref = prompt(`Catat pembayaran ${idr(s.monthly_price)} dari ${s.brand_name}. Referensi transfer:`);
    if (ref === null) return;
    setErr(null);
    try { const l = await subscriptionPayment(s.id, ref, ''); printInvoice({ ...l, brand_name: s.brand_name, campaign_title: s.campaign_title }); await onDone(); }
    catch (e) { setErr(adminError(e)); }
  }
  async function preview(s: Subscription) {
    setErr(null);
    try { setCancel({ s, v: await subscriptionCancelPreview(s.id) }); } catch (e) { setErr(adminError(e)); }
  }
  return (
    <div className="card section">
      <h2 style={{ margin: 0 }}>Langganan brand</h2>
      {error || err ? <div className="notice error">{error ?? err}</div> : null}
      {list && !list.length ? <div className="empty">Belum ada langganan.</div> : null}
      {list?.length ? (
        <div style={{ overflowX: 'auto' }}>
          <table>
            <thead><tr><th>Brand / campaign</th><th>Paket</th><th>Status</th><th>Periode ini</th><th className="n">Total views</th><th>Tagihan berikut</th><th /></tr></thead>
            <tbody>{list.map((s) => {
              const g = s.progress; const pct = g.period_target ? Math.min(100, Math.round((g.period_delivered / g.period_target) * 100)) : 0;
              const behind = g.delivered < 0.7 * g.expected_now;
              return (
                <tr key={s.id}>
                  <td>{s.brand_name}<div className="sub">{s.campaign_title} · {s.campaign_status}</div></td>
                  <td>{s.plan_name}<div className="sub">{idr(s.monthly_price)} · {num(views(s))} views</div></td>
                  <td><span className={`badge ${STATUS[s.status][1]}`}>{STATUS[s.status][0]}</span>
                    {g.breach_views > 0 ? <div className="sub" style={{ color: 'var(--danger)' }}>Lewat 60 hari: kurang {num(g.breach_views)} views</div>
                      : behind && s.status === 'active' ? <div className="sub" style={{ color: 'var(--warning)' }}>Di bawah pacing</div> : null}</td>
                  <td style={{ minWidth: 160 }}>{g.period_target ? (
                    <><div className="sub">{num(g.period_delivered)} / {num(g.period_target)} ({pct}%)</div>
                      <div style={{ height: 6, background: 'var(--g150)', borderRadius: 3 }}><div style={{ width: `${pct}%`, height: 6, background: 'var(--blue)', borderRadius: 3 }} /></div>
                      <div className="sub">{day(g.period_start)} – {day(g.period_end)}</div></>) : <span className="sub">Belum dibayar</span>}</td>
                  <td className="n">{num(g.delivered)} / {num(g.target_total)}</td>
                  <td>{day(s.next_bill_at)}</td>
                  <td className="n" style={{ whiteSpace: 'nowrap' }}>{s.status !== 'cancelled' ? <>
                    <button className="btn secondary" onClick={() => pay(s)}>Catat bayar</button>{' '}
                    <button className="btn secondary" onClick={() => preview(s)}>Berhenti</button></> : <span className="sub">sejak {dt(s.created_at)}</span>}</td>
                </tr>
              );
            })}</tbody>
          </table>
        </div>
      ) : null}
      {cancel ? <CancelCard s={cancel.s} v={cancel.v} onClose={() => setCancel(null)} onDone={onDone} /> : null}
    </div>
  );
}

function CancelCard({ s, v, onClose, onDone }: { s: Subscription; v: CancelPreview; onClose: () => void; onDone: () => Promise<void> }) {
  const [reference, setReference] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function go(e: FormEvent) {
    e.preventDefault();
    if (!confirm(`Hentikan langganan ${s.brand_name} dan refund ${idr(v.net)}? Campaign ditutup.`)) return;
    setBusy(true); setError(null);
    try {
      const r = await cancelSubscription(s.id, reference.trim(), '');
      if (r.ledger) printInvoice({ ...r.ledger, brand_name: s.brand_name, campaign_title: s.campaign_title });
      onClose(); await onDone();
    } catch (err) { setError(adminError(err)); } finally { setBusy(false); }
  }
  return (
    <form className="card section" onSubmit={go} style={{ display: 'grid', gap: 12 }}>
      <h3 style={{ margin: 0 }}>Berhenti langganan · {s.brand_name}</h3>
      <dl className="kv">
        <div><dt>Views terkirim / dijamin</dt><dd>{num(v.delivered)} / {num(v.target_total)}</dd></div>
        <div><dt>Sisa setoran</dt><dd>{idr(v.unspent_deposit)}</dd></div>
        <div><dt>Jaminan lewat 60 hari (tanpa potongan)</dt><dd>{idr(v.breach_refund)}</dd></div>
        <div><dt>Sisa lain setelah fee 18%</dt><dd>{idr(v.rest_base)}</dd></div>
        <div><dt>Biaya penarikan ({Number(v.fee_pct)}%)</dt><dd>−{idr(v.fee)}</dd></div>
        <div><dt>Dikembalikan</dt><dd><b>{idr(v.net)}</b></dd></div>
      </dl>
      {v.pending_reviews ? <div className="notice warning">{v.pending_reviews} klip masih menunggu review. Selesaikan dulu.</div> : null}
      <label className="field">Referensi transfer refund<input value={reference} onChange={(e) => setReference(e.target.value)} /></label>
      {error ? <div className="notice error">{error}</div> : null}
      <div className="actions"><button type="button" className="btn secondary" onClick={onClose}>Batal</button>
        <button className="btn danger" disabled={busy || v.pending_reviews > 0}>{busy ? 'Memproses…' : `Hentikan & refund ${idr(v.net)}`}</button></div>
    </form>
  );
}

function NewSubscription({ plans, onDone }: { plans: Plan[]; onDone: () => Promise<void> }) {
  const drafts = useLoad(() => listCampaigns(['draft']), []);
  const [campaign, setCampaign] = useState('');
  const [plan, setPlan] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const options = drafts.data?.filter((c) => c.content_type === 'clipping') ?? [];
  async function save(e: FormEvent) {
    e.preventDefault(); setError(null);
    if (!campaign || !plan) return setError('Pilih campaign dan paket.');
    setBusy(true);
    try { await createSubscription(campaign, plan); setCampaign(''); await Promise.all([onDone(), drafts.reload()]); }
    catch (err) { setError(adminError(err)); } finally { setBusy(false); }
  }
  return (
    <form className="card section" onSubmit={save} style={{ display: 'grid', gap: 12 }}>
      <h2 style={{ margin: 0 }}>Langganan baru</h2>
      <p className="sub" style={{ margin: 0 }}>Buat dulu campaign clipping (draft) untuk brand-nya di menu Campaign: brief, platform, materi. Hubungkan ke paket di sini, catat pembayaran pertama, lalu aktifkan campaign.</p>
      <div className="grid2">
        <label className="field">Campaign draft (clipping)<select value={campaign} onChange={(e) => setCampaign(e.target.value)}>
          <option value="">Pilih campaign</option>{options.map((c) => <option key={c.id} value={c.id}>{c.brand_name} · {c.title}</option>)}</select></label>
        <label className="field">Paket<select value={plan} onChange={(e) => setPlan(e.target.value)}>
          <option value="">Pilih paket</option>{plans.filter((p) => p.active).map((p) => <option key={p.id} value={p.id}>{p.name} · {idr(p.monthly_price)} · {num(views(p))} views</option>)}</select></label>
      </div>
      {error ? <div className="notice error">{error}</div> : null}
      <div className="actions"><button className="btn" disabled={busy}>{busy ? 'Menyimpan…' : 'Hubungkan ke paket'}</button></div>
    </form>
  );
}

function Plans({ plans, error, onDone }: { plans: Plan[] | null; error: string | null; onDone: () => Promise<void> }) {
  const [edit, setEdit] = useState<Partial<Plan> | null>(null);
  const [err, setErr] = useState<string | null>(null);
  async function save(e: FormEvent) {
    e.preventDefault(); if (!edit) return; setErr(null);
    try { await upsertPlan(edit.id ?? null, edit.name ?? '', Number(edit.monthly_price) || 0, Number(edit.price_per_1k) || 0, edit.active ?? true, Number(edit.bonus_pct) || 0); setEdit(null); await onDone(); }
    catch (x) { setErr(adminError(x)); }
  }
  return (
    <div className="card section">
      <div className="actions" style={{ justifyContent: 'space-between' }}>
        <h2 style={{ margin: 0 }}>Paket</h2>
        <button className="btn secondary" onClick={() => setEdit({ name: '', monthly_price: 0, price_per_1k: 1500, bonus_pct: 20, active: true })}>Paket baru</button>
      </div>
      {error ? <div className="notice error">{error}</div> : null}
      {plans ? (
        <table>
          <thead><tr><th>Paket</th><th className="n">Harga / bulan</th><th className="n">Per 1.000 views</th><th className="n">Bonus</th><th className="n">Views dijamin</th><th className="n">Kreator / 1.000</th><th className="n">Margin TAPP</th><th /></tr></thead>
          <tbody>{plans.map((p) => (
            <tr key={p.id} style={p.active ? undefined : { opacity: 0.5 }}>
              <td>{p.name}{p.active ? '' : ' (nonaktif)'}</td><td className="n">{idr(p.monthly_price)}</td><td className="n">{idr(p.price_per_1k)}</td><td className="n">+{p.bonus_pct}%</td>
              <td className="n">{num(views(p))}</td><td className="n">{idr(creatorRate(p.price_per_1k))}</td>
              <td className="n">{idr(p.monthly_price - Math.floor(p.monthly_price * 0.656 * (1 + p.bonus_pct / 100)))} ({Math.round((1 - 0.656 * (1 + p.bonus_pct / 100)) * 100)}%)</td>
              <td className="n"><button className="btn secondary" onClick={() => setEdit(p)}>Ubah</button></td>
            </tr>
          ))}</tbody>
        </table>
      ) : null}
      {edit ? (
        <form onSubmit={save} style={{ display: 'grid', gap: 12, marginTop: 12 }}>
          <div className="grid3">
            <label className="field">Nama<input value={edit.name ?? ''} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></label>
            <label className="field">Harga / bulan (Rp)<input inputMode="numeric" value={edit.monthly_price || ''} onChange={(e) => setEdit({ ...edit, monthly_price: Number(e.target.value.replace(/\D/g, '')) })} /></label>
            <label className="field">Harga per 1.000 views (Rp)<input inputMode="numeric" value={edit.price_per_1k || ''} onChange={(e) => setEdit({ ...edit, price_per_1k: Number(e.target.value.replace(/\D/g, '')) })} /></label>
            <label className="field">Bonus views (%, maks 25)<input inputMode="numeric" value={edit.bonus_pct ?? 0} onChange={(e) => setEdit({ ...edit, bonus_pct: Math.min(25, Number(e.target.value.replace(/\D/g, '')) || 0) })} /></label>
          </div>
          <label className="check"><input type="checkbox" checked={edit.active ?? true} onChange={(e) => setEdit({ ...edit, active: e.target.checked })} /> Aktif (bisa dipilih untuk langganan baru)</label>
          <p className="sub" style={{ margin: 0 }}>Bonus menambah views dijamin tanpa mengubah harga; bayaran kreator tetap, margin TAPP yang berkurang. Langganan yang sudah jalan tetap memakai harga & bonus saat dibuat.</p>
          {err ? <div className="notice error">{err}</div> : null}
          <div className="actions"><button type="button" className="btn secondary" onClick={() => setEdit(null)}>Batal</button><button className="btn">Simpan paket</button></div>
        </form>
      ) : null}
    </div>
  );
}
