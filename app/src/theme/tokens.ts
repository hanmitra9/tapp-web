import type { TextStyle, ViewStyle } from 'react-native';

// TAPP design tokens — dark theme. Near-black canvas, dark gray surfaces, TAPP Blue as the single accent.
export const color = {
  bg: '#060608',               // deepest black (chips on surfaces)
  canvas: 'transparent',       // screens: let the page gradient (src/lib/webStyles.ts) show through
  panel: 'rgba(17,17,22,0.86)',            // desktop form card (inputs/chips stay visible on it)
  surface: '#141419',          // cards, inputs, chips
  surfaceRaised: '#1D1D24',    // circular actions, selected segment, tab bar
  border: 'rgba(255,255,255,0.08)',           // hairlines / dividers
  borderStrong: 'rgba(255,255,255,0.16)',
  text: '#F4F4F5',
  textSecondary: '#A1A1AA',
  textMuted: '#6B6B73',
  blue: '#2F66F2',             // TAPP Blue
  bluePressed: '#1F52D6',
  link: '#8FB0FF',             // blue text (links, actions) — readable on near-black
  blueLight: '#7DA2FF',        // gradient end (replaces the reference's lavender)
  blueDeep: '#1D47C4',         // gradient start
  accentSoft: 'rgba(47,102,242,0.18)',
  onAccent: '#FFFFFF',
  success: '#34D07A',          // income green
  successSoft: 'rgba(52,208,122,0.14)',
  warning: '#FFB020',
  warningSoft: 'rgba(255,176,32,0.14)',
  danger: '#FF5A5F',
  dangerSoft: 'rgba(255,90,95,0.14)',
} as const;

export const gradient = {
  card: [color.blueDeep, color.blue, color.blueLight] as const,   // balance card
  button: ['#5F93FF', '#2F66F2', '#1D47C4'] as const,              // primary button, same as the website
} as const;

// Geist, self-hosted (public/fonts). Like the website, weights sit one step lighter: "bold" renders SemiBold.
export const font = {
  regular: 'Geist-Regular',
  medium: 'Geist-Medium',
  semibold: 'Geist-SemiBold',
  bold: 'Geist-SemiBold',
  display: 'InterTight',       // headings and big numbers, same face as the website
} as const;

// ≈1.2 modular scale. Medium headings with tight tracking, regular body (matches the website). Display sizes track tight; metrics use tabular figures so numbers don't jitter when they animate.
export const type = {
  display: { fontFamily: font.display, fontWeight: '500', fontSize: 34, lineHeight: 40, letterSpacing: -0.6 },
  title: { fontFamily: font.display, fontWeight: '500', fontSize: 26, lineHeight: 32, letterSpacing: -0.4 },
  heading: { fontFamily: font.display, fontWeight: '500', fontSize: 18, lineHeight: 24, letterSpacing: -0.2 },
  body: { fontFamily: font.regular, fontSize: 16, lineHeight: 23 },
  label: { fontFamily: font.medium, fontSize: 14, lineHeight: 18 },
  caption: { fontFamily: font.regular, fontSize: 13, lineHeight: 18 },
  metric: { fontFamily: font.display, fontWeight: '500', fontSize: 32, lineHeight: 38, letterSpacing: -0.6, fontVariant: ['tabular-nums'] },
} satisfies Record<string, TextStyle>;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 } as const;
export const radius = { sm: 10, md: 14, lg: 18, xl: 22, pill: 999 } as const;
export const hairline = 1;

// Premium card surface (web): top-lit gradient, hairline border, deep soft shadow — same as the website cards.
export const card = {
  backgroundColor: '#101016', borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
  backgroundImage: 'linear-gradient(180deg, rgba(255,255,255,0.045) 0%, rgba(255,255,255,0.012) 45%, rgba(255,255,255,0) 100%)',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05), 0 24px 60px -34px rgba(0,0,0,0.95)',
} as ViewStyle;
