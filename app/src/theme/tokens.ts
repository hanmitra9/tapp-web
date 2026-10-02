import type { TextStyle } from 'react-native';

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
  blue: '#4548F5',             // TAPP Blue
  bluePressed: '#2F45D6',
  link: '#8FA2FF',             // blue text (links, actions) — readable on near-black
  blueLight: '#7DA2FF',        // gradient end (replaces the reference's lavender)
  blueDeep: '#2238C2',         // gradient start
  accentSoft: 'rgba(69,72,245,0.18)',
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
  button: ['#7A88FF', '#5059F8', '#3A3FD8'] as const,              // primary button, same as the website
} as const;

// Geist, self-hosted (public/fonts). Like the website, weights sit one step lighter: "bold" renders SemiBold.
export const font = {
  regular: 'Geist-Regular',
  medium: 'Geist-Medium',
  semibold: 'Geist-SemiBold',
  bold: 'Geist-SemiBold',
} as const;

// ≈1.2 modular scale. Medium headings with tight tracking, regular body (matches the website). Display sizes track tight; metrics use tabular figures so numbers don't jitter when they animate.
export const type = {
  display: { fontFamily: font.medium, fontSize: 32, lineHeight: 38, letterSpacing: -1.1 },
  title: { fontFamily: font.medium, fontSize: 24, lineHeight: 30, letterSpacing: -0.7 },
  heading: { fontFamily: font.medium, fontSize: 17, lineHeight: 22, letterSpacing: -0.3 },
  body: { fontFamily: font.regular, fontSize: 16, lineHeight: 23 },
  label: { fontFamily: font.medium, fontSize: 14, lineHeight: 18 },
  caption: { fontFamily: font.regular, fontSize: 13, lineHeight: 18 },
  metric: { fontFamily: font.medium, fontSize: 30, lineHeight: 36, letterSpacing: -1, fontVariant: ['tabular-nums'] },
} satisfies Record<string, TextStyle>;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 } as const;
export const radius = { sm: 10, md: 14, lg: 18, xl: 22, pill: 999 } as const;
export const hairline = 1;
