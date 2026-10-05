// Stored values are stable slugs; labels are display-only and can be re-worded freely.
export type Platform = 'tiktok' | 'instagram' | 'youtube' | 'x' | 'facebook' | 'other';
export type Experience = 'none' | 'beginner' | 'intermediate' | 'advanced';
export type Option<T extends string = string> = { value: T; label: string };

export const PLATFORMS: Option<Platform>[] = [
  { value: 'tiktok', label: 'TikTok' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'youtube', label: 'YouTube' },
  { value: 'x', label: 'X' },
  { value: 'facebook', label: 'Facebook' },
  { value: 'other', label: 'Lainnya' },
];
export const platformLabel = (p: Platform | null | undefined) => PLATFORMS.find((o) => o.value === p)?.label ?? '—';

export const NICHES: Option[] = [
  { value: 'finance', label: 'Keuangan' }, { value: 'crypto', label: 'Kripto' }, { value: 'business', label: 'Bisnis' },
  { value: 'tech', label: 'Teknologi' }, { value: 'education', label: 'Edukasi' }, { value: 'self_improvement', label: 'Pengembangan diri' },
  { value: 'gaming', label: 'Gaming' }, { value: 'entertainment', label: 'Hiburan' }, { value: 'comedy', label: 'Komedi' },
  { value: 'sports', label: 'Olahraga' }, { value: 'food', label: 'Kuliner' }, { value: 'travel', label: 'Travel' },
  { value: 'fashion', label: 'Fashion' }, { value: 'beauty', label: 'Kecantikan' }, { value: 'health', label: 'Kesehatan & fitness' },
  { value: 'music', label: 'Musik' }, { value: 'automotive', label: 'Otomotif' }, { value: 'parenting', label: 'Parenting' },
  { value: 'lifestyle', label: 'Lifestyle' }, { value: 'news', label: 'Berita' },
];
export const MAX_NICHES = 3;

export const CONTENT_CATEGORIES: Option[] = [
  { value: 'podcast_clips', label: 'Klip podcast' }, { value: 'stream_clips', label: 'Klip live stream' },
  { value: 'film_series', label: 'Klip film & series' }, { value: 'talking_head', label: 'Talking head' },
  { value: 'tutorial', label: 'Tutorial' }, { value: 'product_review', label: 'Review produk' },
  { value: 'meme', label: 'Meme & komedi' }, { value: 'motivation', label: 'Motivasi' },
];
export const MAX_CATEGORIES = 5;

export const EXPERIENCE: Option<Experience>[] = [
  { value: 'none', label: 'Belum pernah clipping' },
  { value: 'beginner', label: 'Kurang dari 6 bulan' },
  { value: 'intermediate', label: '6 bulan – 2 tahun' },
  { value: 'advanced', label: 'Lebih dari 2 tahun' },
];

// Indonesian cities creators pick from (value = display name, stored in profiles.city / audience.cities).
export const CITIES: Option[] = ['Jakarta', 'Surabaya', 'Bandung', 'Medan', 'Semarang', 'Yogyakarta', 'Makassar', 'Denpasar', 'Malang',
  'Palembang', 'Tangerang', 'Bekasi', 'Depok', 'Bogor', 'Batam', 'Balikpapan', 'Pekanbaru', 'Manado'].map((c) => ({ value: c, label: c }));

export const COUNTRIES: Option[] = [
  { value: 'ID', label: 'Indonesia' }, { value: 'MY', label: 'Malaysia' }, { value: 'SG', label: 'Singapura' },
  { value: 'PH', label: 'Filipina' }, { value: 'TH', label: 'Thailand' }, { value: 'VN', label: 'Vietnam' },
  { value: 'US', label: 'Amerika Serikat' }, { value: 'GB', label: 'Inggris' }, { value: 'AU', label: 'Australia' },
];

export const AGE_RANGES: Option[] = [
  { value: '13-17', label: '13–17' }, { value: '18-24', label: '18–24' }, { value: '25-34', label: '25–34' },
  { value: '35-44', label: '35–44' }, { value: '45+', label: '45+' },
];
export const LANGUAGES: Option[] = [
  { value: 'id', label: 'Indonesia' }, { value: 'en', label: 'Inggris' }, { value: 'jv', label: 'Jawa' },
  { value: 'su', label: 'Sunda' }, { value: 'ms', label: 'Melayu' },
];

export const BANKS = ['BCA', 'Mandiri'];
export const EWALLETS = ['GoPay', 'ShopeePay', 'DANA'];

export const labelOf = (opts: Option[], v: string) => opts.find((o) => o.value === v)?.label ?? v;
