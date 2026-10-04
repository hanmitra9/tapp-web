import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import Feather from '@expo/vector-icons/Feather';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Button } from '@/components/Button';
import { Checkbox } from '@/components/Checkbox';
import { Chips } from '@/components/Chips';
import { Header } from '@/components/Header';
import { LoadState } from '@/components/LoadState';
import { Notice } from '@/components/Notice';
import { Screen } from '@/components/Screen';
import { Stepper } from '@/components/Stepper';
import { TextField } from '@/components/TextField';
import { errorMessage } from '@/lib/errors';
import { compact } from '@/lib/format';
import { track } from '@/lib/analytics';
import { useAuth } from '@/providers/AuthProvider';
import { web } from '@/theme/web';
import { card, color, radius, space, type } from '@/theme/tokens';
import { fetchCampaign, joinCampaign, type CampaignDetail } from '@/features/campaigns/api';
import { addPlatform, fetchPlatforms, type LinkedPlatform } from '@/features/creator/api';
import { BioVerify } from '@/features/creator/forms/BioVerify';
import { parseHandle, profileUrl } from '@/features/creator/handles';
import { platformLabel, type Platform } from '@/features/creator/options';
import { checkSubmission, fetchMySubmissions, submitContent, type SubmissionCheck } from '@/features/submissions/api';
import { CheckResult } from '@/features/submissions/CheckResult';
import { detectPlatform, publishDays } from '@/features/submissions/postUrl';
import { fetchMyVideos, previewVideo, type Video, type VideoList } from '@/features/submissions/videos';

const STEPS = ['Akun', 'Verifikasi', 'Video'];
const GRACE_MS = 60 * 60 * 1000;   // publish_grace_minutes: a post may predate joining by an hour
const BIO_PLATFORMS: Platform[] = ['tiktok', 'instagram'];
const ICON: Partial<Record<Platform, string>> = { tiktok: 'tiktok', instagram: 'instagram', youtube: 'youtube', x: 'x-twitter', facebook: 'facebook' };
const MAX_PICK = 5;

const needsBio = (a: LinkedPlatform) => BIO_PLATFORMS.includes(a.platform) && !a.verified_at;
const ready = (a: LinkedPlatform) => !needsBio(a) || a.bio_status === 'review';
// Same post, whatever form the link was copied in (query strings, reel vs p, shorts vs watch).
const postKey = (url: string) => url.match(/(?:video\/|\/(?:p|reel|reels|tv)\/|shorts\/|[?&]v=|youtu\.be\/)([A-Za-z0-9_-]+)/)?.[1] ?? url;

type Pick = Video & { day?: string | null };

// Picked-but-not-sent videos survive leaving the screen (per campaign + account), until they are submitted.
const draftKey = (campaignId: string, accountId: string) => `tapp:draft:${campaignId}:${accountId}`;
function readDraft(key: string): Pick[] {
  try { const v = JSON.parse(globalThis.localStorage?.getItem(key) ?? '[]'); return Array.isArray(v) ? v : []; } catch { return []; }
}
function writeDraft(key: string, picks: Pick[]) {
  try { if (picks.length) globalThis.localStorage?.setItem(key, JSON.stringify(picks)); else globalThis.localStorage?.removeItem(key); } catch { /* storage off */ }
}
type Done = { kind: 'joined' } | { kind: 'submitted'; checks: (SubmissionCheck | null | 'checking')[] };

// "Ambil Campaign": one guided flow from choosing the account to submitting the clip.
export default function TakeCampaign() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const uid = session!.user.id;

  const [c, setC] = useState<CampaignDetail | null>(null);
  const [accounts, setAccounts] = useState<LinkedPlatform[]>([]);
  const [submitted, setSubmitted] = useState<Set<string>>(new Set());
  const [loadError, setLoadError] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<Done | null>(null);

  const load = useCallback(async (first = false) => {
    setLoadError(null);
    try {
      const [camp, linked, subs] = await Promise.all([fetchCampaign(id), fetchPlatforms(uid), fetchMySubmissions(id)]);
      const usable = linked.filter((a) => camp.platforms.includes(a.platform));
      setC(camp); setAccounts(usable); setSubmitted(new Set(subs.map((s) => postKey(s.post_url))));
      if (first) {
        // Returning creators skip straight to picking a video.
        const pick = usable.find((a) => a.verified_at) ?? usable.find(ready) ?? usable[0];
        if (pick) setAccountId(pick.id);
        if (pick && ready(pick) && camp.membership?.status === 'joined') setStep(2);
      }
    } catch (e) { setLoadError(errorMessage(e)); }
  }, [id, uid]);
  useEffect(() => { void load(true); track('take_campaign_started', { campaign_id: id }); }, [load, id]);

  if (!c) return <Screen width="narrow" scroll={false}><Header title="Ambil Campaign" /><LoadState error={loadError} onRetry={() => load(true)} /></Screen>;
  const account = accounts.find((a) => a.id === accountId) ?? null;
  const joined = c.membership?.status === 'joined';

  if (done) return <DoneView c={c} done={done} />;

  async function toVideos() {
    if (!account) return;
    setError(null);
    if (!joined) {
      setBusy(true);
      try { await joinCampaign(c!.id); track('campaign_joined', { campaign_id: c!.id, category: c!.category, via: 'take' }); await load(); }
      catch (e) { setError(errorMessage(e)); setBusy(false); return; }
      setBusy(false);
    }
    setStep(2);
  }
  function next() {
    if (step === 0 && account) return needsBio(account) && account.bio_status !== 'review' ? setStep(1) : toVideos();
    if (step === 1) return toVideos();
  }

  const joinNote = !joined ? 'Dengan lanjut, kamu bergabung dan setuju mengikuti brief serta aturan campaign.' : null;
  const footer = step === 2 ? null : (
    <>
      {joinNote ? <Text style={styles.footNote}>{joinNote}</Text> : null}
      <View style={styles.footRow}>
        {step > 0 ? <View style={{ flex: 1 }}><Button variant="secondary" label="Kembali" onPress={() => setStep(step - 1)} /></View> : null}
        <View style={{ flex: 1.4 }}>
          <Button label={!joined && (step === 1 || (account && ready(account))) ? 'Gabung & Lanjut' : 'Selanjutnya'} onPress={next} loading={busy}
            disabled={!account || (step === 1 && !ready(account))} />
        </View>
      </View>
    </>
  );

  return (
    <Screen width="narrow" footer={footer}>
      <Header title="" />
      <Text style={styles.kicker} numberOfLines={1}>{c.brand.name} · {c.title}</Text>
      <Stepper steps={STEPS} current={step} />
      <Notice tone="error" message={error} />
      {step === 0 ? (
        <AccountStep c={c} uid={uid} accounts={accounts} selected={accountId} onSelect={setAccountId}
          onAdded={async (row) => { await load(); setAccountId(row.id); }} />
      ) : step === 1 && account ? (
        <View style={styles.gap}>
          <Text style={styles.h1}>Verifikasi Akun</Text>
          <Text style={styles.sub}>Tempel kode unik di bio {platformLabel(account.platform)} @{account.handle}. Ini membuktikan akun itu milikmu, jadi views-nya bisa dihitung.</Text>
          <BioVerify p={account} onVerified={async () => { await load(); }} />
          {account.verified_at ? <Notice tone="info" message="Akun terverifikasi. Lanjut pilih video." /> : null}
        </View>
      ) : account ? (
        <VideoStep c={c} account={account} submitted={submitted} onBack={() => setStep(0)}
          onLater={() => setDone({ kind: 'joined' })} onDone={(checks) => setDone({ kind: 'submitted', checks })} />
      ) : null}
    </Screen>
  );
}

// ---------- Step 1: account ----------
function AccountStep({ c, uid, accounts, selected, onSelect, onAdded }: {
  c: CampaignDetail; uid: string; accounts: LinkedPlatform[]; selected: string | null;
  onSelect: (id: string) => void; onAdded: (row: LinkedPlatform) => Promise<void>;
}) {
  const [adding, setAdding] = useState<Platform | null>(null);
  const [handle, setHandle] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function add(p: Platform) {
    const h = parseHandle(handle);
    if (!h) return setErr('Masukkan username atau link profil yang valid.');
    setBusy(true); setErr(null);
    try { const row = await addPlatform(uid, { platform: p, handle: h, profile_url: profileUrl(p, h), followers: null }); setAdding(null); setHandle(''); await onAdded(row); }
    catch (e) { setErr(errorMessage(e)); } finally { setBusy(false); }
  }

  return (
    <View style={styles.gap}>
      <Text style={styles.h1}>Pilih Akun</Text>
      <Text style={styles.sub}>Akun yang kamu pakai untuk posting klip campaign ini.</Text>
      {c.platforms.filter((p) => p !== 'other').map((p) => {
        const mine = accounts.filter((a) => a.platform === p);
        return (
          <View key={p} style={styles.platform}>
            <View style={styles.platformHead}>
              <View style={styles.pIcon}><FontAwesome6 name={ICON[p] ?? 'link'} brand size={16} color={color.text} /></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.pName}>{platformLabel(p)}</Text>
                <Text style={styles.pMeta}>{mine.length ? `${mine.length} akun terhubung` : 'Belum ada akun terhubung'}</Text>
              </View>
              {adding !== p ? (
                <Pressable onPress={() => { setAdding(p); setErr(null); }} style={styles.addBtn} hitSlop={6} accessibilityRole="button">
                  <Text style={styles.addText}>{mine.length ? 'Tambah' : 'Hubungkan akun'}</Text>
                  <Feather name="plus" size={14} color={color.link} />
                </Pressable>
              ) : null}
            </View>
            {mine.map((a) => {
              const on = a.id === selected;
              return (
                <Pressable key={a.id} onPress={() => onSelect(a.id)} accessibilityRole="radio" accessibilityState={{ checked: on }}
                  style={[styles.acc, on && styles.accOn]}>
                  <View style={[styles.radio, on && styles.radioOn]}>{on ? <View style={styles.radioDot} /> : null}</View>
                  <Text style={styles.accHandle} numberOfLines={1}>@{a.handle}</Text>
                  {!needsBio(a) ? <Tag tone="ok" label={a.verified_at ? 'Terverifikasi' : 'Siap'} />
                    : a.bio_status === 'review' ? <Tag tone="wait" label="Dicek tim" /> : <Tag tone="wait" label="Perlu verifikasi" />}
                </Pressable>
              );
            })}
            {adding === p ? (
              <View style={styles.addForm}>
                <TextField label={`Username ${platformLabel(p)}`} value={handle} onChangeText={setHandle} autoCapitalize="none" autoCorrect={false}
                  placeholder="@namakamu atau link profil" error={err} />
                <View style={styles.footRow}>
                  <View style={{ flex: 1 }}><Button variant="secondary" label="Batal" onPress={() => { setAdding(null); setErr(null); }} /></View>
                  <View style={{ flex: 1 }}><Button label="Simpan" onPress={() => add(p)} loading={busy} /></View>
                </View>
              </View>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}
function Tag({ tone, label }: { tone: 'ok' | 'wait'; label: string }) {
  const ok = tone === 'ok';
  return (
    <View style={[styles.tag, { backgroundColor: ok ? color.successSoft : color.warningSoft }]}>
      {ok ? <Feather name="check" size={12} color={color.success} /> : null}
      <Text style={[styles.tagText, { color: ok ? color.success : color.warning }]}>{label}</Text>
    </View>
  );
}

// ---------- Step 3: video ----------
function VideoStep({ c, account, submitted, onBack, onLater, onDone }: {
  c: CampaignDetail; account: LinkedPlatform; submitted: Set<string>;
  onBack: () => void; onLater: () => void; onDone: (checks: (SubmissionCheck | null | 'checking')[]) => void;
}) {
  const joinedAt = c.membership?.joined_at ?? new Date().toISOString();
  const minTime = new Date(joinedAt).getTime() - GRACE_MS;
  const [list, setList] = useState<VideoList | null>(null);
  const [loading, setLoading] = useState(true);
  const dKey = draftKey(c.id, account.id);
  const [picks, setPicks] = useState<Pick[]>(() => readDraft(dKey).filter((p) => !submitted.has(postKey(p.url))).slice(0, MAX_PICK));
  const [restored] = useState(() => picks.length > 0);
  useEffect(() => { writeDraft(dKey, picks); }, [dKey, picks]);
  const [link, setLink] = useState('');
  const [linkBusy, setLinkBusy] = useState(false);
  const [linkErr, setLinkErr] = useState<string | null>(null);
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const days = useMemo(() => publishDays(joinedAt), [joinedAt]);

  const loadList = useCallback(async () => {
    setLoading(true);
    setList(await fetchMyVideos(account.id));
    setLoading(false);
  }, [account.id]);
  useEffect(() => { void loadList(); }, [loadList]);

  const isPicked = (v: Video) => picks.some((p) => postKey(p.url) === postKey(v.url));
  const tooOld = (v: Video) => !!v.posted_at && new Date(v.posted_at).getTime() < minTime;

  async function toggle(v: Video) {
    setError(null);
    if (isPicked(v)) return setPicks(picks.filter((p) => postKey(p.url) !== postKey(v.url)));
    if (picks.length >= MAX_PICK) return setError(`Maksimal ${MAX_PICK} video sekali submit.`);
    setPicks([...picks, { ...v, day: null }]);
    // Shorts lists carry no date: read it from the video page.
    if (!v.posted_at) {
      const full = await previewVideo(v.url);
      if (full?.posted_at) setPicks((cur) => cur.map((p) => (postKey(p.url) === postKey(v.url) ? { ...p, posted_at: full.posted_at } : p)));
    }
  }

  async function addLink() {
    const url = link.trim();
    const det = detectPlatform(url);
    setLinkErr(null);
    if (det.error) return setLinkErr(det.error);
    if (det.platform !== account.platform) return setLinkErr(`Tempel link ${platformLabel(account.platform)} dari @${account.handle}.`);
    if (submitted.has(postKey(url))) return setLinkErr('Video ini sudah pernah kamu submit.');
    if (picks.some((p) => postKey(p.url) === postKey(url))) return setLinkErr('Video ini sudah dipilih.');
    if (picks.length >= MAX_PICK) return setLinkErr(`Maksimal ${MAX_PICK} video sekali submit.`);
    setLinkBusy(true);
    const v = await previewVideo(url);
    setLinkBusy(false);
    const author = v?.author?.replace(/^@/, '').toLowerCase();
    if (author && author !== account.handle.replace(/^@/, '').toLowerCase()) return setLinkErr(`Video ini diposting oleh @${v!.author}, bukan @${account.handle}.`);
    if (v && tooOld(v)) return setLinkErr('Video ini diposting sebelum kamu bergabung, jadi tidak dihitung.');
    setPicks([...picks, { ...(v ?? { platform: account.platform, url, thumb: null, caption: null, author: null, views: null, likes: null, comments: null, posted_at: null }), url, day: null }]);
    setLink('');
  }

  const needDay = picks.filter((p) => !p.posted_at && !p.day);
  async function submit() {
    setError(null);
    if (!picks.length) return setError('Pilih minimal satu video.');
    if (needDay.length) return setError('Pilih tanggal posting untuk video yang tanggalnya belum terbaca.');
    if (!agree) return setError('Centang pernyataan di bawah untuk melanjutkan.');
    setBusy(true);
    const ids: (string | null)[] = [];
    const errs: string[] = [];
    for (const p of picks) {
      const publishedAt = p.posted_at ?? days.find((d) => d.key === p.day)!.iso();
      try {
        const saved = await submitContent(c.id, { platform: account.platform, postUrl: p.url, publishedAt, caption: p.caption ?? '', screenshotPath: null });
        ids.push(saved.id);
      } catch (e) { errs.push(errorMessage(e)); }
    }
    setBusy(false);
    const ok = ids.filter(Boolean) as string[];
    track('submission_submitted', { campaign_id: c.id, platform: account.platform, count: ok.length, via: 'take' });
    if (!ok.length) return setError(errs[0] ?? 'Submit gagal. Coba lagi.');
    writeDraft(dKey, []);
    const checks: (SubmissionCheck | null | 'checking')[] = ok.map(() => 'checking');
    onDone(checks);
    // Right after submitting, TAPP opens each post: is it there, is it from your account, how many views.
    ok.forEach((sid, i) => { checkSubmission(sid).then((r) => { checks[i] = r; onDone([...checks]); }).catch(() => { checks[i] = null; onDone([...checks]); }); });
  }

  const videos = list?.videos ?? [];
  return (
    <View style={styles.gap}>
      <View style={styles.titleRow}>
        <Text style={styles.h1}>Pilih Video</Text>
        {list?.supported ? <Pressable onPress={loadList} hitSlop={8} accessibilityRole="button" accessibilityLabel="Muat ulang">
          <Feather name="refresh-cw" size={16} color={color.link} />
        </Pressable> : null}
      </View>
      <Text style={styles.sub}>Dari @{account.handle}. Hanya video yang diposting setelah kamu bergabung yang dihitung.</Text>
      {restored && picks.length ? <Text style={[styles.sub, { color: color.link }]}>Pilihanmu sebelumnya masih tersimpan ({picks.length} video). Lanjutkan submit.</Text> : null}

      {loading ? (
        <View style={styles.loading}><ActivityIndicator color={color.blueLight} /><Text style={styles.pMeta}>Membaca video di akunmu…</Text></View>
      ) : list?.supported && videos.length ? (
        <View style={styles.grid}>
          {videos.map((v) => {
            const old = tooOld(v);
            const used = submitted.has(postKey(v.url));
            const n = picks.findIndex((p) => postKey(p.url) === postKey(v.url));
            return (
              <Pressable key={v.url} onPress={() => toggle(v)} disabled={old || used} style={[styles.tile, n >= 0 && styles.tileOn]}
                accessibilityRole="checkbox" accessibilityState={{ checked: n >= 0, disabled: old || used }}>
                <View style={styles.thumbWrap}>
                  {v.thumb ? <Image source={{ uri: v.thumb }} style={styles.thumb} resizeMode="cover" /> : <View style={styles.thumb} {...web('art')} />}
                  {old || used ? <View style={styles.thumbShade}><View style={styles.shadePill}><Feather name={used ? 'check' : 'clock'} size={12} color={color.textSecondary} /><Text style={styles.shadeText}>{used ? 'Sudah disubmit' : 'Sebelum bergabung'}</Text></View></View> : (
                    <View style={[styles.badge, n >= 0 && styles.badgeOn]} {...(n >= 0 ? web('navon') : {})}>
                      {n >= 0 ? <Text style={styles.badgeText}>{n + 1}</Text> : null}
                    </View>
                  )}
                </View>
                <Text style={styles.cap} numberOfLines={2}>{v.caption || 'Tanpa caption'}</Text>
                <View style={styles.statRow}>
                  {v.views != null ? <Stat icon="play" n={v.views} /> : null}
                  {v.likes != null ? <Stat icon="heart" n={v.likes} /> : null}
                  {v.comments != null ? <Stat icon="message-circle" n={v.comments} /> : null}
                </View>
              </Pressable>
            );
          })}
        </View>
      ) : list?.supported ? (
        <View style={styles.empty}>
          <Feather name="film" size={20} color={color.textMuted} />
          <Text style={styles.emptyText}>{list.unreadable ? 'Video belum bisa dibaca otomatis. Tempel link videonya di bawah.' : 'Belum ada video di akun ini. Posting klipmu, lalu muat ulang.'}</Text>
        </View>
      ) : (
        <View style={styles.empty}>
          <FontAwesome6 name={ICON[account.platform] ?? 'link'} brand size={18} color={color.textMuted} />
          <Text style={styles.emptyText}>Tempel link video {platformLabel(account.platform)}-mu di bawah. Kami tampilkan preview-nya sebelum kamu submit.</Text>
        </View>
      )}

      <View style={styles.linkRow}>
        <View style={{ flex: 1 }}>
          <TextField label={list?.supported ? 'Atau tempel link' : 'Link video'} value={link} onChangeText={(t) => { setLink(t); setLinkErr(null); }}
            autoCapitalize="none" autoCorrect={false} keyboardType="url" placeholder={account.platform === 'tiktok' ? 'https://www.tiktok.com/@nama/video/…' : 'https://…'} error={linkErr} />
        </View>
        <View style={styles.linkBtn}><Button variant="secondary" label="Cek" onPress={addLink} loading={linkBusy} disabled={!link.trim()} /></View>
      </View>

      {picks.length ? (
        <View style={styles.picked}>
          <Text style={styles.pickedTitle}>{picks.length} video dipilih</Text>
          {picks.map((p, i) => (
            <View key={p.url} style={styles.pickRow}>
              {p.thumb ? <Image source={{ uri: p.thumb }} style={styles.pickThumb} /> : <View style={styles.pickThumb} {...web('art')} />}
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={styles.cap} numberOfLines={1}>{i + 1}. {p.caption || p.url}</Text>
                <Text style={styles.pMeta}>
                  {p.author ? `@${p.author}` : platformLabel(p.platform)}{p.views != null ? ` · ${compact(p.views)} views` : ''}
                  {p.posted_at ? ` · ${new Date(p.posted_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}` : ''}
                </Text>
                {!p.posted_at ? (
                  <View style={{ marginTop: space.xs }}>
                    <Text style={styles.dayLabel}>Kapan diposting?</Text>
                    <Chips options={days.map((d) => ({ value: d.key, label: d.label }))} value={p.day ? [p.day] : []}
                      onChange={([k]) => setPicks(picks.map((x) => (x.url === p.url ? { ...x, day: k ?? null } : x)))} />
                  </View>
                ) : null}
              </View>
              <Pressable onPress={() => setPicks(picks.filter((x) => x.url !== p.url))} hitSlop={8} accessibilityLabel="Hapus">
                <Feather name="x" size={16} color={color.textMuted} />
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}

      <Checkbox checked={agree} onChange={setAgree} label="Video ini milikku, publik, dan mengikuti brief serta aturan campaign." />
      <Notice tone="error" message={error} />
      <View style={styles.footRow}>
        <View style={{ flex: 1 }}><Button variant="secondary" label="Ganti akun" onPress={onBack} /></View>
        <View style={{ flex: 1.4 }}><Button label={picks.length ? `Submit ${picks.length} Video` : 'Submit'} onPress={submit} loading={busy} disabled={!picks.length} /></View>
      </View>
      <Button variant="quiet" label="Nanti saja, aku belum posting" onPress={onLater} />
    </View>
  );
}

function Stat({ icon, n }: { icon: 'play' | 'heart' | 'message-circle'; n: number }) {
  return <View style={styles.stat}><Feather name={icon} size={11} color={color.textMuted} /><Text style={styles.stats}>{compact(n)}</Text></View>;
}

// ---------- Done ----------
function DoneView({ c, done }: { c: CampaignDetail; done: Done }) {
  const sent = done.kind === 'submitted';
  return (
    <Screen width="narrow" footer={(
      <>
        <Button label={sent ? 'Cek Klip Saya' : 'Buka Workspace'} onPress={() => router.replace({ pathname: '/workspace/[id]', params: { id: c.id } })} />
        <Button variant="quiet" label="Cari Campaign Lain" onPress={() => router.replace('/dashboard/campaigns')} />
      </>
    )}>
      <View style={styles.done}>
        <View style={styles.halo} {...web('halo')}>
          <View style={styles.haloIn} {...web('navon')}><Feather name="check" size={34} color={color.onAccent} /></View>
        </View>
        <Text style={styles.doneTitle}>{sent ? 'Klip Kamu Terkirim' : 'Kamu Sudah Bergabung'}</Text>
        <Text style={styles.doneBody}>
          {sent ? 'Kami cek videomu sekarang dan setiap 6 jam. Penghasilan dihitung dari qualified views setelah klip disetujui.'
            : `Konten sumber ${c.title} sudah terbuka. Buat klip, posting di akunmu, lalu kembali ke sini untuk memilih videonya.`}
        </Text>
        {sent ? <View style={{ alignSelf: 'stretch' }}>{done.checks.map((ch, i) => <CheckResult key={i} check={ch} />)}</View> : (
          <View style={styles.nextSteps}>
            {['Unduh konten sumber di workspace', 'Edit dan posting klip sesuai brief', 'Buka campaign ini lagi, tekan Submit Klip'].map((t, i) => (
              <View key={t} style={styles.nextRow}><Text style={styles.nextNum}>{i + 1}</Text><Text style={styles.nextText}>{t}</Text></View>
            ))}
          </View>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  kicker: { ...type.caption, color: color.textMuted, marginTop: -space.lg, marginBottom: space.lg },
  gap: { gap: space.md },
  h1: { ...type.title, color: color.text },
  sub: { ...type.body, color: color.textSecondary, marginTop: -space.xs },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  footNote: { ...type.caption, color: color.textMuted, textAlign: 'center' },
  footRow: { flexDirection: 'row', gap: space.sm },

  platform: { ...card, borderRadius: radius.lg, padding: space.lg, gap: space.md },
  platformHead: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  pIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: color.surfaceRaised, alignItems: 'center', justifyContent: 'center' },
  pName: { ...type.label, color: color.text },
  pMeta: { ...type.caption, color: color.textMuted },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 8, paddingHorizontal: space.md, borderRadius: radius.pill, backgroundColor: color.bg },
  addText: { ...type.label, fontSize: 13, color: color.link },
  acc: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, borderRadius: radius.md, borderWidth: 1, borderColor: color.border },
  accOn: { borderColor: color.blue, backgroundColor: color.accentSoft },
  radio: { width: 18, height: 18, borderRadius: 9, borderWidth: 1.5, borderColor: color.borderStrong, alignItems: 'center', justifyContent: 'center' },
  radioOn: { borderColor: color.blue },
  radioDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: color.blue },
  accHandle: { ...type.label, color: color.text, flex: 1 },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill },
  tagText: { ...type.caption, fontSize: 12 },
  addForm: { gap: space.md },

  loading: { alignItems: 'center', gap: space.sm, paddingVertical: space.xxl },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  tile: { width: '47.5%', flexGrow: 1, gap: 6, padding: 6, borderRadius: radius.md, borderWidth: 1, borderColor: color.border, backgroundColor: color.surface },
  tileOn: { borderColor: color.blue, backgroundColor: color.accentSoft },
  thumbWrap: { position: 'relative', borderRadius: radius.sm, overflow: 'hidden' },
  thumb: { width: '100%', aspectRatio: 9 / 14, backgroundColor: color.bg },
  thumbShade: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(6,6,8,0.78)', alignItems: 'center', justifyContent: 'center', padding: space.sm },
  shadePill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.pill, backgroundColor: 'rgba(20,20,25,0.92)', borderWidth: 1, borderColor: color.border },
  shadeText: { ...type.caption, fontSize: 12, color: color.textSecondary },
  statRow: { flexDirection: 'row', gap: space.md },
  stat: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  badge: { position: 'absolute', top: 8, right: 8, width: 24, height: 24, borderRadius: 12, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.8)', backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center' },
  badgeOn: { borderColor: color.blue, backgroundColor: color.blue },
  badgeText: { ...type.caption, fontSize: 12, color: color.onAccent, fontVariant: ['tabular-nums'] },
  cap: { ...type.caption, color: color.text },
  stats: { ...type.caption, fontSize: 12, color: color.textMuted, fontVariant: ['tabular-nums'] },
  empty: { ...card, borderRadius: radius.lg, padding: space.xl, alignItems: 'center', gap: space.sm },
  emptyText: { ...type.caption, color: color.textSecondary, textAlign: 'center' },
  linkRow: { flexDirection: 'row', alignItems: 'flex-end', gap: space.sm },
  linkBtn: { width: 84, marginBottom: 0 },
  picked: { ...card, borderRadius: radius.lg, padding: space.lg, gap: space.md },
  pickedTitle: { ...type.label, color: color.text },
  pickRow: { flexDirection: 'row', gap: space.md, alignItems: 'flex-start' },
  pickThumb: { width: 40, height: 56, borderRadius: 6, backgroundColor: color.bg, overflow: 'hidden' },
  dayLabel: { ...type.caption, color: color.warning, marginBottom: space.xs },

  done: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.md, paddingVertical: space.xxl },
  halo: { width: 132, height: 132, borderRadius: 66, alignItems: 'center', justifyContent: 'center', backgroundColor: color.accentSoft, marginBottom: space.lg },
  haloIn: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', backgroundColor: color.blue },
  doneTitle: { ...type.title, color: color.text, textAlign: 'center' },
  doneBody: { ...type.body, color: color.textSecondary, textAlign: 'center', maxWidth: 380 },
  nextSteps: { alignSelf: 'stretch', ...card, borderRadius: radius.lg, padding: space.lg, gap: space.md, marginTop: space.md },
  nextRow: { flexDirection: 'row', gap: space.md, alignItems: 'center' },
  nextNum: { ...type.label, color: color.link, width: 22, height: 22, borderRadius: 11, textAlign: 'center', lineHeight: 22, backgroundColor: color.accentSoft },
  nextText: { ...type.body, color: color.text, flex: 1 },
});
