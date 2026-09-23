/**
 * Nexus Design System — Material 3 Warm Palette
 * Translated from the shared Tailwind CSS @theme tokens used by batch 1 + batch 2.
 */

export const Colors = {
  // Surface hierarchy
  surface: '#fcf9f8',
  surfaceDim: '#dcd9d9',
  surfaceBright: '#fcf9f8',
  surfaceContainerLowest: '#ffffff',
  surfaceContainerLow: '#f6f3f2',
  surfaceContainer: '#f0eded',
  surfaceContainerHigh: '#eae7e7',
  surfaceContainerHighest: '#e5e2e1',
  surfaceVariant: '#e5e2e1',

  // On-surface
  onSurface: '#1c1b1b',
  onSurfaceVariant: '#514535',
  inverseSurface: '#313030',
  inverseOnSurface: '#f3f0ef',

  // Outline
  outline: '#837563',
  outlineVariant: '#d5c4af',

  // Primary
  primary: '#805600',
  onPrimary: '#ffffff',
  primaryContainer: '#e8a736',
  onPrimaryContainer: '#5f3f00',
  inversePrimary: '#feba48',
  primaryFixed: '#ffddaf',
  primaryFixedDim: '#feba48',
  onPrimaryFixed: '#281800',
  onPrimaryFixedVariant: '#614000',

  // Secondary
  secondary: '#455f85',
  onSecondary: '#ffffff',
  secondaryContainer: '#b8d3ff',
  onSecondaryContainer: '#415b80',
  secondaryFixed: '#d4e3ff',
  secondaryFixedDim: '#adc8f3',
  onSecondaryFixed: '#001c3a',
  onSecondaryFixedVariant: '#2d486c',

  // Tertiary
  tertiary: '#695c50',
  onTertiary: '#ffffff',
  tertiaryContainer: '#c0b0a1',
  onTertiaryContainer: '#4f4337',
  tertiaryFixed: '#f1dfcf',
  tertiaryFixedDim: '#d5c4b4',
  onTertiaryFixed: '#231a10',
  onTertiaryFixedVariant: '#504539',

  // Error & Feedback
  error: '#ba1a1a',
  onError: '#ffffff',
  errorContainer: '#ffdad6',
  onErrorContainer: '#93000a',
  success: '#3da86b',
  successContainer: '#dcfce7',
  warning: '#f59e0b',
  warningContainer: '#fef3c7',

  // Backgrounds & tactile cards
  background: '#fcf9f8',
  onBackground: '#1c1b1b',
  cardBg: '#f1dfcf',
  cardBorder: '#e5d5c3',
  scrim: 'rgba(26,26,26,0.35)',
  backdrop: 'rgba(0,0,0,0.5)',

  // Tab bar
  tabBarBackground: '#ffffff',
  tabBarBorder: '#eae7e7',
  tabBarActive: '#e8a736',
  tabBarInactive: '#695c50',

  // Misc
  white: '#ffffff',
  black: '#000000',
  transparent: 'transparent',
};

export type ThemeColors = typeof Colors;

export const DarkColors: ThemeColors = {
  surface: '#151312',
  surfaceDim: '#100f0e',
  surfaceBright: '#242120',
  surfaceContainerLowest: '#0d0c0b',
  surfaceContainerLow: '#1c1a18',
  surfaceContainer: '#22201e',
  surfaceContainerHigh: '#2a2725',
  surfaceContainerHighest: '#33302c',
  surfaceVariant: '#33302c',

  onSurface: '#ece6e2',
  onSurfaceVariant: '#d0c2b3',
  inverseSurface: '#fcf9f8',
  inverseOnSurface: '#1c1b1b',

  outline: '#998a7a',
  outlineVariant: '#514535',

  primary: '#feba48',
  onPrimary: '#442b00',
  primaryContainer: '#e8a736',
  onPrimaryContainer: '#2a1700',
  inversePrimary: '#805600',
  primaryFixed: '#ffddaf',
  primaryFixedDim: '#feba48',
  onPrimaryFixed: '#281800',
  onPrimaryFixedVariant: '#614000',

  secondary: '#adc8f3',
  onSecondary: '#133155',
  secondaryContainer: '#2d486c',
  onSecondaryContainer: '#d4e3ff',
  secondaryFixed: '#d4e3ff',
  secondaryFixedDim: '#adc8f3',
  onSecondaryFixed: '#001c3a',
  onSecondaryFixedVariant: '#2d486c',

  tertiary: '#d5c4b4',
  onTertiary: '#3a3025',
  tertiaryContainer: '#504539',
  onTertiaryContainer: '#f1dfcf',
  tertiaryFixed: '#2a2725',
  tertiaryFixedDim: '#22201e',
  onTertiaryFixed: '#ece6e2',
  onTertiaryFixedVariant: '#d0c2b3',

  error: '#ffb4ab',
  onError: '#690005',
  errorContainer: '#93000a',
  onErrorContainer: '#ffdad6',
  success: '#4ade80',
  successContainer: '#064e3b',
  warning: '#fbbf24',
  warningContainer: '#78350f',

  background: '#151312',
  onBackground: '#ece6e2',
  cardBg: '#22201e',
  cardBorder: '#383430',
  scrim: 'rgba(0,0,0,0.65)',
  backdrop: 'rgba(0,0,0,0.75)',

  tabBarBackground: '#1a1816',
  tabBarBorder: '#2a2725',
  tabBarActive: '#e8a736',
  tabBarInactive: '#998a7a',

  white: '#ffffff',
  black: '#000000',
  transparent: 'transparent',
};

export const Typography = {
  headlineLg: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '700' as const,
    letterSpacing: -0.56,
  },
  headlineMd: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '700' as const,
    letterSpacing: -0.36,
  },
  headlineSm: {
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '700' as const,
    letterSpacing: -0.2,
  },
  titleLg: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '600' as const,
  },
  titleMd: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '600' as const,
  },
  bodyLg: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '400' as const,
  },
  bodyMd: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '400' as const,
  },
  bodySm: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '400' as const,
  },
  labelLg: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '600' as const,
  },
  labelMd: {
    fontSize: 15,
    lineHeight: 18,
    fontWeight: '600' as const,
  },
  labelSm: {
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '600' as const,
  },
  captionMd: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '400' as const,
  },
  captionSm: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '400' as const,
  },
} as const;

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  margin: 16,
  gutter: 16,
} as const;

export const BorderRadius = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  full: 9999,
} as const;

export const Shadows = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 6,
  },
  xl: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 10,
  },
} as const;
