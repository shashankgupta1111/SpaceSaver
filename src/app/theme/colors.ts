export const palette = {
  primary: '#5B5FEF',
  primaryLight: '#8B8FF5',
  primaryDark: '#3B3FC7',
  primaryContainer: '#E8E8FF',
  onPrimaryContainer: '#1A1A7A',

  secondary: '#7C4DFF',
  secondaryLight: '#B280FF',
  secondaryDark: '#5C2FCC',
  secondaryContainer: '#EDE0FF',
  onSecondaryContainer: '#21005D',

  success: '#22C55E',
  successLight: '#4ADE80',
  successDark: '#16A34A',
  successContainer: '#DCFCE7',

  warning: '#F59E0B',
  warningLight: '#FCD34D',
  warningDark: '#D97706',
  warningContainer: '#FEF3C7',

  error: '#EF4444',
  errorLight: '#F87171',
  errorDark: '#DC2626',
  errorContainer: '#FEE2E2',

  white: '#FFFFFF',
  black: '#000000',

  gray50: '#F8FAFC',
  gray100: '#F1F5F9',
  gray200: '#E2E8F0',
  gray300: '#CBD5E1',
  gray400: '#94A3B8',
  gray500: '#64748B',
  gray600: '#475569',
  gray700: '#334155',
  gray800: '#1E293B',
  gray900: '#0F172A',
  gray950: '#09090B',

  transparent: 'transparent',
} as const;

export const lightColors = {
  primary: palette.primary,
  primaryLight: palette.primaryLight,
  primaryDark: palette.primaryDark,
  primaryContainer: palette.primaryContainer,
  onPrimary: palette.white,
  onPrimaryContainer: palette.onPrimaryContainer,

  secondary: palette.secondary,
  secondaryLight: palette.secondaryLight,
  secondaryContainer: palette.secondaryContainer,
  onSecondary: palette.white,
  onSecondaryContainer: palette.onSecondaryContainer,

  background: palette.gray50,
  surface: palette.white,
  surfaceVariant: palette.gray100,
  surfaceElevated: palette.white,

  text: palette.gray900,
  textSecondary: palette.gray600,
  textTertiary: palette.gray400,
  textOnPrimary: palette.white,

  border: palette.gray200,
  borderLight: palette.gray100,
  divider: palette.gray100,

  success: palette.success,
  successContainer: palette.successContainer,
  warning: palette.warning,
  warningContainer: palette.warningContainer,
  error: palette.error,
  errorContainer: palette.errorContainer,

  overlay: 'rgba(0,0,0,0.5)',
  shadow: 'rgba(0,0,0,0.12)',

  tabBarBackground: palette.white,
  tabBarBorder: palette.gray100,
  tabBarActive: palette.primary,
  tabBarInactive: palette.gray400,

  cardBackground: palette.white,
  cardShadow: 'rgba(91,95,239,0.08)',
  inputBackground: palette.gray100,
  inputBorder: palette.gray200,

  storageUsed: palette.primary,
  storageFree: palette.gray200,
  storageSaved: palette.success,

  gradientPrimary: [palette.primary, palette.secondary] as [string, string],
  gradientSuccess: [palette.success, '#16A34A'] as [string, string],
  gradientCard: ['rgba(91,95,239,0.08)', 'rgba(124,77,255,0.04)'] as [string, string],
};

export const darkColors: ColorScheme = {
  primary: palette.primaryLight,
  primaryLight: '#BBBEFF',
  primaryDark: palette.primary,
  primaryContainer: '#2D2F8A',
  onPrimary: '#1A1A7A',
  onPrimaryContainer: '#BFC1FF',

  secondary: '#C9A4FF',
  secondaryLight: '#E4CFFF',
  secondaryContainer: '#4A2C8A',
  onSecondary: '#21005D',
  onSecondaryContainer: '#EAD5FF',

  background: palette.gray950,
  surface: '#18181B',
  surfaceVariant: '#27272A',
  surfaceElevated: '#1C1C1F',

  text: '#F8FAFC',
  textSecondary: '#A1A1AA',
  textTertiary: '#71717A',
  textOnPrimary: palette.white,

  border: '#3F3F46',
  borderLight: '#27272A',
  divider: '#27272A',

  success: palette.successLight,
  successContainer: '#14532D',
  warning: palette.warningLight,
  warningContainer: '#78350F',
  error: palette.errorLight,
  errorContainer: '#7F1D1D',

  overlay: 'rgba(0,0,0,0.7)',
  shadow: 'rgba(0,0,0,0.4)',

  tabBarBackground: '#18181B',
  tabBarBorder: '#3F3F46',
  tabBarActive: '#BFC1FF',
  tabBarInactive: '#71717A',

  cardBackground: '#18181B',
  cardShadow: 'rgba(0,0,0,0.3)',
  inputBackground: '#27272A',
  inputBorder: '#3F3F46',

  storageUsed: '#8B8FF5',
  storageFree: '#3F3F46',
  storageSaved: palette.successLight,

  gradientPrimary: ['#8B8FF5', '#C9A4FF'] as [string, string],
  gradientSuccess: [palette.successLight, '#4ADE80'] as [string, string],
  gradientCard: ['rgba(139,143,245,0.12)', 'rgba(201,164,255,0.06)'] as [string, string],
};

// Values widen to `string` so light/dark palettes (different hex values) share
// one shape. `typeof lightColors` alone would pin each value to a literal hex
// and reject darkColors' different values. Gradient keys keep their tuple shape.
export type ColorScheme = {
  [K in keyof typeof lightColors]: (typeof lightColors)[K] extends readonly [
    string,
    string,
  ]
    ? [string, string]
    : string;
};
