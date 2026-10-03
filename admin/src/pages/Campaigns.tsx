import { useEffect, useState, type FormEvent } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  addAssetLink, adjustBudget, BANNER_RULES, checkBanner, deleteAsset, ensureBrand, removeBanner, uploadBanner, getCampaignFull, listBrands, listCampaigns, platformBreakdown, setCampaignStatus,
  submitForApproval, updateCampaignCopy, uploadAsset, upsertCampaignDraft, type AdminCampaign, type CampaignFull, type CampaignStatus,
  fetchHashtagStats, refreshHashtag, setCampaignHashtag,
} from '../lib/api';
import { adminError } from '../lib/errors';
import { ago, dt, idr, num, toLocalInput } from '../lib/format';
import { CAMPAIGN_TYPES, campaignTypeLabel, label, PLATFORMS } from '../lib/options';
import { useLoad } from '../lib/useLoad';

const TABS: { key: string; label: string; statuses: CampaignStatus[] }[] = [
  { key: 'pending', label: 'Menunggu persetujuan', statuses: ['pending_approval'] },
  { key: 'active', label: 'Aktif', statuses: ['active', 'ending', 'paused'] },
  { key: 'draft', label: 'Draft', statuses: ['draft'] },
  { key: 'done', label: 'Selesai', statuses: ['completed', 'cancelled', 'archived'] },
];
export const CSTATUS: Record<CampaignStatus, { t: string; tone: string }> = {
  draft: { t: 'Draft', tone: '' }, pending_approval: { t: 'Menunggu persetujuan', tone: 'warning' }, active: { t: 'Aktif', tone: 'success' },
  paused: { t: 'Dijeda', tone: 'warning' }, ending: { t: 'Segera berakhir', tone: 'warning' }, completed: { t: 'Selesai', tone: 'blue' },
  archived: { t: 'Diarsipkan', tone: '' }, cancelled: { t: 'Dibatalkan', tone: 'danger' },
};
// Mirrors admin_set_campaign_status. `reason` = required.
const MOVES: Record<CampaignStatus, { to: CampaignStatus | 'submit'; label: string; cls: string; reason?: boolean }[]> = {
  draft: [{ to: 'submit', label: 'Ajukan untuk persetujuan', cls: '' }],
  pending_approval: [{ to: 'active', label: 'Setujui & aktifkan', cls: '' }, { to: 'draft', label: 'Kembalikan ke draft', cls: 'secondary', reason: true }],
  active: [{ to: 'paused', label: 'Jeda', cls: 'warn', reason: true }, { to: 'ending', label: 'Tutup pendaftaran', cls: 'secondary' },
    { to: 'completed', label: 'Selesaikan', cls: 'secondary' }, { to: 'cancelled', label: 'Batalkan', cls: 'danger', reason: true }],
  paused: [{ to: 'active', label: 'Aktifkan lagi', cls: '' }, { to: 'ending', label: 'Tutup pendaftaran', cls: 'secondary' },
    { to: 'completed', label: 'Selesaikan', cls: 'secondary' }, { to: 'cancelled', label: 'Batalkan', cls: 'danger', reason: true }],
  ending: [{ to: 'active', label: 'Buka lagi', cls: 'secondary' }, { to: 'completed', label: 'Selesaikan', cls: '' }],
  completed: [{ to: 'archived', label: 'Arsipkan', cls: 'secondary' }],
  cancelled: [{ to: 'archived', label: 'Arsipkan', cls: 'secondary' }],
  archived: [],
};

export function Campaigns() {
  const { refreshCounts } = useOutletContext<{ refreshCounts: () => void }>();
  const [tab, setTab] = useState(TABS[0]!);
  const [selected, setSelected] = useState<string | 'new' | null>(null);
  const list = useLoad(() => listCampaigns(tab.statuses), [tab.key]);
  useEffect(() => setSelected(null), [tab.key]);
  const after = async (focus?: string) => { await list.reload(); refreshCounts(); if (focus) setSelected(focus); };

  return (
    <>
      <div className="page-head">
        <div><h1>Campaign</h1><p className="sub">Buat, setujui, dan kelola campaign. Syarat komersial terkunci setelah draft; budget diubah lewat "Atur budget".</p></div>
        <button className="btn" onClick={() => setSelected('new')}>Buat campaign</button>
      </div>
      <div className="tabs" role="tablist">
        {TABS.map((t) => <button key={t.key} role="tab" aria-selected={tab.key === t.key} className={`tab ${tab.key === t.key ? 'on' : ''}`} onClick={() => setTab(t)}>{t.label}</button>)}
      </div>
      <div className="split">
        <div className="list">
          {list.error ? <div className="notice error" style={{ margin: 12 }}>{list.error}</div> : null}
          {list.data && !list.data.length ? <div className="empty">Tidak ada campaign di sini.</div> : null}
          {list.data?.map((c) => (
            <button key={c.id} className={`list-item ${selected === c.id ? 'on' : ''}`} onClick={() => setSelected(c.id)}>
              <div className="row"><span className="title">{c.title}</span><span className={`badge ${CSTATUS[c.status].tone}`}>{CSTATUS[c.status].t}</span></div>
              <div className="meta">{c.brand_name} · {idr(c.cpm)}/1K · sisa {idr(c.remaining)}</div>
              {c.pending_review ? <div className="meta">{c.pending_review} submission menunggu review</div> : null}
            </button>
          ))}
        </div>
        <div className="detail">
          {selected === 'new' ? <Editor id={null} onSaved={(id) => after(id)} onCancel={() => setSelected(null)} />
            : selected ? <Detail key={selected} c={list.data?.find((x) => x.id === selected) ?? null} id={selected} onChanged={() => after(selected)} />
            : <div className="empty">Pilih campaign atau buat yang baru.</div>}
        </div>
      </div>
    </>
  );
}

function Detail({ id, c, onChanged }: { id: string; c: AdminCampaign | null; onChanged: () => Promise<void> }) {
  const full = useLoad(() => getCampaignFull(id), [id]);
  const breakdown = useLoad(() => platformBreakdown(id), [id]);
  const [editing, setEditing] = useState(false);
  if (full.error) return <div className="notice error">{full.error}</div>;
  if (!full.data) return <div className="sub">Memuat…</div>;
  const f = full.data;
  const refresh = async () => { await full.reload(); await breakdown.reload(); await onChanged(); };
  if (editing) return f.status === 'draft'
    ? <Editor id={f.id} initial={f} onSaved={async () => { setEditing(false); await refresh(); }} onCancel={() => setEditing(false)} />
    : <CopyEditor f={f} onDone={async () => { setEditing(false); await refresh(); }} onCancel={() => setEditing(false)} />;

  const used = c && c.budget ? Math.min(100, Math.round((c.earned / c.budget) * 100)) : 0;
  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
        <div><h2>{f.title}</h2><p className="sub">{c?.brand_name} · {campaignTypeLabel(f.category)} · {f.platforms.map((p) => label(PLATFORMS, p.platform)).join(', ')}</p></div>
        <span className={`badge ${CSTATUS[f.status].tone}`}>{CSTATUS[f.status].t}</span>
      </div>
      {c?.status_reason ? <div className="notice warn" style={{ marginTop: 12 }}>Catatan status: {c.status_reason}</div> : null}

      {c ? (
        <div className="section">
          <div className="stats">
            {[['Kreator bergabung', num(c.creators_joined)], ['Submission', num(c.submissions)], ['Disetujui', num(c.approved)],
              ['Menunggu review', num(c.pending_review)], ['Qualified views', num(c.qualified_views)],
              ['CPV efektif', c.qualified_views ? `Rp${(c.earned / c.qualified_views).toFixed(2)}` : '—']].map(([l, v]) => (
              <div key={l} className="stat"><span className="v" style={{ fontSize: 22 }}>{v}</span><span className="l">{l}</span></div>
            ))}
          </div>
          <div className="preview">
            <span>Budget: {idr(c.earned)} dialokasikan dari {idr(c.budget)} ({used}%) · dibayar {idr(c.paid)}{c.budget_override ? ' · override aktif' : ''}</span>
            <div style={{ height: 6, background: 'var(--g150)', borderRadius: 3 }}><div style={{ width: `${used}%`, height: 6, background: used >= 90 ? 'var(--warning)' : 'var(--blue)', borderRadius: 3 }} /></div>
          </div>
        </div>
      ) : null}

      <BannerCard f={f} onDone={refresh} />
      <HashtagCard f={f} onDone={refresh} />
      <StatusActions f={f} onDone={refresh} />
      {f.status !== 'draft' && c ? <BudgetCard c={c} onDone={refresh} /> : null}

      <div className="section">
        <div style={{ display: 'flex', justifyContent: 'space-between' }}><h3>Brief</h3><button className="btn secondary" onClick={() => setEditing(true)}>{f.status === 'draft' ? 'Ubah draft' : 'Ubah teks'}</button></div>
        <dl className="kv">
          <div><dt>CPM</dt><dd>{idr(f.cpm)} / 1.000</dd></div>
          <div><dt>Minimum views</dt><dd>{num(f.min_views_to_qualify)}</dd></div>
          <div><dt>Maks per klip</dt><dd>{f.max_earning_per_submission ? idr(Number(f.max_earning_per_submission)) : '—'}</dd></div>
          <div><dt>Mulai</dt><dd>{dt(f.starts_at)}</dd></div>
          <div><dt>Deadline submit</dt><dd>{dt(f.submission_deadline)}</dd></div>
          <div><dt>Berakhir</dt><dd>{dt(f.ends_at)}</dd></div>
        </dl>
        {f.objective ? <p style={{ margin: 0 }}><strong>Tujuan:</strong> {f.objective}</p> : null}
        {f.description ? <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{f.description}</p> : null}
        {f.rules.length ? <ul style={{ margin: 0 }}>{f.rules.map((r, i) => <li key={i}><span className="sub">{r.kind}</span> — {r.body}</li>)}</ul> : null}
      </div>

      {breakdown.data?.length ? (
        <div className="section">
          <h3>Per platform</h3>
          <table><thead><tr><th>Platform</th><th className="n">Submission</th><th className="n">Disetujui</th><th className="n">Qualified views</th><th className="n">Penghasilan kreator</th></tr></thead>
            <tbody>{breakdown.data.map((b) => <tr key={b.platform}><td>{label(PLATFORMS, b.platform)}</td><td className="n">{num(b.submissions)}</td><td className="n">{num(b.approved)}</td><td className="n">{num(b.qualified_views)}</td><td className="n">{idr(b.earned)}</td></tr>)}</tbody>
          </table>
        </div>
      ) : null}

      <Assets f={f} onDone={refresh} />
    </>
  );
}

function StatusActions({ f, onDone }: { f: CampaignFull; onDone: () => Promise<void> }) {
  const [move, setMove] = useState<(typeof MOVES)[CampaignStatus][number] | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!MOVES[f.status].length) return null;
  async function confirm() {
    if (!move) return;
    if (move.reason && !reason.trim()) return setError('Alasan wajib diisi.');
    setBusy(true); setError(null);
    try {
      if (move.to === 'submit') await submitForApproval(f.id);
      else await setCampaignStatus(f.id, move.to, reason.trim() || null);
      setMove(null); setReason(''); await onDone();
    } catch (e) { setError(adminError(e)); } finally { setBusy(false); }
  }
  return (
    <div className="section card">
      <h2>Status</h2>
      {f.status === 'pending_approval' ? <p className="sub" style={{ margin: 0 }}>Saat diaktifkan, kreator aktif yang niche dan platformnya cocok akan mendapat notifikasi.</p> : null}
      <div className="actions">{MOVES[f.status].map((m) => (
        <button key={m.to} className={`btn ${m.cls}`} style={move?.to === m.to ? { outline: '2px solid var(--blue)' } : undefined} onClick={() => { setMove(m); setError(null); }}>{m.label}</button>
      ))}</div>
      {move?.reason ? <label className="field">Alasan (dikirim ke kreator yang bergabung)<textarea value={reason} onChange={(e) => setReason(e.target.value)} /></label> : null}
      {error ? <div className="notice error">{error}</div> : null}
      {move ? <div className="actions"><button className="btn" disabled={busy} onClick={confirm}>{busy ? 'Menyimpan…' : `Konfirmasi: ${move.label}`}</button><button className="btn secondary" onClick={() => setMove(null)}>Batal</button></div> : null}
    </div>
  );
}

function BudgetCard({ c, onDone }: { c: AdminCampaign; onDone: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [budget, setBudget] = useState(String(c.budget));
  const [override, setOverride] = useState(c.budget_override);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!open) return <div className="section"><button className="btn secondary" style={{ justifySelf: 'start' }} onClick={() => setOpen(true)}>Atur budget</button></div>;
  async function save(e: FormEvent) {
    e.preventDefault();
    const b = Number(budget.replace(/[.,\s]/g, ''));
    if (!Number.isFinite(b) || b <= 0) return setError('Budget tidak valid.');
    if (!reason.trim()) return setError('Alasan wajib diisi (tercatat di audit log).');
    setBusy(true); setError(null);
    try { await adjustBudget(c.id, b, override, reason.trim()); setOpen(false); await onDone(); } catch (err) { setError(adminError(err)); } finally { setBusy(false); }
  }
  return (
    <form className="section card" onSubmit={save}>
      <h2>Atur budget</h2>
      <div className="grid2">
        <label className="field">Budget baru (Rp)<input inputMode="numeric" value={budget} onChange={(e) => setBudget(e.target.value)} /></label>
        <label className="field">Alasan<input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="mis. top-up dari brand" /></label>
      </div>
      <label className="check"><input type="checkbox" checked={override} onChange={(e) => setOverride(e.target.checked)} />Override: izinkan penghasilan melebihi budget (hanya jika disetujui brand)</label>
      <p className="sub" style={{ margin: 0 }}>Sudah dialokasikan: {idr(c.earned)}. Menambah budget pada campaign "Segera berakhir" tidak otomatis membukanya lagi.</p>
      {error ? <div className="notice error">{error}</div> : null}
      <div className="actions"><button className="btn" disabled={busy}>{busy ? 'Menyimpan…' : 'Simpan budget'}</button><button type="button" className="btn secondary" onClick={() => setOpen(false)}>Batal</button></div>
    </form>
  );
}

function Assets({ f, onDone }: { f: CampaignFull; onDone: () => Promise<void> }) {
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [kind, setKind] = useState('link');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function add(e: FormEvent) {
    e.preventDefault(); setError(null);
    if (!file && !/^https?:\/\/\S+$/i.test(url.trim())) return setError('Isi link (https://…) atau pilih file.');
    if (!file && !title.trim()) return setError('Judul wajib diisi.');
    setBusy(true);
    try {
      if (file) await uploadAsset(f.id, file, title, f.assets.length + 1);
      else await addAssetLink(f.id, kind, title, url, f.assets.length + 1);
      setTitle(''); setUrl(''); setFile(null); await onDone();
    } catch (err) { setError(adminError(err)); } finally { setBusy(false); }
  }
  return (
    <div className="section">
      <h3>Konten sumber ({f.assets.length})</h3>
      <p className="sub" style={{ margin: 0 }}>Hanya terlihat oleh kreator yang sudah bergabung.</p>
      {f.assets.length ? (
        <table><tbody>{f.assets.map((a) => (
          <tr key={a.id}><td>{a.kind}</td><td>{a.url ? <a href={a.url} target="_blank" rel="noreferrer noopener">{a.title} ↗</a> : a.title}</td>
            <td className="n"><button className="btn danger" onClick={async () => { if (confirm(`Hapus "${a.title}"?`)) { try { await deleteAsset(a.id); await onDone(); } catch (e) { setError(adminError(e)); } } }}>Hapus</button></td></tr>
        ))}</tbody></table>
      ) : null}
      <form className="card" onSubmit={add}>
        <div className="grid3">
          <label className="field">Judul<input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Episode 48 (raw)" /></label>
          <label className="field">Jenis link<select value={kind} onChange={(e) => setKind(e.target.value)} disabled={!!file}>
            <option value="link">Link</option><option value="video">Video</option><option value="audio">Audio</option><option value="document">Dokumen</option></select></label>
          <label className="field">Link<input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://drive.google.com/…" disabled={!!file} /></label>
        </div>
        <label className="field">…atau unggah file (maks 500 MB)<input type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></label>
        {error ? <div className="notice error">{error}</div> : null}
        <div className="actions"><button className="btn secondary" disabled={busy}>{busy ? 'Mengunggah…' : 'Tambah konten sumber'}</button></div>
      </form>
    </div>
  );
}

const lines = (s: string) => s.split('\n').map((x) => x.trim()).filter(Boolean);
const iso = (v: string) => (v ? new Date(v).toISOString() : '');
const local = (v: string | null) => (v ? toLocalInput(new Date(v)) : '');

function Editor({ id, initial, onSaved, onCancel }: { id: string | null; initial?: CampaignFull; onSaved: (id: string) => void | Promise<void>; onCancel: () => void }) {
  const brands = useLoad(listBrands, []);
  const byKind = (k: string) => (initial?.rules ?? []).filter((r) => r.kind === k).map((r) => r.body).join('\n');
  const [f, setF] = useState({
    brand_id: initial?.brand_id ?? '', title: initial?.title ?? '', objective: initial?.objective ?? '', description: initial?.description ?? '',
    brand_name: initial ? (brands.data?.find((b) => b.id === initial.brand_id)?.name ?? '') : '',
    category: initial?.category ?? 'entertainment', content_type: initial?.content_type ?? '',
    cpm: initial ? String(initial.cpm) : '', budget: initial ? String(initial.budget) : '',
    max_earning_per_submission: initial?.max_earning_per_submission ? String(initial.max_earning_per_submission) : '',
    min_views_to_qualify: initial ? String(initial.min_views_to_qualify) : '1000',
    starts_at: local(initial?.starts_at ?? null), submission_deadline: local(initial?.submission_deadline ?? null), ends_at: local(initial?.ends_at ?? null),
    platforms: initial?.platforms.map((p) => p.platform) ?? ['tiktok'],
    do: (initial?.guidelines_do ?? []).join('\n'), dont: (initial?.guidelines_dont ?? []).join('\n'),
    requirement: byKind('requirement'), submission: byKind('submission'), performance: byKind('performance'), terms: initial?.terms ?? '',
  });
  const [banner, setBanner] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  const n = (v: string) => v.replace(/[.,\s]/g, '');

  async function save(e: FormEvent) {
    e.preventDefault(); setError(null);
    const brandName = f.brand_name || (initial ? brands.data?.find((b) => b.id === initial.brand_id)?.name ?? '' : '');
    if (!id && !brandName.trim()) return setError('Isi nama brand.');
    if (!f.platforms.length) return setError('Pilih minimal satu platform.');
    if (f.submission_deadline && f.ends_at && f.submission_deadline > f.ends_at) return setError('Deadline submit harus sebelum tanggal berakhir.');
    setBusy(true);
    try {
      const rules = (['requirement', 'submission', 'performance'] as const).flatMap((k) => lines(f[k]).map((body) => ({ kind: k, body })));
      const brandId = id ? f.brand_id : await ensureBrand(brandName);
      const r = await upsertCampaignDraft(id, {
        brand_id: brandId, title: f.title, objective: f.objective, description: f.description, category: f.category, content_type: f.content_type,
        cpm: n(f.cpm), budget: n(f.budget), max_earning_per_submission: n(f.max_earning_per_submission), min_views_to_qualify: n(f.min_views_to_qualify),
        starts_at: iso(f.starts_at), submission_deadline: iso(f.submission_deadline), ends_at: iso(f.ends_at), platforms: f.platforms,
        guidelines_do: lines(f.do), guidelines_dont: lines(f.dont), terms: f.terms, rules,
      });
      if (banner) await uploadBanner(r.id, banner);
      await onSaved(r.id);
    } catch (err) { setError(adminError(err)); } finally { setBusy(false); }
  }
  return (
    <form onSubmit={save} style={{ display: 'grid', gap: 14 }}>
      <h2>{id ? 'Ubah draft' : 'Campaign baru'}</h2>
      <p className="sub" style={{ margin: 0 }}>Disimpan sebagai draft. Setelah diajukan dan disetujui, CPM, budget, dan minimum views terkunci.</p>
      <div className="grid2">
        <label className="field">Brand<input list="brand-names" value={id ? (brands.data?.find((b) => b.id === f.brand_id)?.name ?? '') : f.brand_name}
          onChange={set('brand_name')} disabled={!!id} placeholder="Ketik nama brand" maxLength={80} required={!id} />
          <datalist id="brand-names">{brands.data?.filter((b) => b.status === 'active').map((b) => <option key={b.id} value={b.name} />)}</datalist></label>
        <label className="field">Judul<input value={f.title} onChange={set('title')} required maxLength={120} /></label>
        <label className="field">Jenis campaign<select value={f.category} onChange={set('category')}>
          {CAMPAIGN_TYPES.some(([k]) => k === f.category) ? null : <option value={f.category}>{campaignTypeLabel(f.category)}</option>}
          {CAMPAIGN_TYPES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
      </div>
      {id ? null : <BannerPicker file={banner} onPick={setBanner} onError={setError} />}
      <label className="field">Tujuan<input value={f.objective} onChange={set('objective')} /></label>
      <label className="field">Deskripsi / brief<textarea value={f.description} onChange={set('description')} rows={4} /></label>
      <div className="grid2">
        <label className="field">CPM (Rp per 1.000 qualified views)<input inputMode="numeric" value={f.cpm} onChange={set('cpm')} required /></label>
        <label className="field">Budget (Rp)<input inputMode="numeric" value={f.budget} onChange={set('budget')} required /></label>
        <label className="field">Minimum views sebelum dibayar<input inputMode="numeric" value={f.min_views_to_qualify} onChange={set('min_views_to_qualify')} /></label>
        <label className="field">Maks penghasilan per klip (opsional)<input inputMode="numeric" value={f.max_earning_per_submission} onChange={set('max_earning_per_submission')} /></label>
      </div>
      <div className="grid3">
        <label className="field">Mulai (opsional)<input type="datetime-local" value={f.starts_at} onChange={set('starts_at')} /></label>
        <label className="field">Deadline submit<input type="datetime-local" value={f.submission_deadline} onChange={set('submission_deadline')} /></label>
        <label className="field">Berakhir<input type="datetime-local" value={f.ends_at} onChange={set('ends_at')} /></label>
      </div>
      <div className="field" role="group" aria-label="Platform">Platform
        <div className="actions">{PLATFORMS.map(([k, l]) => (
          <label key={k} className="check"><input type="checkbox" checked={f.platforms.includes(k)}
            onChange={(e) => setF({ ...f, platforms: e.target.checked ? [...f.platforms, k] : f.platforms.filter((x) => x !== k) })} />{l}</label>
        ))}</div>
      </div>
      <div className="grid2">
        <label className="field">Do (satu per baris)<textarea value={f.do} onChange={set('do')} /></label>
        <label className="field">Don't (satu per baris)<textarea value={f.dont} onChange={set('dont')} /></label>
        <label className="field">Syarat konten (satu per baris)<textarea value={f.requirement} onChange={set('requirement')} /></label>
        <label className="field">Aturan submission (satu per baris)<textarea value={f.submission} onChange={set('submission')} /></label>
      </div>
      <label className="field">Aturan performa (satu per baris)<textarea value={f.performance} onChange={set('performance')} /></label>
      <label className="field">Ketentuan<textarea value={f.terms} onChange={set('terms')} /></label>
      {error ? <div className="notice error">{error}</div> : null}
      <div className="actions"><button className="btn" disabled={busy}>{busy ? 'Menyimpan…' : 'Simpan draft'}</button><button type="button" className="btn secondary" onClick={onCancel}>Batal</button></div>
    </form>
  );
}

function CopyEditor({ f, onDone, onCancel }: { f: CampaignFull; onDone: () => Promise<void>; onCancel: () => void }) {
  const [v, setV] = useState({ title: f.title, objective: f.objective ?? '', description: f.description ?? '', do: f.guidelines_do.join('\n'),
    dont: f.guidelines_dont.join('\n'), terms: f.terms ?? '', submission_deadline: local(f.submission_deadline), ends_at: local(f.ends_at) });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof typeof v) => (e: { target: { value: string } }) => setV({ ...v, [k]: e.target.value });
  async function save(e: FormEvent) {
    e.preventDefault(); setBusy(true); setError(null);
    try {
      await updateCampaignCopy(f.id, { title: v.title, objective: v.objective, description: v.description, guidelines_do: lines(v.do),
        guidelines_dont: lines(v.dont), terms: v.terms, submission_deadline: iso(v.submission_deadline), ends_at: iso(v.ends_at) });
      await onDone();
    } catch (err) { setError(adminError(err)); } finally { setBusy(false); }
  }
  return (
    <form onSubmit={save} style={{ display: 'grid', gap: 14 }}>
      <h2>Ubah teks campaign</h2>
      <div className="notice info">CPM, budget, dan minimum views terkunci karena campaign sudah berjalan. Perubahan teks langsung terlihat oleh kreator.</div>
      <label className="field">Judul<input value={v.title} onChange={set('title')} /></label>
      <label className="field">Tujuan<input value={v.objective} onChange={set('objective')} /></label>
      <label className="field">Deskripsi<textarea value={v.description} onChange={set('description')} rows={4} /></label>
      <div className="grid2">
        <label className="field">Do<textarea value={v.do} onChange={set('do')} /></label>
        <label className="field">Don't<textarea value={v.dont} onChange={set('dont')} /></label>
        <label className="field">Deadline submit<input type="datetime-local" value={v.submission_deadline} onChange={set('submission_deadline')} /></label>
        <label className="field">Berakhir<input type="datetime-local" value={v.ends_at} onChange={set('ends_at')} /></label>
      </div>
      <label className="field">Ketentuan<textarea value={v.terms} onChange={set('terms')} /></label>
      {error ? <div className="notice error">{error}</div> : null}
      <div className="actions"><button className="btn" disabled={busy}>{busy ? 'Menyimpan…' : 'Simpan'}</button><button type="button" className="btn secondary" onClick={onCancel}>Batal</button></div>
    </form>
  );
}

// Banner preview at the card's 2:1 shape; the file is checked against BANNER_RULES before it's accepted.
function BannerPicker({ file, current, onPick, onError }: { file: File | null; current?: string | null; onPick: (f: File | null) => void; onError: (e: string | null) => void }) {
  const [preview, setPreview] = useState<string | null>(null);
  useEffect(() => {
    if (!file) { setPreview(null); return; }
    const u = URL.createObjectURL(file); setPreview(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);
  const src = preview ?? current ?? null;
  return (
    <div className="field">Foto banner
      <div style={{ aspectRatio: '2 / 1', borderRadius: 14, overflow: 'hidden', background: src ? undefined : 'radial-gradient(70% 90% at 80% 30%, #7DA2FF, transparent 60%), linear-gradient(135deg, #0E1A6B, #2F66F2)',
        border: '1px solid var(--border, rgba(255,255,255,0.1))', maxWidth: 480 }}>
        {src ? <img src={src} alt="Banner campaign" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} /> : null}
      </div>
      <input type="file" accept="image/jpeg,image/png,image/webp" onChange={async (e) => {
        const f = e.target.files?.[0] ?? null; e.target.value = '';
        if (!f) return;
        const bad = await checkBanner(f);
        if (bad) { onError(bad); return; }
        onError(null); onPick(f);
      }} />
      <span className="sub" style={{ fontWeight: 400 }}>{BANNER_RULES} Tanpa banner, kartu memakai gradasi biru TAPP.</span>
    </div>
  );
}

function BannerCard({ f, onDone }: { f: CampaignFull; onDone: () => Promise<void> }) {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function save() {
    if (!file) return;
    setBusy(true); setError(null);
    try { await uploadBanner(f.id, file); setFile(null); await onDone(); } catch (e) { setError(adminError(e)); } finally { setBusy(false); }
  }
  async function remove() {
    setBusy(true); setError(null);
    try { await removeBanner(f.id); await onDone(); } catch (e) { setError(adminError(e)); } finally { setBusy(false); }
  }
  return (
    <div className="section">
      <h3>Banner</h3>
      <BannerPicker file={file} current={f.banner_url} onPick={setFile} onError={setError} />
      {error ? <div className="notice error">{error}</div> : null}
      <div className="actions">
        {file ? <button className="btn" onClick={save} disabled={busy}>{busy ? 'Mengunggah…' : 'Simpan banner'}</button> : null}
        {file ? <button className="btn secondary" onClick={() => setFile(null)} disabled={busy}>Batal</button> : null}
        {!file && f.banner_url ? <button className="btn secondary" onClick={remove} disabled={busy}>Hapus banner</button> : null}
      </div>
    </div>
  );
}

// Campaign hashtag: TikTok's public totals for it go into the brand report every 6 hours.
function HashtagCard({ f, onDone }: { f: CampaignFull; onDone: () => Promise<void> }) {
  const [tag, setTag] = useState(f.hashtag ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const stats = useLoad(() => fetchHashtagStats(f.id), [f.id]);
  const last = stats.data?.at(-1);
  async function save() {
    setBusy(true); setError(null);
    try { await setCampaignHashtag(f.id, tag.trim() || null); await onDone(); } catch (e) { setError(adminError(e)); } finally { setBusy(false); }
  }
  async function refreshNow() {
    setBusy(true); setError(null);
    try { await refreshHashtag(f.id); await stats.reload(); } catch (e) { setError(adminError(e)); } finally { setBusy(false); }
  }
  return (
    <div className="section">
      <h3>Hashtag campaign</h3>
      <p className="sub" style={{ margin: '0 0 8px' }}>Pakai hashtag unik untuk campaign ini (mis. TAPPKopiSenja). Jumlah video &amp; total views hashtag di TikTok dicatat otomatis tiap 6 jam dan masuk ke laporan brand. Angkanya dari TikTok untuk semua video yang memakai hashtag itu.</p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <input value={tag} onChange={(e) => setTag(e.target.value.replace(/[#\s]/g, ''))} placeholder="TAPPNamaBrand" style={{ maxWidth: 260 }} />
        <button className="btn" onClick={save} disabled={busy || tag === (f.hashtag ?? '')}>Simpan</button>
        {f.hashtag ? <button className="btn secondary" onClick={refreshNow} disabled={busy}>{busy ? 'Membaca…' : 'Perbarui sekarang'}</button> : null}
      </div>
      {error ? <div className="notice error" style={{ marginTop: 8 }}>{error}</div> : null}
      {last ? <p style={{ margin: '10px 0 0' }}>#{last.hashtag} di TikTok: <b>{num(last.video_count)}</b> video · <b>{num(last.view_count)}</b> views <span className="sub">· dicatat {ago(last.captured_at)}</span></p>
        : f.hashtag ? <p className="sub" style={{ margin: '10px 0 0' }}>Belum ada catatan. Tekan Perbarui sekarang atau tunggu jadwal otomatis.</p> : null}
    </div>
  );
}
