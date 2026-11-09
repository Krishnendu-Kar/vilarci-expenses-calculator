// Two palettes with the same names. "primary" is the brand fill (buttons,
// header, selected chips) with `onPrimary` text on it; "tint" is the brand
// colour for text and icons sitting on a surface. They're the same maroon in
// light mode, but dark mode needs a lighter tint to stay readable.
export const lightColors = {
  background: '#FBF5F4',
  surface: '#FFFFFF',
  surfaceAlt: '#F4E6E4',
  primary: '#7A1F2B',
  primaryDark: '#55141C',
  primaryLight: '#A6414C',
  tint: '#7A1F2B',
  onPrimary: '#FFFFFF',
  header: '#7A1F2B',
  accent: '#D4A657',
  textPrimary: '#241012',
  textSecondary: '#8A6F72',
  border: '#EADCDA',
  success: '#2E7D32',
  successBg: '#E6F2E7',
  /** Text/icons on a `success` fill (the Paid button). */
  onSuccess: '#FFFFFF',
  danger: '#C62828',
  dangerBg: '#FBE7E7',
  white: '#FFFFFF',
  backdrop: 'rgba(36,16,18,0.45)',
  snackbar: '#2B1A1D',
};

export type Palette = typeof lightColors;

export const darkColors: Palette = {
  background: '#151012',
  surface: '#1F181A',
  surfaceAlt: '#2B2023',
  primary: '#8C2433',
  primaryDark: '#3D0E14',
  primaryLight: '#C4596A',
  tint: '#F08C99',
  onPrimary: '#FFFFFF',
  header: '#4A1219',
  accent: '#D4A657',
  textPrimary: '#F4EAEB',
  textSecondary: '#B09A9D',
  border: '#3A2C2F',
  success: '#6BC46F',
  successBg: '#1C3320',
  onSuccess: '#0F2411',
  danger: '#F07272',
  dangerBg: '#3B1C1F',
  white: '#FFFFFF',
  backdrop: 'rgba(0,0,0,0.6)',
  snackbar: '#3A2C2F',
};

// One colour per group type, for the icon tile on Home and in search:
// `fg` for the icon, `bg` for the tile behind it.
const KIND_LIGHT = {
  trip: { fg: '#4F46E5', bg: '#EEF2FF' },
  hostel: { fg: '#0F766E', bg: '#CCFBF1' },
  other: { fg: '#C2410C', bg: '#FFEDD5' },
};
const KIND_DARK: typeof KIND_LIGHT = {
  trip: { fg: '#A5B4FC', bg: 'rgba(99,102,241,0.18)' },
  hostel: { fg: '#5EEAD4', bg: 'rgba(20,184,166,0.16)' },
  other: { fg: '#FDBA74', bg: 'rgba(234,88,12,0.18)' },
};
export const kindTint = (kind: keyof typeof KIND_LIGHT, dark: boolean) => (dark ? KIND_DARK : KIND_LIGHT)[kind] ?? KIND_LIGHT.other;

// Avatar tints, picked per member from their name so they stay stable.
// White initials read on all of them in both themes.
export const avatarColors = ['#7A1F2B', '#1E4FA8', '#2E7D32', '#B5651D', '#6A3FA0', '#00838F', '#AD1457', '#5D6D1E'];
