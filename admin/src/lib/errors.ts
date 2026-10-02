// Admin-facing messages for RPC error codes. The raw code is kept in brackets — admins benefit from it.
const COPY: Record<string, string> = {
  forbidden: 'Akun ini bukan admin.',
  reason_required: 'Alasan wajib diisi.',
  already_disconnected: 'Koneksi ini sudah diputus.',
  invalid_transition: 'Perubahan status ini tidak diizinkan dari status sekarang.',
  submission_not_trackable: 'Submission harus disetujui dulu sebelum metrik dicatat.',
  submission_not_tracking: 'Qualified views hanya bisa dihitung untuk submission berstatus Dilacak.',
  qualified_exceeds_raw: 'Qualified views tidak boleh melebihi raw views.',
  decrease_requires_flag: 'Qualified views lebih kecil dari sebelumnya. Centang "izinkan penurunan" dan isi alasan.',
  metric_not_found: 'Snapshot metrik tidak ditemukan untuk submission ini.',
  reverse_earnings_first: 'Submission sudah punya penghasilan. Turunkan qualified views ke 0 dulu sebelum menolak.',
  onboarding_incomplete: 'Kreator belum menyelesaikan onboarding.',
  reference_required: 'Nomor referensi transfer wajib diisi.',
  terms_locked_after_draft: 'Syarat komersial (CPM, budget, minimum views) terkunci setelah draft. Ubah budget lewat "Atur budget".',
  brand_required: 'Isi nama brand.', title_required: 'Judul wajib diisi.', cpm_required: 'CPM harus lebih dari 0.', budget_required: 'Budget harus lebih dari 0.',
  platform_required: 'Pilih minimal satu platform.', campaign_budget_exhausted: 'Budget sudah habis. Tambah budget dulu.',
  campaign_expired: 'Tanggal berakhir campaign sudah lewat.', budget_below_earned: 'Budget baru lebih kecil dari yang sudah dialokasikan ke kreator.',
  already_member: 'Email ini sudah menjadi anggota brand.', invalid_email: 'Format email tidak valid.',
  payout_method_missing: 'Kreator belum mengisi rekening / e-wallet. Minta kreator mengisinya di Profil → Metode pembayaran.',
  nothing_to_pay: 'Tidak ada yang perlu dibayar: views di bawah minimum, sudah dibayar penuh, atau budget campaign habis.',
  views_below_paid: 'Views lebih kecil dari yang sudah dibayar sebelumnya.', invalid_views: 'Isi angka views.',
  submission_not_payable: 'Submission harus diterima dulu sebelum dibayar.',
  payout_already_open: 'Kreator masih punya pencairan lama yang belum selesai. Selesaikan di halaman Pencairan.',
  invalid_captured_at: 'Waktu pengambilan metrik tidak boleh di masa depan.',
};
export function adminError(e: unknown): string {
  const msg = (e as { message?: string })?.message ?? String(e);
  const code = msg.split(':')[0]!.trim();
  if (/failed to fetch|network/i.test(msg)) return 'Tidak bisa terhubung ke server. Periksa koneksi.';
  return COPY[code] ? `${COPY[code]} (${msg})` : msg;
}
