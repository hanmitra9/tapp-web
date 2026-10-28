import { useState, type FormEvent } from 'react';
import { financeMonthly, latestUptime, listBrands, listCampaigns, listLedger, recordDeposit, type FinanceMonth, type LedgerEntry } from '../lib/api';
import { adminError } from '../lib/errors';
import { ago, dt, idr } from '../lib/format';
import { useLoad } from '../lib/useLoad';

const month = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString('id-ID', { month: 'short', year: 'numeric' });
// TAPP's income for a month: brand service fees + creator fees + withdrawal fees + refund fees, minus level/referral bonuses.
const income = (m: FinanceMonth) => m.service_fees + m.creator_fees + m.withdrawal_fees + m.refund_fees - m.bonuses;

// Finance (0068): monthly recap, brand deposits with invoices, refunds, and service status.
export function Finance() {
  const recap = useLoad(() => financeMonthly(12), []);
  const ledger = useLoad(listLedger, []);
  const uptime = useLoad(latestUptime, []);
  const cur = recap.data?.[0];

  return (
    <>
      <div className="page-head"><div><h1>Keuangan</h1><p className="sub">Setoran brand, fee, penarikan kreator, dan refund per bulan (WIB). Setoran dicatat manual setelah dana masuk.</p></div></div>

      <div className="stats">
        <div className="stat"><span className="l">Pendapatan TAPP bulan ini</span><span className="v">{cur ? idr(income(cur)) : '—'}</span></div>
        <div className="stat"><span className="l">Setoran brand</span><span className="v">{cur ? idr(cur.deposits) : '—'}</span></div>
        <div className="stat"><span className="l">Dibayar ke kreator</span><span className="v">{cur ? idr(cur.withdrawals_paid) : '—'}</span></div>
        <Status checks={uptime.data} />
      </div>

      <div className="card section">
        <div className="actions" style={{ justifyContent: 'space-between' }}>
          <h2 style={{ margin: 0 }}>Rekap bulanan</h2>
          <button className="btn secondary" disabled={!recap.data?.length} onClick={() => recap.data && csv(recap.data)}>Unduh CSV</button>
        </div>
        {recap.error ? <div className="notice error">{recap.error}</div> : null}
        {recap.data ? (
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead><tr><th>Bulan</th><th className="n">Setoran</th><th className="n">Fee brand</th><th className="n">Fee kreator</th><th className="n">Biaya tarik</th>
                <th className="n">Bonus level/referral</th><th className="n">Fee refund</th><th className="n">Pendapatan TAPP</th><th className="n">Dibayar ke kreator</th><th className="n">Refund dikirim</th></tr></thead>
              <tbody>{recap.data.map((m) => (
                <tr key={m.month}><td>{month(m.month)}</td><td className="n">{idr(m.deposits)}</td><td className="n">{idr(m.service_fees)}</td><td className="n">{idr(m.creator_fees)}</td>
                  <td className="n">{idr(m.withdrawal_fees)}</td><td className="n">−{idr(m.bonuses)}</td><td className="n">{idr(m.refund_fees)}</td>
                  <td className="n"><b>{idr(income(m))}</b></td><td className="n">{idr(m.withdrawals_paid)}</td><td className="n">{idr(m.refunds_paid)}</td></tr>
              ))}</tbody>
            </table>
          </div>
        ) : null}
        <p className="sub" style={{ margin: 0 }}>Fee kreator dihitung saat klip disetujui; biaya tarik dan bonus saat penarikan dibayar.</p>
      </div>

      <DepositForm onDone={ledger.reload} />

      <div className="card section">
        <h2 style={{ margin: 0 }}>Setoran & refund</h2>
        {ledger.error ? <div className="notice error">{ledger.error}</div> : null}
        {ledger.data && !ledger.data.length ? <div className="empty">Belum ada setoran yang dicatat.</div> : null}
        {ledger.data?.length ? (
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead><tr><th>No.</th><th>Tanggal</th><th>Brand / campaign</th><th>Jenis</th><th className="n">Nominal</th><th className="n">Fee</th><th className="n">Bersih</th><th /></tr></thead>
              <tbody>{ledger.data.map((l) => (
                <tr key={l.id}><td>{l.invoice_no}</td><td>{dt(l.created_at)}</td><td>{l.brand_name}{l.campaign_title ? <div className="sub">{l.campaign_title}</div> : null}</td>
                  <td><span className={`badge ${l.kind === 'deposit' ? 'success' : 'warning'}`}>{l.kind === 'deposit' ? 'Setoran' : 'Refund'}</span></td>
                  <td className="n">{idr(l.amount)}</td><td className="n">{idr(l.fee)} ({Number(l.fee_pct)}%)</td><td className="n">{idr(l.net)}</td>
                  <td className="n"><button className="btn secondary" onClick={() => printInvoice(l)}>{l.kind === 'deposit' ? 'Invoice' : 'Bukti refund'}</button></td></tr>
              ))}</tbody>
            </table>
          </div>
        ) : null}
      </div>
    </>
  );
}

function Status({ checks }: { checks: { target: string; ok: boolean | null; created_at: string }[] | null }) {
  const last = (t: string) => checks?.find((c) => c.target === t);
  const site = last('site'), mailer = last('mailer');
  const line = (name: string, c?: { ok: boolean | null; created_at: string }) =>
    <span className="l">{c ? (c.ok ? '● ' : '○ ') : ''}{name}: {c ? `${c.ok ? 'normal' : 'gagal'} · ${ago(c.created_at)}` : 'belum dicek'}</span>;
  const down = site?.ok === false || mailer?.ok === false;
  return (
    <div className="stat" style={down ? { boxShadow: 'inset 0 0 0 1px var(--danger, #ff5a5f)' } : undefined}>
      <span className="l">Status layanan (cek tiap 5 menit)</span>
      <span className="v" style={{ fontSize: 22 }}>{!checks ? '—' : down ? 'Ada gangguan' : 'Semua normal'}</span>
      {line('Website', site)}{line('Mailer', mailer)}
    </div>
  );
}

function DepositForm({ onDone }: { onDone: () => Promise<void> }) {
  const brands = useLoad(listBrands, []);
  const campaigns = useLoad(() => listCampaigns(['draft', 'pending_approval', 'active', 'paused', 'ending']), []);
  const [brand, setBrand] = useState('');
  const [campaign, setCampaign] = useState('');
  const [amount, setAmount] = useState('');
  const [reference, setReference] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<LedgerEntry | null>(null);
  const n = Number(amount.replace(/\D/g, '')) || 0;
  const camp = campaigns.data?.find((c) => c.id === campaign);
  const feePct = camp?.budget_fee_pct != null ? Number(camp.budget_fee_pct) : 18;
  const fee = Math.round(n * feePct / 100);

  async function save(e: FormEvent) {
    e.preventDefault(); setError(null); setSaved(null);
    if (!brand) return setError('Pilih brand.');
    if (n <= 0) return setError('Isi nominal setoran.');
    setBusy(true);
    try {
      const r = await recordDeposit(brand, campaign || null, n, reference.trim(), note.trim());
      setSaved(r); setAmount(''); setReference(''); setNote(''); await onDone();
    } catch (err) { setError(adminError(err)); } finally { setBusy(false); }
  }
  return (
    <form className="card section" onSubmit={save} style={{ display: 'grid', gap: 12 }}>
      <h2 style={{ margin: 0 }}>Catat setoran brand</h2>
      <p className="sub" style={{ margin: 0 }}>Hanya pencatatan dan invoice. Budget campaign tetap diatur dari kartu "Atur budget" di halaman Campaign.</p>
      <div className="grid3">
        <label className="field">Brand<select value={brand} onChange={(e) => { setBrand(e.target.value); setCampaign(''); }}>
          <option value="">Pilih brand</option>{brands.data?.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></label>
        <label className="field">Campaign (opsional)<select value={campaign} onChange={(e) => setCampaign(e.target.value)} disabled={!brand}>
          <option value="">—</option>{campaigns.data?.filter((c) => c.brand_id === brand).map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}</select></label>
        <label className="field">Nominal diterima (Rp)<input inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="10000000" /></label>
        <label className="field">Referensi transfer<input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="BCA 28/10 · no. ref" /></label>
        <label className="field">Catatan<input value={note} onChange={(e) => setNote(e.target.value)} /></label>
      </div>
      {n > 0 ? <p className="sub" style={{ margin: 0 }}>Fee layanan {feePct}% = {idr(fee)} · budget campaign {idr(n - fee)}</p> : null}
      {error ? <div className="notice error">{error}</div> : null}
      {saved ? <div className="notice">Tersimpan sebagai {saved.invoice_no}. <button type="button" className="btn secondary" onClick={() => printInvoice({ ...saved, brand_name: brands.data?.find((b) => b.id === saved.brand_id)?.name ?? '', campaign_title: camp?.title ?? null })}>Cetak invoice</button></div> : null}
      <div className="actions"><button className="btn" disabled={busy}>{busy ? 'Menyimpan…' : 'Simpan setoran'}</button></div>
    </form>
  );
}

function csv(rows: FinanceMonth[]) {
  const head = ['Bulan', 'Setoran', 'Fee brand', 'Fee kreator', 'Biaya tarik', 'Bonus', 'Fee refund', 'Pendapatan TAPP', 'Dibayar ke kreator', 'Refund dikirim'];
  const body = rows.map((m) => [m.month.slice(0, 7), m.deposits, m.service_fees, m.creator_fees, m.withdrawal_fees, m.bonuses, m.refund_fees, income(m), m.withdrawals_paid, m.refunds_paid]);
  const blob = new Blob(['﻿' + [head, ...body].map((r) => r.join(',')).join('\n')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `tapp-keuangan-${rows[0]?.month.slice(0, 7) ?? ''}.csv`; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

const esc = (s: string | number | null | undefined) => String(s ?? '').replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]!);
// Invoice / refund note: a print-ready page; the browser's print dialog saves it as PDF.
export function printInvoice(l: Pick<LedgerEntry, 'kind' | 'invoice_no' | 'created_at' | 'brand_name' | 'campaign_title' | 'amount' | 'fee_pct' | 'fee' | 'net' | 'reference' | 'note'>) {
  const w = window.open('', '_blank');
  if (!w) return;
  const dep = l.kind === 'deposit';
  const rows: [string, string][] = dep
    ? [['Setoran diterima', idr(l.amount)], [`Biaya layanan platform (${Number(l.fee_pct)}%)`, `−${idr(l.fee)}`], ['Budget campaign', idr(l.net)]]
    : [['Sisa budget', idr(l.amount)], [`Biaya penarikan dana (${Number(l.fee_pct)}%)`, `−${idr(l.fee)}`], ['Dikembalikan ke brand', idr(l.net)]];
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(l.invoice_no)}</title><style>
    *{box-sizing:border-box}body{font:14px/1.5 -apple-system,Segoe UI,Inter,Arial,sans-serif;color:#0B1220;margin:40px;max-width:720px}
    header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #0C65C4;padding-bottom:14px}
    .logo{font-weight:800;font-size:24px;color:#0C65C4;letter-spacing:-.5px}.muted{color:#5B6475;font-size:12.5px}
    h1{font-size:20px;margin:24px 0 4px}table{width:100%;border-collapse:collapse;margin-top:18px}td{padding:10px 0;border-bottom:1px solid #E8EDF4}
    td:last-child{text-align:right;font-variant-numeric:tabular-nums}tr:last-child td{font-weight:700;font-size:16px;border-bottom:2px solid #0B1220}
    .meta{display:grid;grid-template-columns:1fr 1fr;gap:6px 24px;margin-top:16px}footer{margin-top:36px;color:#8A93A3;font-size:12px}@page{margin:16mm}</style></head><body>
    <header><div><div class="logo">TAPP</div><div class="muted">tappcreators.com</div></div>
      <div style="text-align:right"><b>${dep ? 'INVOICE' : 'BUKTI REFUND'}</b><div class="muted">${esc(l.invoice_no)}</div>
      <div class="muted">${esc(new Date(l.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }))}</div></div></header>
    <h1>${esc(l.brand_name)}</h1>${l.campaign_title ? `<div class="muted">Campaign: ${esc(l.campaign_title)}</div>` : ''}
    <table>${rows.map(([k, v]) => `<tr><td>${esc(k)}</td><td>${esc(v)}</td></tr>`).join('')}</table>
    <div class="meta">${l.reference ? `<div><div class="muted">Referensi transfer</div>${esc(l.reference)}</div>` : ''}${l.note ? `<div><div class="muted">Catatan</div>${esc(l.note)}</div>` : ''}</div>
    <footer>${dep ? 'Budget campaign dipakai hanya untuk views yang lolos verifikasi. Sisa budget dapat ditarik kembali sesuai Syarat Layanan TAPP.'
      : 'Refund atas sisa budget yang belum terpakai, sesuai Syarat Layanan TAPP.'}</footer>
    <script>window.onload=()=>setTimeout(()=>window.print(),300)</script></body></html>`);
  w.document.close();
}
