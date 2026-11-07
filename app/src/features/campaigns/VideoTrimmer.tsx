import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '@/components/Button';
import { Notice } from '@/components/Notice';
import { Segmented } from '@/components/Segmented';
import { card, color, radius, space, type } from '@/theme/tokens';

// Simple in-browser trimmer for a campaign's raw video: pick start/end, frame it 9:16 (crop or whole with a blurred
// background), export and download. Re-encoding runs in real time (a 30 s clip takes ~30 s) with canvas +
// MediaRecorder: MP4 where the browser can record it, otherwise WebM. Heavier editing stays in CapCut.
const W = 720, H = 1280, MAX_SEC = 180;
const MODES = [{ value: 'crop', label: 'Isi penuh' }, { value: 'fit', label: 'Utuh + latar blur' }];
const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}.${Math.floor((s % 1) * 10)}`;

function pickMime(): { mime: string; ext: string } | null {
  if (typeof MediaRecorder === 'undefined') return null;
  for (const [mime, ext] of [['video/mp4;codecs=avc1.42E01F,mp4a.40.2', 'mp4'], ['video/mp4;codecs=avc1.42E01F,opus', 'mp4'], ['video/mp4', 'mp4'], ['video/webm;codecs=vp9,opus', 'webm'],
    ['video/webm;codecs=vp8,opus', 'webm'], ['video/webm', 'webm']] as const) {
    if (MediaRecorder.isTypeSupported(mime)) return { mime, ext };
  }
  return null;
}

// Draws one frame of `v` into the 9:16 canvas. offset 0..1 = horizontal (or vertical) position of the crop.
function draw(ctx: CanvasRenderingContext2D, v: HTMLVideoElement, mode: string, offset: number) {
  const vw = v.videoWidth, vh = v.videoHeight;
  if (!vw || !vh) return;
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
  const cover = Math.max(W / vw, H / vh), contain = Math.min(W / vw, H / vh);
  if (mode === 'fit') {
    ctx.save(); ctx.filter = 'blur(28px) brightness(0.6)';
    const bw = vw * cover, bh = vh * cover;
    ctx.drawImage(v, (W - bw) / 2, (H - bh) / 2, bw, bh); ctx.restore();
    const fw = vw * contain, fh = vh * contain;
    ctx.drawImage(v, (W - fw) / 2, (H - fh) / 2, fw, fh);
  } else {
    const cw = W / cover, ch = H / cover;   // source region that fills the frame
    ctx.drawImage(v, (vw - cw) * offset, (vh - ch) * offset, cw, ch, 0, 0, W, H);
  }
}

export function VideoTrimmer({ src, title }: { src: string; title: string }) {
  const preview = useRef<HTMLVideoElement | null>(null);
  const canvas = useRef<HTMLCanvasElement | null>(null);
  const [dur, setDur] = useState(0);
  const [start, setStart] = useState(0);
  const [end, setEnd] = useState(0);
  const [mode, setMode] = useState('crop');
  const [offset, setOffset] = useState(0.5);
  const [progress, setProgress] = useState<number | null>(null);
  const [out, setOut] = useState<{ url: string; name: string; blob: Blob } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const cancel = useRef(false);
  const fmtOk = pickMime();

  // Preview: loop inside the chosen range and paint the 9:16 frame.
  useEffect(() => {
    const v = preview.current, c = canvas.current?.getContext('2d');
    if (!v || !c) return;
    let raf = 0;
    const tick = () => {
      if (progress == null) {
        if (v.currentTime < start || v.currentTime > end) v.currentTime = start;
        draw(c, v, mode, offset);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [start, end, mode, offset, progress]);
  useEffect(() => () => { if (out) URL.revokeObjectURL(out.url); }, [out]);

  function onMeta() {
    const v = preview.current!;
    const d = Number.isFinite(v.duration) ? v.duration : 0;
    setDur(d); setStart(0); setEnd(Math.min(d, 60));
    v.currentTime = 0; void v.play().catch(() => {});
  }

  async function exportClip() {
    if (!fmtOk) return;
    setError(null); setOut(null); cancel.current = false;
    const v = document.createElement('video');
    v.crossOrigin = 'anonymous'; v.src = src; v.playsInline = true; v.preload = 'auto';
    try {
      await new Promise<void>((ok, bad) => { v.onloadedmetadata = () => ok(); v.onerror = () => bad(new Error('load')); });
      const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
      const ctx = cv.getContext('2d')!;
      const stream = cv.captureStream(30);
      const ac = new AudioContext();
      const dest = ac.createMediaStreamDestination();
      ac.createMediaElementSource(v).connect(dest);   // audio goes to the recording only, not the speakers
      dest.stream.getAudioTracks().forEach((t) => stream.addTrack(t));
      const rec = new MediaRecorder(stream, { mimeType: fmtOk.mime, videoBitsPerSecond: 6_000_000 });
      const chunks: Blob[] = [];
      rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
      const stopped = new Promise<void>((ok) => { rec.onstop = () => ok(); });
      v.currentTime = start;
      await new Promise<void>((ok) => { v.onseeked = () => ok(); });
      setProgress(0);
      rec.start(500);
      await v.play();
      await new Promise<void>((ok) => {
        const step = () => {
          if (cancel.current || v.currentTime >= end || v.ended) { ok(); return; }
          draw(ctx, v, mode, offset);
          setProgress(Math.min(1, (v.currentTime - start) / Math.max(0.1, end - start)));
          requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      });
      v.pause(); rec.stop(); await stopped; void ac.close();
      if (cancel.current) return;
      const blob = new Blob(chunks, { type: fmtOk.mime.split(';')[0] });
      const name = `${title.replace(/[^\w-]+/g, '_').slice(0, 40) || 'klip'}_${Math.round(start)}-${Math.round(end)}s.${fmtOk.ext}`;
      setOut({ url: URL.createObjectURL(blob), name, blob });
    } catch {
      setError('Video tidak bisa diproses di browser ini. Unduh file aslinya lalu potong di CapCut.');
    } finally {
      setProgress(null); v.removeAttribute('src'); v.load();
    }
  }

  async function save() {
    if (!out) return;
    const file = new File([out.blob], out.name, { type: out.blob.type });
    const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
    if (nav.canShare?.({ files: [file] })) { try { await navigator.share({ files: [file], title: out.name }); return; } catch { /* fall back */ } }
    const a = document.createElement('a'); a.href = out.url; a.download = out.name; a.click();
  }

  const len = Math.max(0, end - start);
  const range = (value: number, onChange: (n: number) => void, label: string, max = dur) => (
    <input type="range" min={0} max={max || 0} step={0.1} value={value} aria-label={label} disabled={progress != null}
      onChange={(e) => onChange(Number(e.currentTarget.value))} style={{ width: '100%', accentColor: color.blue }} />
  );

  return (
    <View style={{ gap: space.lg }}>
      {!fmtOk ? <Notice tone="error" message="Browser ini belum bisa merekam video. Coba Chrome terbaru, atau unduh file aslinya." /> : null}
      <video ref={preview} src={src} crossOrigin="anonymous" muted playsInline loop={false} onLoadedMetadata={onMeta}
        onError={() => setError('Video tidak bisa dibuka. Coba muat ulang halaman.')} style={{ display: 'none' }} />
      <View style={styles.frame}>
        <canvas ref={canvas} width={W} height={H} style={{ width: '100%', height: '100%', display: 'block' }} aria-label="Pratinjau 9:16" />
      </View>
      <Segmented options={MODES} value={mode} onChange={setMode} />
      {mode === 'crop' ? (
        <View style={styles.box}>
          <Text style={styles.label}>Posisi bingkai</Text>
          <input type="range" min={0} max={1} step={0.01} value={offset} aria-label="Posisi bingkai" disabled={progress != null}
            onChange={(e) => setOffset(Number(e.currentTarget.value))} style={{ width: '100%', accentColor: color.blue }} />
        </View>
      ) : null}
      <View style={styles.box}>
        <View style={styles.row}><Text style={styles.label}>Mulai</Text><Text style={styles.value}>{fmt(start)}</Text></View>
        {range(start, (n) => { setStart(Math.min(n, Math.max(0, end - 1))); }, 'Detik mulai')}
        <View style={styles.row}><Text style={styles.label}>Selesai</Text><Text style={styles.value}>{fmt(end)}</Text></View>
        {range(end, (n) => { setEnd(Math.min(Math.max(n, start + 1), start + MAX_SEC, dur)); }, 'Detik selesai')}
        <Text style={styles.hint}>Durasi {fmt(len)} · maks {MAX_SEC / 60} menit · hasil 720×1280</Text>
      </View>
      {error ? <Notice tone="error" message={error} /> : null}
      {progress != null ? (
        <View style={styles.box}>
          <Text style={styles.label}>Memproses… {Math.round(progress * 100)}%</Text>
          <View style={styles.track}><View style={[styles.fill, { width: `${Math.max(2, progress * 100)}%` }]} /></View>
          <Text style={styles.hint}>Biarkan tab ini terbuka. Lama proses sama dengan durasi klip.</Text>
          <Button label="Batal" variant="secondary" onPress={() => { cancel.current = true; }} />
        </View>
      ) : out ? (
        <View style={{ gap: space.sm }}>
          <Button label="Simpan video" onPress={() => { void save(); }} />
          <Button label="Potong lagi" variant="secondary" onPress={() => setOut(null)} />
        </View>
      ) : (
        <Button label="Potong & buat video" onPress={() => { void exportClip(); }} disabled={!fmtOk || !dur || len < 1} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { alignSelf: 'center', width: '100%', maxWidth: 300, aspectRatio: 9 / 16, borderRadius: radius.lg, overflow: 'hidden', backgroundColor: '#000' },
  box: { ...card, borderRadius: radius.lg, padding: space.md, gap: space.sm },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  label: { ...type.label, color: color.text },
  value: { ...type.label, color: color.link, fontVariant: ['tabular-nums'] },
  hint: { ...type.caption, color: color.textMuted },
  track: { height: 8, borderRadius: 4, backgroundColor: color.surfaceRaised, overflow: 'hidden' },
  fill: { height: 8, borderRadius: 4, backgroundColor: color.blue },
});
