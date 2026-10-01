// Maps Supabase auth errors and TAPP RPC codes (raised in SQL) to user-facing copy.
const COPY: Record<string, string> = {
  // auth
  invalid_credentials: 'Email atau kata sandi salah.',
  email_not_confirmed: 'Verifikasi email kamu untuk melanjutkan.',
  user_already_exists: 'Email ini sudah terdaftar. Silakan masuk.',
  email_exists: 'Email ini sudah terdaftar. Silakan masuk.',
  weak_password: 'Gunakan kata sandi yang lebih kuat: minimal 8 karakter, dengan huruf dan angka.',
  otp_expired: 'Kode sudah kedaluwarsa. Minta kode baru.',
  over_email_send_rate_limit: 'Terlalu banyak email terkirim. Tunggu sebentar, lalu coba lagi.',
  over_request_rate_limit: 'Terlalu banyak percobaan. Tunggu sebentar, lalu coba lagi.',
  same_password: 'Kata sandi baru harus berbeda dari yang sekarang.',
  session_not_found: 'Sesi kamu berakhir. Silakan masuk lagi.',
  refresh_token_not_found: 'Sesi kamu berakhir. Silakan masuk lagi.',
  login_verification_required: 'Demi keamanan, masuk ulang dan masukkan kode yang dikirim ke emailmu.',
  network: 'Tidak bisa terhubung ke TAPP. Periksa koneksi internet, lalu coba lagi.',
  // TAPP domain codes — keep in sync with supabase/migrations/*_functions.sql
  not_authenticated: 'Sesi kamu berakhir. Silakan masuk lagi.',
  email_not_verified: 'Verifikasi email kamu terlebih dahulu.',
  username_taken: 'Username ini sudah dipakai.',
  niche_required: 'Pilih minimal satu niche.',
  platform_required: 'Hubungkan minimal satu akun media sosial.',
  main_platform_not_linked: 'Hubungkan akun di platform utama kamu.',
  payout_method_required: 'Tambahkan metode pencairan untuk menyelesaikan.',
  campaign_not_found: 'Campaign ini sudah tidak tersedia.',
  campaign_not_active: 'Campaign ini sudah tidak aktif.',
  campaign_not_started: 'Campaign ini belum dimulai.',
  campaign_closed: 'Campaign ini sudah tidak menerima kreator baru.',
  campaign_not_accepting: 'Campaign ini sedang tidak menerima submission.',
  campaign_budget_exhausted: 'Budget campaign ini sudah habis.',
  membership_removed: 'Kamu telah dikeluarkan dari campaign ini.',
  platform_not_eligible: 'Hubungkan akun di salah satu platform campaign ini untuk bergabung.',
  not_a_member: 'Gabung ke campaign ini sebelum submit konten.',
  invalid_url: 'Masukkan link lengkap postinganmu, diawali https://',
  short_link_not_allowed: 'Link pendek tidak bisa diverifikasi. Buka postingan dan salin link lengkapnya.',
  url_platform_mismatch: 'Link ini tidak sesuai dengan platform yang kamu pilih.',
  platform_not_allowed: 'Campaign ini tidak menerima platform tersebut.',
  platform_account_not_linked: 'Hubungkan akunmu di platform ini terlebih dahulu.',
  invalid_published_at: 'Periksa tanggal publikasi.',
  published_before_join: 'Hanya postingan yang dipublikasikan setelah kamu bergabung yang dihitung.',
  duplicate_submission: 'Postingan ini sudah pernah disubmit.',
  submission_deadline_passed: 'Batas waktu submission sudah lewat.',
  submission_rate_limited: 'Kamu sudah mencapai batas submission hari ini. Coba lagi besok.',
  payout_below_minimum: 'Saldo tersedia masih di bawah minimum pencairan.',
  payout_already_open: 'Kamu masih punya pencairan yang sedang diproses.',
  payout_method_missing: 'Tambahkan metode pencairan terlebih dahulu.',
  platform_in_use: 'Akun ini masih dipakai di submission yang aktif, jadi belum bisa dihapus.',
  platform_account_taken: 'Akun ini sudah terhubung ke kreator lain. Hubungi support kalau ini akunmu.',
  profile_locked: 'Profil tidak bisa diubah selama akun ditangguhkan.',
  upload_failed: 'Gagal mengunggah foto. Coba lagi.',
  submission_not_found: 'Submission tidak ditemukan.',
  submission_not_editable: 'Submission ini sudah diproses dan tidak bisa diubah lagi.',
  invalid_screenshot_path: 'Screenshot tidak valid. Unggah ulang.',
  ticket_rate_limited: 'Kamu sudah mengirim 5 pertanyaan hari ini. Coba lagi besok.',
  dispute_open: 'Keberatan untuk ini masih diproses.',
  idempotency_key_required: 'Terjadi kesalahan. Coba lagi.',
  permission_denied: 'Kamu tidak punya akses untuk tindakan ini.',
  invalid_data: 'Ada data yang tidak valid. Periksa lagi isianmu.',
};

// Postgres constraint names → domain codes.
function fromPostgres(code: string | undefined, msg: string): string | null {
  if (code === '23505') {
    if (msg.includes('username')) return 'username_taken';
    if (msg.includes('creator_platforms_account_key')) return 'platform_account_taken';
    if (msg.includes('disputes_one_open')) return 'dispute_open';
    return 'invalid_data';
  }
  if (code === '23514') return msg.includes('username_not_reserved') ? 'username_taken' : 'invalid_data';
  if (code === '42501') return 'permission_denied';
  return null;
}

type ErrLike = { code?: string; message?: string; name?: string } | null | undefined;

export function errorMessage(err: unknown): string {
  const e = err as ErrLike;
  if (!e) return 'Terjadi kesalahan. Coba lagi.';
  const msg = e.message ?? '';
  if (e.name === 'AuthRetryableFetchError' || /network request failed|failed to fetch/i.test(msg)) return COPY.network!;
  if (e.code && COPY[e.code]) return COPY[e.code]!;
  const pg = fromPostgres(e.code, msg);
  if (pg) return COPY[pg]!;
  const domain = msg.split(':')[0]?.trim();
  if (domain && COPY[domain]) return COPY[domain]!;
  if (msg.startsWith('creator_not_eligible')) return 'Akunmu belum disetujui untuk ikut campaign.';
  if (/token has expired|otp.*(invalid|expired)|invalid.*token/i.test(msg)) return 'Kode tidak valid atau sudah kedaluwarsa. Minta kode baru.';
  return 'Terjadi kesalahan. Coba lagi.';
}

export const isEmailNotConfirmed = (err: unknown) => (err as ErrLike)?.code === 'email_not_confirmed';
