// Keep in sync with app/src/features/creator/options.ts (same slugs).
export const NICHES: [string, string][] = [
  ['finance', 'Keuangan'], ['crypto', 'Kripto'], ['business', 'Bisnis'], ['tech', 'Teknologi'], ['education', 'Edukasi'],
  ['self_improvement', 'Pengembangan diri'], ['gaming', 'Gaming'], ['entertainment', 'Hiburan'], ['comedy', 'Komedi'], ['sports', 'Olahraga'],
  ['food', 'Kuliner'], ['travel', 'Travel'], ['fashion', 'Fashion'], ['beauty', 'Kecantikan'], ['health', 'Kesehatan & fitness'],
  ['music', 'Musik'], ['automotive', 'Otomotif'], ['parenting', 'Parenting'], ['lifestyle', 'Lifestyle'], ['news', 'Berita'],
];
export const CONTENT_TYPES: [string, string][] = [
  ['podcast_clips', 'Klip podcast'], ['stream_clips', 'Klip live stream'], ['film_series', 'Klip film & series'], ['talking_head', 'Talking head'],
  ['tutorial', 'Tutorial'], ['product_review', 'Review produk'], ['meme', 'Meme & komedi'], ['motivation', 'Motivasi'],
];
export const PLATFORMS: [string, string][] = [['tiktok', 'TikTok'], ['instagram', 'Instagram'], ['youtube', 'YouTube'], ['x', 'X'], ['facebook', 'Facebook'], ['other', 'Lainnya']];
export const label = (list: [string, string][], v: string) => list.find(([k]) => k === v)?.[1] ?? v;
