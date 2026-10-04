// TAPP mailer — Railway Function (Bun). Sends every TAPP email through the Resend HTTP API.
// Railway blocks outbound SMTP on Free/Trial/Hobby plans, so email goes over HTTPS instead.
//
// Routes
//   GET  /            health check
//   POST /auth-hook   Supabase Auth "Send Email" hook (signup OTP, password reset, email change, magic link, invite, reauth)
//   POST /send        app emails from the database (brand invite, payout paid/rejected, meeting booking); Bearer MAILER_SECRET
//
// Env
//   RESEND_API_KEY          Resend API key (re_...)
//   MAIL_FROM               e.g. "TAPP <support@yourdomain.com>" (domain verified in Resend)
//   REPLY_TO                where replies go, default tappcreators@gmail.com
//   SEND_EMAIL_HOOK_SECRET  from Supabase → Auth → Hooks → Send Email (format "v1,whsec_...")
//   MAILER_SECRET           shared with the database (Vault secret "mailer_secret")
//   APP_URL, SUPPORT_EMAIL (optional); PUBLIC_URL defaults to the Railway domain (used for /logo.png)

const env = (k: string, d = "") => (Bun.env[k] ?? d).trim();
const REPLY_TO = () => env("REPLY_TO", "tappcreators@gmail.com");
const SUPPORT = () => env("SUPPORT_EMAIL", "tappcreators@gmail.com");
const PUBLIC_URL = () => env("PUBLIC_URL", Bun.env.RAILWAY_PUBLIC_DOMAIN ? `https://${Bun.env.RAILWAY_PUBLIC_DOMAIN}` : "").replace(/\/$/, "");
// The app icon from the website (same mark as the site); falls back to this service's own /logo.png.
const LOGO = () => env("LOGO_URL", `${(Bun.env.APP_URL ?? "https://tappcreators.com").trim().replace(/\/$/, "") || "https://tappcreators.com"}/assets/icons/apple-touch-icon.png`) || (PUBLIC_URL() ? `${PUBLIC_URL()}/logo.png` : "");
const LOGO_PNG = Uint8Array.from(atob("iVBORw0KGgoAAAANSUhEUgAAAEgAAABICAMAAABiM0N1AAAA/1BMVEUbH64gMeMRGaUgM9khWOcOFqQfMdcZKcoxTPYqAFUcJrgAf39VAKoAAAA7VfwwR/MlNdMZJbYpPOUaKcYRHK4gLsQ6V/sdO+4aOcwtRPM7VfkME5kpN81AW/4mOeY3U/MgLL0ZGrAhM9UzVPATI7cHDZETG7EOGKcUJLIxSfgHDI0SJcwcKsQtSOk7VfccHMYkJtYpR9k2VvE5VfUAAH8SGrISHLMSHbEPHsIeK8kYKMkrK/k2O/wuRfUAAP8LEZQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACAf/NeAAAAQHRSTlMWI6RYFdCd44sGfwIDAP3+/v7+/P3/ywgNybX+Ef3QTf8L0BFT/ytTEbhXFcoSkQkLCy9yAm2PqP8sVwcLVgJTc0oVaQAAAr5JREFUeNrN2AmPojAUAGDAa/ZAjoIHQ4d1GBF1ZL1vZ/7/v1oqIC20gxQ3uy/GmGi+vPda2hcF+UEh/FXoxwDFbxS9a3R7XfTqduvo7dyNopd8WFChtfddekfxiuIljP4tOoxY1fPQm6SFYZqmGoWuK1i0GeFkIWGrRfFLVctIqwzk72JHM8tBmYyEnRHnkzrqHQ60FiS0SeoqCbWX5Kp5RgKZKaQoxdCKXH6/kSZkUvOhQ9ASSGhLS0gvTqizJHf2yCiGFPqKEdCtQcSSFUMw+CAg4baDNBNfsqLSYMclH9qNkTqstf+isBskJA0CwGRXxlh5DBo0MAh3Cp4PaPUI6GNr3CCyQwXbOmlQAm1iB6AgnAJoSZ6QnhFBgISyjsJsdAwNWnvMMe9NCEInc2ZviYRa9yUEYWeZOfxrkQNAvjL2robtwM3eIrv9fg8A6eg6Ox8IYbsdLPPX0RFg0QIgvjrQ5RFdIGMUVhrByllQ77XDQRA8bzqdzm3b9ge+H348ibPZAt1oi/l8fjqdXLc+r5/D721h/S9uWuoPXcdxq0L2zAmssM+WWwWaOU+WEq+5zQ2Jl3G48koC9Tih9aVP7iJOSBxn9yNfaTU9t7G5Mgod/RFQjXzYuCEx89jy9uijqasUqHxGYu5E4oSa+TOSq7TBa+6Q5OvRQaVDpUurqXSpdEZHBtTjhXAJ3dCzstAboENuecik1Wb95IBoUiDzQGYecspDaFDKTQBf9boQwlN6knkgDetSTNXLQ6NoCkwHisKE7oCS0aR/5oU0fMgpKIwJJbNpCl1kfgiXihwG9GncJNQo/UWUuaF0Pr3LYUATAxvh1abNPWhNnp9TqbaWK0JRcccqo18IRRJ4P8hVoWtxTb/aMDoZDq+QdLfDWv7hVdpUHo+FxnBoNEYPmLMFSZK8xwzs3/6rP+t44g8vPDhqyp3PCAAAAABJRU5ErkJggg=="), (c) => c.charCodeAt(0));
const APP = () => env("APP_URL").replace(/\/$/, "");

// ─────────────────────────────── templates ───────────────────────────────
const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[m]!);
const idr = (n: number) => "Rp" + Math.round(n).toLocaleString("id-ID");
const wib = (iso: unknown) => iso ? new Date(String(iso)).toLocaleString("id-ID", { timeZone: "Asia/Jakarta", weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }) + " WIB" : "-";

type Block = { title: string; intro: string; code?: string; button?: { label: string; url: string }; rows?: [string, string][]; outro?: string; eyebrow?: string };
// Same look as tappcreators.com: near-black canvas, deep-blue glow header, Inter-style type, blue gradient button.
// Email clients: tables + inline styles only; gradients have a solid background-color fallback (Outlook).
const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI','Inter',Helvetica,Arial,sans-serif";
function layout(preheader: string, b: Block) {
  const site = APP() || "https://tappcreators.com";
  const code = b.code
    ? `<tr><td style="padding:4px 0 26px"><table role="presentation" cellspacing="0" cellpadding="0"><tr><td style="padding:18px 28px;border-radius:16px;background-color:#041526;background-image:linear-gradient(180deg,#082647,#041220);border:1px solid #104E91;box-shadow:0 0 32px rgba(12,101,196,0.35);font:700 34px/1 'SFMono-Regular',Menlo,Consolas,monospace;letter-spacing:12px;color:#FFFFFF">${esc(b.code)}</td></tr></table></td></tr>`
    : "";
  const btn = b.button
    ? `<tr><td style="padding:4px 0 26px"><a href="${esc(b.button.url)}" style="display:inline-block;padding:15px 28px;border-radius:12px;background-color:#0C65C4;background-image:linear-gradient(180deg,#55A0F1 0%,#0C65C4 50%,#104F92 100%);border:1px solid #65A9F2;color:#FFFFFF;font:600 15px/1 ${FONT};text-decoration:none">${esc(b.button.label)} &rarr;</a></td></tr>`
    : "";
  const rows = b.rows?.length
    ? `<tr><td style="padding:0 0 24px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:separate;border-radius:14px;background-color:#0D0D13;border:1px solid #23232E">${b.rows
        .map(([k, v], i) => `<tr><td style="padding:13px 16px;${i ? "border-top:1px solid #1D1D27;" : ""}font:500 14px/20px ${FONT};color:#8E8E99">${esc(k)}</td><td align="right" style="padding:13px 16px;${i ? "border-top:1px solid #1D1D27;" : ""}font:600 14px/20px ${FONT};color:#FFFFFF">${esc(v)}</td></tr>`)
        .join("")}</table></td></tr>`
    : "";
  const logo = LOGO() ? `<img src="${esc(LOGO())}" width="34" height="34" alt="" style="display:block;border:0;border-radius:9px">` : "";
  return `<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="dark"><meta name="supported-color-schemes" content="dark"><title>${esc(b.title)}</title></head>
<body style="margin:0;padding:0;background-color:#050507">
<span style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(preheader)}</span>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#050507"><tr><td align="center" style="padding:28px 14px 40px">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:540px">
<tr><td style="border-radius:24px;overflow:hidden;background-color:#0E0E14;border:1px solid #23232E">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0">
<tr><td style="padding:26px 30px 24px;background-color:#051A31;background-image:radial-gradient(120% 140% at 100% 0%,#096EDA 0%,rgba(12,101,196,0.35) 35%,rgba(5,26,49,0) 70%),linear-gradient(135deg,#051629 0%,#092D52 60%,#104F92 100%)">
<table role="presentation" cellspacing="0" cellpadding="0"><tr><td style="padding-right:10px">${logo}</td><td style="font:700 20px/1 ${FONT};letter-spacing:-0.3px;color:#FFFFFF">TAPP</td></tr></table>
${b.eyebrow ? `<div style="padding-top:22px;font:600 11px/1 ${FONT};letter-spacing:2px;text-transform:uppercase;color:#A4CCF8">${esc(b.eyebrow)}</div>` : ""}
</td></tr>
<tr><td style="padding:30px 30px 8px">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0">
<tr><td style="padding:0 0 12px;font:600 26px/32px ${FONT};letter-spacing:-0.4px;color:#FFFFFF">${esc(b.title)}</td></tr>
<tr><td style="padding:0 0 24px;font:400 15px/24px ${FONT};color:#B9B9C4">${b.intro}</td></tr>
${code}${btn}${rows}
${b.outro ? `<tr><td style="padding:0 0 22px;font:400 13px/21px ${FONT};color:#8A8A95">${b.outro}</td></tr>` : ""}
</table></td></tr></table></td></tr>
<tr><td style="padding:24px 8px 0;font:400 12px/19px ${FONT};color:#6E6E7A">
<b style="color:#C2DDFA;font-weight:600">TAPP</b> &middot; Clip Jadi Penghasilan<br>
Email ini dikirim otomatis. Butuh bantuan? Balas email ini atau tulis ke <a href="mailto:${esc(SUPPORT())}" style="color:#75B2F4;text-decoration:none">${esc(SUPPORT())}</a>.<br>
<a href="${esc(site)}" style="color:#75B2F4;text-decoration:none">tappcreators.com</a> &middot; <a href="https://www.instagram.com/tappcreators" style="color:#75B2F4;text-decoration:none">Instagram</a> &middot; <a href="https://discord.gg/P29n8gWVu5" style="color:#75B2F4;text-decoration:none">Discord</a>
</td></tr>
</table></td></tr></table></body></html>`;
}
const text = (b: Block) =>
  [b.title, "", b.intro.replace(/<[^>]+>/g, ""), b.code ? `\nKode: ${b.code}\n` : "", b.button ? `${b.button.label}: ${b.button.url}` : "",
    ...(b.rows ?? []).map(([k, v]) => `${k}: ${v}`), b.outro ? "\n" + b.outro.replace(/<[^>]+>/g, "") : ""].filter((x) => x !== "").join("\n");

const IGNORE = "Kalau kamu tidak merasa meminta ini, abaikan email ini. Akunmu tetap aman.";
function authEmail(kind: string, token: string): { subject: string; block: Block } {
  switch (kind) {
    case "signup":
      return { subject: `${token} adalah kode verifikasi TAPP-mu`, block: { eyebrow: "Verifikasi akun", title: "Verifikasi email kamu", intro: "Masukkan kode ini di aplikasi TAPP untuk mengaktifkan akunmu. Kode berlaku 1 jam.", code: token, outro: IGNORE } };
    case "recovery":
      return { subject: `${token} adalah kode reset kata sandi TAPP`, block: { eyebrow: "Keamanan akun", title: "Reset kata sandi", intro: "Masukkan kode ini di aplikasi TAPP untuk membuat kata sandi baru. Kode berlaku 1 jam.", code: token, outro: IGNORE } };
    case "magiclink":
      // Second step of every sign-in: the password was accepted, this code finishes the login.
      return { subject: `${token} adalah kode masuk TAPP-mu`, block: { eyebrow: "Keamanan akun", title: "Verifikasi masuk", intro: "Ada yang baru saja masuk ke akun TAPP-mu dengan kata sandi yang benar. Masukkan kode ini untuk menyelesaikan login. Kode berlaku 1 jam.", code: token, outro: "Bukan kamu? Jangan bagikan kode ini ke siapa pun, lalu segera ganti kata sandi dari halaman Lupa kata sandi." } };
    case "email_change":
      return { subject: `${token} untuk konfirmasi ganti email TAPP`, block: { eyebrow: "Keamanan akun", title: "Konfirmasi ganti email", intro: "Masukkan kode ini di aplikasi TAPP untuk mengonfirmasi perubahan alamat email akunmu.", code: token, outro: IGNORE } };
    case "reauthentication":
      return { subject: `${token} adalah kode konfirmasi TAPP`, block: { eyebrow: "Keamanan akun", title: "Konfirmasi tindakan", intro: "Masukkan kode ini untuk melanjutkan tindakan di akunmu.", code: token, outro: IGNORE } };
    case "invite":
      return { subject: "Kamu diundang ke TAPP", block: { eyebrow: "Undangan", title: "Kamu diundang ke TAPP", intro: "Pakai kode ini untuk menyelesaikan pendaftaran akunmu.", code: token, outro: IGNORE } };
    default:
      return { subject: "Kode TAPP-mu", block: { eyebrow: "Kode verifikasi", title: "Kode TAPP", intro: "Masukkan kode ini di aplikasi TAPP.", code: token, outro: IGNORE } };
  }
}

const ROLE: Record<string, string> = { owner: "Pemilik", member: "Anggota", viewer: "Hanya lihat" };
function appEmail(type: string, d: Record<string, any>): { subject: string; block: Block } | null {
  if (type === "brand_invite") {
    const link = d.link || (APP() ? `${APP()}/register?invite=brand&email=${encodeURIComponent(d.email ?? "")}` : "");
    return {
      subject: d.brand_name ? `Undangan dashboard brand ${d.brand_name}` : "Undangan dashboard brand TAPP",
      block: {
        eyebrow: "Dashboard brand",
        title: `Kamu diundang ke dashboard ${esc(d.brand_name ?? "brand")}`,
        intro: `Tim TAPP membuka akses dashboard brand untukmu. Daftar dengan email ini, verifikasi, lalu laporan campaign ${esc(d.brand_name ?? "")} langsung terbuka.`,
        button: link ? { label: "Buka dashboard brand", url: link } : undefined,
        rows: [["Brand", d.brand_name ?? "-"], ["Peran", ROLE[d.role] ?? d.role ?? "-"], ["Berlaku sampai", d.expires_at ? new Date(d.expires_at).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" }) : "14 hari"]],
        outro: "Kalau kamu tidak mengenal undangan ini, abaikan saja email ini.",
      },
    };
  }
  if (type === "welcome") {
    const name = String(d.name ?? "").trim().split(/\s+/)[0];
    return {
      subject: "Selamat datang di TAPP",
      block: {
        eyebrow: "Selamat datang",
        title: name ? `Selamat datang di TAPP, ${esc(name)}` : "Selamat datang di TAPP",
        intro: "Akunmu sudah aktif. Di TAPP kamu mengerjakan campaign dari brand, posting di akunmu sendiri, dan dibayar dari views yang lolos verifikasi. Empat langkah untuk mulai:",
        rows: [["1. Hubungkan akun", "TikTok, Instagram, YouTube"], ["2. Verifikasi kode bio", "Tempel kode TAPP di bio"], ["3. Join campaign", "Mulai dari TAPP Mega Campaign"], ["4. Submit & tarik saldo", "Bayaran masuk saldo, tarik ke rekeningmu"]],
        button: APP() ? { label: "Buka TAPP", url: APP() } : undefined,
        outro: "Pertanyaan? Balas email ini, tim TAPP siap bantu.",
      },
    };
  }
  if (type === "payout_paid") {
    return {
      subject: `Pencairan ${idr(Number(d.amount))} sudah ditransfer`,   // amount = net (balance + level bonus − withdrawal fee)
      block: {
        eyebrow: "Pembayaran",
        title: "Pencairan saldomu sudah ditransfer",
        intro: "Saldo yang kamu tarik sudah kami transfer. Biasanya langsung masuk, tapi beberapa bank bisa butuh waktu sampai 1 hari kerja.",
        rows: [["Diterima", idr(Number(d.amount))], ...(Number(d.bonus) > 0 ? ([["Bonus level", idr(Number(d.bonus))]] as [string, string][]) : []), ...(Number(d.fee) > 0 ? ([["Fee platform & transfer", idr(Number(d.fee))]] as [string, string][]) : []), ["Tujuan", d.method ?? "-"], ...(d.reference ? ([["Referensi", String(d.reference)]] as [string, string][]) : [])],
        button: APP() ? { label: "Lihat riwayat pembayaran", url: `${APP()}/dashboard/earnings` } : undefined,
      },
    };
  }
  if (type === "payout_rejected") {
    return {
      subject: "Transfer bayaranmu belum bisa diproses",
      block: {
        eyebrow: "Pembayaran",
        title: "Transfer belum bisa diproses",
        intro: "Pencairan saldomu belum bisa kami proses dan saldonya sudah kembali utuh. Perbaiki hal di bawah ini (biasanya data rekening atau e-wallet), lalu tarik lagi dari menu Pembayaran.",
        rows: [["Jumlah", idr(Number(d.amount))], ["Alasan", d.reason ?? "-"]],
        button: APP() ? { label: "Periksa rekening", url: `${APP()}/profile/payout` } : undefined,
        outro: "Ada pertanyaan? Balas email ini.",
      },
    };
  }
  if (type === "brand_daily_report") {
    const day = d.day ? new Date(`${d.day}T00:00:00+07:00`).toLocaleDateString("id-ID", { timeZone: "Asia/Jakarta", weekday: "long", day: "numeric", month: "long" }) : "kemarin";
    const nf = (n: unknown) => Math.round(Number(n ?? 0)).toLocaleString("id-ID");
    const camps = (Array.isArray(d.campaigns) ? d.campaigns : []) as Record<string, any>[];
    const rows: [string, string][] = [
      ["Qualified views baru", `+${nf(d.qualified_gain)}`],
      ["Biaya views", idr(Number(d.spend))],
      ...(Number(d.fee_pct) > 0 ? ([[`Fee kerjasama (${nf(d.fee_pct)}%)`, idr(Number(d.fee))]] as [string, string][]) : []),
      ...camps.slice(0, 5).map((c): [string, string] => [String(c.title ?? "Campaign"),
        `${nf(c.qualified)} qualified · ${nf(c.raw)} mentah${Number(c.pending) > 0 ? ` · ${nf(c.pending)} menunggu verifikasi` : ""} · sisa ${idr(Number(c.remaining))}`]),
    ];
    return {
      subject: `Laporan ${d.brand ?? "brand"}: +${nf(d.qualified_gain)} qualified views (${day})`,
      block: {
        eyebrow: "Laporan harian",
        title: `Laporan harian ${esc(d.brand ?? "")}`,
        intro: `Ringkasan ${esc(day)} (WIB). Angka qualified views dan biaya sudah melalui verifikasi tim TAPP; views mentah yang baru masuk tercatat sebagai "menunggu verifikasi".`,
        rows,
        button: APP() ? { label: "Buka dashboard brand", url: `${APP()}/brand` } : undefined,
        outro: "Tidak ingin menerima laporan harian? Matikan di dashboard brand → Akun.",
      },
    };
  }
  if (type === "meeting_received") {
    return {
      subject: `Permintaan meeting TAPP: ${wib(d.slot)}`,
      block: {
        eyebrow: "Meeting",
        title: "Permintaan meeting kamu sudah kami terima",
        intro: `Halo ${esc(String(d.name ?? "").split(/\s+/)[0] || "")}, tim TAPP akan mengonfirmasi jadwal ini dan mengirim link meeting ke email ini, biasanya dalam 1 hari kerja.`,
        rows: [["Waktu", wib(d.slot)], ["Durasi", "30–60 menit, online"]],
        outro: "Perlu ganti jadwal? Balas email ini.",
      },
    };
  }
  if (type === "meeting_admin_alert") {
    return {
      subject: `Meeting baru: ${d.company ?? "-"} · ${wib(d.slot)}`,
      block: {
        eyebrow: "Admin · Meeting",
        title: "Permintaan meeting baru",
        intro: `${esc(d.name)} dari ${esc(d.company)} memilih jadwal di website. Konfirmasi dan kirim link meeting dari panel admin.`,
        rows: [["Waktu", wib(d.slot)], ["Email", d.email ?? "-"], ["WhatsApp", d.whatsapp ?? "-"], ["Budget", d.budget_range ?? "-"], ["Tujuan", d.goal ?? "-"]],
        button: APP() ? { label: "Buka Admin → Meeting", url: `${APP()}/admin/meetings` } : undefined,
      },
    };
  }
  if (type === "meeting_scheduled") {
    return {
      subject: `Jadwal meeting TAPP dikonfirmasi: ${wib(d.slot)}`,
      block: {
        eyebrow: "Meeting dikonfirmasi",
        title: "Sampai jumpa di meeting",
        intro: `Jadwalmu dengan tim TAPP sudah dikonfirmasi. Kita akan membahas tujuan, audiens, platform, dan tarif campaign-mu.`,
        rows: [["Waktu", wib(d.slot)], ["Link", d.meet_link ?? "-"]],
        button: d.meet_link ? { label: "Gabung meeting", url: d.meet_link } : undefined,
        outro: "Perlu ganti jadwal? Balas email ini.",
      },
    };
  }
  return null;
}

// ─────────────────────────────── delivery ───────────────────────────────
async function send(to: string, subject: string, block: Block, idempotencyKey?: string) {
  const key = env("RESEND_API_KEY");
  if (!key) throw new Error("RESEND_API_KEY is not set");
  const from = env("MAIL_FROM", "TAPP <onboarding@resend.dev>");
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey.slice(0, 256) } : {}) },
    body: JSON.stringify({ from, to: [to], reply_to: REPLY_TO(), subject, html: layout(subject, block), text: text(block) }),
  });
  if (!res.ok) throw new Error(`Resend ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return (await res.json()) as { id: string };
}

// Standard Webhooks signature (what Supabase Auth hooks use): HMAC-SHA256 over "id.timestamp.body".
async function verifyHook(req: Request, body: string) {
  const secret = env("SEND_EMAIL_HOOK_SECRET").replace(/^v1,/, "").replace(/^whsec_/, "");
  if (!secret) return false;
  const id = req.headers.get("webhook-id"), ts = req.headers.get("webhook-timestamp"), sigs = req.headers.get("webhook-signature");
  if (!id || !ts || !sigs) return false;
  if (Math.abs(Date.now() / 1000 - Number(ts)) > 300) return false;
  const keyBytes = Uint8Array.from(atob(secret), (c) => c.charCodeAt(0));
  const k = await crypto.subtle.importKey("raw", keyBytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(`${id}.${ts}.${body}`)));
  const expected = btoa(String.fromCharCode(...mac));
  return sigs.split(" ").some((s) => {
    const v = s.split(",")[1] ?? "";
    if (v.length !== expected.length) return false;
    let diff = 0;
    for (let i = 0; i < v.length; i++) diff |= v.charCodeAt(i) ^ expected.charCodeAt(i);
    return diff === 0;
  });
}

const json = (status: number, obj: unknown) => new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json" } });
const hookError = (status: number, message: string) => json(status, { error: { http_code: status, message } });

Bun.serve({
  port: Number(Bun.env.PORT ?? 3000),
  async fetch(req) {
    const url = new URL(req.url);
    if (req.method === "GET" && url.pathname === "/") {
      return json(200, { ok: true, service: "tapp-mailer", resend: !!env("RESEND_API_KEY"), hook: !!env("SEND_EMAIL_HOOK_SECRET"), from: env("MAIL_FROM", "TAPP <onboarding@resend.dev>") });
    }

    if (req.method === "GET" && url.pathname === "/logo.png") {
      return new Response(LOGO_PNG, { headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=604800" } });
    }

    if (req.method === "POST" && url.pathname === "/auth-hook") {
      const body = await req.text();
      if (!(await verifyHook(req, body))) return hookError(401, "invalid signature");
      try {
        const p = JSON.parse(body);
        const user = p.user ?? {}, d = p.email_data ?? {};
        const kind = String(d.email_action_type ?? "");
        const hookId = req.headers.get("webhook-id") ?? undefined;
        if (kind === "email_change" && user.new_email) {
          // Secure email change: one code to the current address, another to the new one.
          if (d.token) { const m = authEmail(kind, d.token); await send(user.email, m.subject, m.block, hookId && hookId + ":old"); }
          if (d.token_new) { const m = authEmail(kind, d.token_new); await send(user.new_email, m.subject, m.block, hookId && hookId + ":new"); }
        } else {
          const m = authEmail(kind, d.token);
          await send(user.email, m.subject, m.block, hookId);
        }
        console.log(JSON.stringify({ at: "auth-hook", kind, ok: true }));
        return json(200, {});
      } catch (e) {
        console.error(JSON.stringify({ at: "auth-hook", error: String(e) }));
        return hookError(500, "Email tidak terkirim. Coba lagi sebentar.");
      }
    }

    if (req.method === "POST" && url.pathname === "/send") {
      const secret = env("MAILER_SECRET");
      const auth = req.headers.get("authorization") ?? "";
      if (!secret || auth !== `Bearer ${secret}`) return json(401, { error: "unauthorized" });
      try {
        const { type, to, data, key } = await req.json();
        if (typeof to !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(to)) return json(400, { error: "invalid recipient" });
        const m = appEmail(String(type), data ?? {});
        if (!m) return json(400, { error: "unknown type" });
        const r = await send(to, m.subject, m.block, key);
        console.log(JSON.stringify({ at: "send", type, ok: true, id: r.id }));
        return json(200, { id: r.id });
      } catch (e) {
        console.error(JSON.stringify({ at: "send", error: String(e) }));
        return json(502, { error: String(e).slice(0, 300) });
      }
    }
    return json(404, { error: "not found" });
  },
});
console.log("tapp-mailer listening");
