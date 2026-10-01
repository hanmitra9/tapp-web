import type { TextStyle } from 'react-native';

// TAPP design tokens — dark theme. Near-black canvas, dark gray surfaces, TAPP Blue as the single accent.
export const color = {
  bg: '#0A0A0C',               // screen canvas
  panel: '#111114',            // desktop form card (inputs/chips stay visible on it)
  surface: '#18181B',          // cards, inputs, chips
  surfaceRaised: '#222226',    // circular actions, selected segment, tab bar
  border: '#232327',           // hairlines / dividers
  borderStrong: '#3A3A40',
  text: '#FFFFFF',
  textSecondary: '#A1A1AA',
  textMuted: '#6B6B73',
  blue: '#4548F5',             // TAPP Blue
  bluePressed: '#2F45D6',
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
} as const;

export const font = {
  regular: 'InstrumentSans_400Regular',
  medium: 'InstrumentSans_500Medium',
  semibold: 'InstrumentSans_600SemiBold',
  bold: 'InstrumentSans_700Bold',
} as const;

// ≈1.2 modular scale, one weight step heavier than default to match the reference (bold headings, medium body). Display sizes track tight; metrics use tabular figures so numbers don't jitter when they animate.
export const type = {
  display: { fontFamily: font.bold, fontSize: 32, lineHeight: 38, letterSpacing: -0.8 },
  title: { fontFamily: font.bold, fontSize: 24, lineHeight: 30, letterSpacing: -0.4 },
  heading: { fontFamily: font.bold, fontSize: 17, lineHeight: 22, letterSpacing: -0.2 },
  body: { fontFamily: font.medium, fontSize: 16, lineHeight: 23 },
  label: { fontFamily: font.semibold, fontSize: 14, lineHeight: 18 },
  caption: { fontFamily: font.medium, fontSize: 13, lineHeight: 18 },
  metric: { fontFamily: font.bold, fontSize: 30, lineHeight: 36, letterSpacing: -0.6, fontVariant: ['tabular-nums'] },
} satisfies Record<string, TextStyle>;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 } as const;
export const radius = { sm: 10, md: 16, lg: 22, xl: 28, pill: 999 } as const;
export const hairline = 1;
