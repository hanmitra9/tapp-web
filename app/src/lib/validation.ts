export const normalizeEmail = (v: string) => v.trim().toLowerCase();

export function validateEmail(v: string): string | null {
  const s = normalizeEmail(v);
  if (!s) return 'Masukkan email kamu.';
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s) ? null : 'Masukkan alamat email yang valid.';
}

export function validatePassword(v: string): string | null {
  if (v.length < 8) return 'Gunakan minimal 8 karakter.';
  if (!/[A-Za-z]/.test(v) || !/\d/.test(v)) return 'Gunakan minimal satu huruf dan satu angka.';
  return null;
}

export function validateName(v: string): string | null {
  const s = v.trim();
  if (!s) return 'Masukkan nama kamu.';
  return s.length > 80 ? 'Maksimal 80 karakter.' : null;
}

export const validateOtp = (v: string): string | null => (/^\d{6}$/.test(v) ? null : 'Masukkan kode 6 digit.');

export function validateUsername(v: string): string | null {
  const s = v.trim().toLowerCase();
  if (s.length < 3) return 'Minimal 3 karakter.';
  if (s.length > 24) return 'Maksimal 24 karakter.';
  return /^[a-z0-9_.]+$/.test(s) ? null : 'Hanya huruf kecil, angka, titik, dan garis bawah.';
}
